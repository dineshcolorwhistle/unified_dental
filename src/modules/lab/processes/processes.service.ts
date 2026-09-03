import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';
import { CreateProcessDto, UpdateProcessDto } from './dto';
import { ProcessType } from '@prisma/client';

@Injectable()
export class ProcessesService {
  private readonly logger = new Logger(ProcessesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to verify if user is Tenant Admin or Super Admin
   */
  async isTenantAdmin(actor: AuthenticatedUser, tenantId: string): Promise<boolean> {
    if (actor.isSuperAdmin) return true;

    const isOwnerMem = (actor as any).memberships?.some(
      (m: any) => m.tenantId === tenantId && m.isOwner,
    );
    if (isOwnerMem) return true;

    const hasAdminRole = actor.roles?.some((r: string) => {
      const lower = r.toLowerCase();
      return lower === 'tenant-admin' || lower.includes('tenant administrator') || lower.includes('tenant admin');
    });
    if (hasAdminRole) return true;

    const membership = await this.prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId: actor.id, tenantId } },
    });
    if (membership?.isOwner) return true;

    const userAdminRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: { slug: { in: ['tenant-admin', 'admin', 'administrator'] } },
      },
    });

    return Boolean(userAdminRole);
  }

  /**
   * Resolve branch ID for Lab Admin or validate provided branch ID for Tenant Admin
   */
  async resolveLabBranch(
    actor: AuthenticatedUser,
    tenantId: string,
    requestedBranchId?: string,
  ): Promise<string> {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);

    if (isTenantAdminUser) {
      if (!requestedBranchId || requestedBranchId === 'all') {
        const firstLabBranch = await this.prisma.branch.findFirst({
          where: { tenantId, moduleKey: 'LAB', status: 'ACTIVE' },
        });
        if (!firstLabBranch) {
          throw new BadRequestException('No active Dental Lab branch found in organization.');
        }
        return firstLabBranch.id;
      }

      const branch = await this.prisma.branch.findFirst({
        where: { id: requestedBranchId, tenantId, moduleKey: 'LAB' },
      });
      if (!branch) {
        throw new BadRequestException('Specified branch is invalid or does not belong to Dental Lab module.');
      }
      return branch.id;
    }

    // For Lab Admin: Resolve from assigned role branch
    const labAdminRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: { slug: 'lab-admin' },
      },
      include: { branch: true },
    });

    if (labAdminRole?.branchId) {
      return labAdminRole.branchId;
    }

    const userBranch = await this.prisma.userBranch.findFirst({
      where: {
        userId: actor.id,
        branch: { tenantId, moduleKey: 'LAB' },
      },
    });

    if (userBranch?.branchId) {
      return userBranch.branchId;
    }

    throw new ForbiddenException('User is not assigned to any Dental Lab branch.');
  }

  /**
   * List all Processes.
   * Scoped to branch for Lab Admin, all/filtered for Tenant Admin.
   */
  async findAll(
    tenantId: string,
    actor: AuthenticatedUser,
    branchIdFilter?: string,
    processAreaId?: string,
    type?: ProcessType,
    search?: string,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    let finalBranchId: string | undefined = undefined;

    if (!isTenantAdminUser) {
      finalBranchId = await this.resolveLabBranch(actor, tenantId);
    } else if (branchIdFilter && branchIdFilter !== 'all') {
      finalBranchId = branchIdFilter;
    }

    const where: any = {
      tenantId,
      moduleKey: 'LAB',
      ...(finalBranchId && { branchId: finalBranchId }),
      ...(processAreaId && { processAreaId }),
      ...(type && { type }),
    };

    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { processArea: { name: { contains: search.trim(), mode: 'insensitive' } } },
        { defaultTechnician: { name: { contains: search.trim(), mode: 'insensitive' } } },
      ];
    }

    return this.prisma.process.findMany({
      where,
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        processArea: {
          select: { id: true, name: true },
        },
        defaultTechnician: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { prosthesisTypeAssignments: true },
        },
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  /**
   * Find single Process by ID
   */
  async findOne(tenantId: string, id: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);

    const process = await this.prisma.process.findFirst({
      where: { id, tenantId, moduleKey: 'LAB' },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        processArea: {
          select: { id: true, name: true },
        },
        defaultTechnician: {
          select: { id: true, name: true, email: true },
        },
        prosthesisTypeAssignments: {
          include: {
            prosthesisType: {
              select: { id: true, name: true },
            },
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!process) {
      throw new NotFoundException(`Process with ID "${id}" not found.`);
    }

    if (!isTenantAdminUser) {
      const userBranchId = await this.resolveLabBranch(actor, tenantId);
      if (process.branchId && process.branchId !== userBranchId) {
        throw new ForbiddenException('You do not have permission to view processes outside your branch.');
      }
    }

    return process;
  }

  /**
   * Create a new Process.
   * Lab Admin auto-scopes to branch.
   */
  async create(dto: CreateProcessDto, tenantId: string, actor: AuthenticatedUser) {
    const branchId = await this.resolveLabBranch(actor, tenantId, dto.branchId);
    const processType = dto.type || ProcessType.PRODUCTION;

    // 1. Process Area is strictly mandatory and must belong to this branch
    if (!dto.processAreaId) {
      throw new BadRequestException('Process Area is mandatory.');
    }
    const area = await this.prisma.processArea.findFirst({
      where: { id: dto.processAreaId, tenantId, branchId, moduleKey: 'LAB' },
    });
    if (!area) {
      throw new BadRequestException('Selected Process Area is invalid or does not belong to this branch.');
    }
    const validatedProcessAreaId = area.id;

    // 2. Default Technician/Lab Admin: mandatory for PRODUCTION and INTERNAL_VERIFICATION, must belong to branch
    let validatedTechnicianId: string | null = null;
    if (processType === ProcessType.EXTERNAL_VERIFICATION) {
      // External verification is reviewed by doctor; technician assignment is null
      validatedTechnicianId = null;
    } else {
      if (!dto.defaultTechnicianId) {
        throw new BadRequestException('Default Technician or Lab Admin is mandatory for this process.');
      }
      const memberInBranch = await this.prisma.user.findFirst({
        where: {
          id: dto.defaultTechnicianId,
          memberships: { some: { tenantId } },
          OR: [
            { userBranches: { some: { branchId } } },
            { userRoles: { some: { tenantId, branchId } } },
          ],
        },
      });
      if (!memberInBranch) {
        throw new BadRequestException(
          'Assigned technician or lab admin does not exist or does not belong to this branch.',
        );
      }

      if (processType === ProcessType.INTERNAL_VERIFICATION) {
        const isAdmin = await this.prisma.userRole.findFirst({
          where: {
            userId: dto.defaultTechnicianId,
            tenantId,
            role: { slug: { in: ['lab-admin', 'tenant-admin', 'admin', 'administrator'] } },
          },
        });
        const isOwner = await this.prisma.tenantMembership.findFirst({
          where: { userId: dto.defaultTechnicianId, tenantId, isOwner: true },
        });
        if (!isAdmin && !isOwner) {
          throw new BadRequestException(
            'Internal Verification processes must be assigned to a Lab Administrator.',
          );
        }
      }

      validatedTechnicianId = memberInBranch.id;
    }

    // Duplicate check in this branch
    const existing = await this.prisma.process.findFirst({
      where: {
        tenantId,
        branchId,
        name: { equals: dto.name.trim(), mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(
        `A Process with the name "${dto.name.trim()}" already exists in this branch.`,
      );
    }

    const process = await this.prisma.$transaction(async (tx) => {
      const created = await tx.process.create({
        data: {
          tenantId,
          branchId,
          moduleKey: 'LAB',
          name: dto.name.trim(),
          type: processType,
          processAreaId: validatedProcessAreaId,
          defaultTechnicianId: validatedTechnicianId,
        },
        include: {
          branch: {
            select: { id: true, name: true, code: true },
          },
          processArea: {
            select: { id: true, name: true },
          },
          defaultTechnician: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          branchId,
          userId: actor.id,
          action: 'CREATE_PROCESS',
          resourceType: 'PROCESS',
          resourceId: created.id,
          moduleKey: 'LAB',
          newValues: {
            name: created.name,
            type: created.type,
            processAreaId: created.processAreaId,
            defaultTechnicianId: created.defaultTechnicianId,
            branchId,
          },
        },
      });

      return created;
    });

    this.logger.log(`Process created: ${process.name} (${process.id}) by user ${actor.id}`);
    return process;
  }

  /**
   * Update an existing Process.
   */
  async update(id: string, dto: UpdateProcessDto, tenantId: string, actor: AuthenticatedUser) {
    const existing = await this.findOne(tenantId, id, actor);
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);

    let finalBranchId = existing.branchId;
    if (isTenantAdminUser && dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, tenantId, moduleKey: 'LAB' },
      });
      if (!branch) {
        throw new BadRequestException('Selected branch does not belong to Dental Lab module.');
      }
      finalBranchId = branch.id;
    }

    const finalType = dto.type || existing.type;

    // Validate Process Area if changed
    let finalProcessAreaId = existing.processAreaId;
    if (dto.processAreaId !== undefined) {
      if (!dto.processAreaId) {
        throw new BadRequestException('Process Area is mandatory.');
      }
      const area = await this.prisma.processArea.findFirst({
        where: { id: dto.processAreaId, tenantId, ...(finalBranchId && { branchId: finalBranchId }), moduleKey: 'LAB' },
      });
      if (!area) {
        throw new BadRequestException('Selected Process Area is invalid or does not belong to this branch.');
      }
      finalProcessAreaId = area.id;
    }

    // Validate default technician
    let finalDefaultTechnicianId = existing.defaultTechnicianId;
    if (finalType === ProcessType.EXTERNAL_VERIFICATION) {
      finalDefaultTechnicianId = null;
    } else {
      if (dto.defaultTechnicianId !== undefined) {
        if (!dto.defaultTechnicianId) {
          throw new BadRequestException('Default Technician or Lab Admin is mandatory for this process.');
        }
        const memberInBranch = await this.prisma.user.findFirst({
          where: {
            id: dto.defaultTechnicianId,
            memberships: { some: { tenantId } },
            OR: [
              { userBranches: { some: { branchId: finalBranchId } } },
              { userRoles: { some: { tenantId, branchId: finalBranchId } } },
            ],
          },
        });
        if (!memberInBranch) {
          throw new BadRequestException(
            'Assigned technician or lab admin does not exist or does not belong to this branch.',
          );
        }
        finalDefaultTechnicianId = memberInBranch.id;
      } else if (!finalDefaultTechnicianId) {
        throw new BadRequestException('Default Technician or Lab Admin is mandatory for this process.');
      }

      if (finalType === ProcessType.INTERNAL_VERIFICATION && finalDefaultTechnicianId) {
        const isAdmin = await this.prisma.userRole.findFirst({
          where: {
            userId: finalDefaultTechnicianId,
            tenantId,
            role: { slug: { in: ['lab-admin', 'tenant-admin', 'admin', 'administrator'] } },
          },
        });
        const isOwner = await this.prisma.tenantMembership.findFirst({
          where: { userId: finalDefaultTechnicianId, tenantId, isOwner: true },
        });
        if (!isAdmin && !isOwner) {
          throw new BadRequestException(
            'Internal Verification processes must be assigned to a Lab Administrator.',
          );
        }
      }
    }

    // Unique check if name changed
    if (dto.name && dto.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.prisma.process.findFirst({
        where: {
          tenantId,
          branchId: finalBranchId,
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          `A Process with the name "${dto.name.trim()}" already exists in this branch.`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.process.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name.trim() }),
          type: finalType,
          processAreaId: finalProcessAreaId,
          defaultTechnicianId: finalDefaultTechnicianId,
          ...(finalBranchId && { branchId: finalBranchId }),
        },
        include: {
          branch: {
            select: { id: true, name: true, code: true },
          },
          processArea: {
            select: { id: true, name: true },
          },
          defaultTechnician: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          branchId: res.branchId,
          userId: actor.id,
          action: 'UPDATE_PROCESS',
          resourceType: 'PROCESS',
          resourceId: res.id,
          moduleKey: 'LAB',
          oldValues: {
            name: existing.name,
            type: existing.type,
            processAreaId: existing.processAreaId,
            defaultTechnicianId: existing.defaultTechnicianId,
          },
          newValues: {
            name: res.name,
            type: res.type,
            processAreaId: res.processAreaId,
            defaultTechnicianId: res.defaultTechnicianId,
          },
        },
      });

      return res;
    });

    this.logger.log(`Process updated: ${updated.name} (${updated.id}) by user ${actor.id}`);
    return updated;
  }

  /**
   * Remove a Process.
   * STRICT ENFORCEMENT: ONLY Tenant Admin can delete.
   * Validates that process is not used in any Prosthesis Type workflow.
   */
  async remove(id: string, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (!isTenantAdminUser) {
      throw new ForbiddenException(
        'Permission denied. Only Tenant Administrators have authorization to delete Processes.',
      );
    }

    const existing = await this.prisma.process.findFirst({
      where: { id, tenantId, moduleKey: 'LAB' },
      include: {
        _count: {
          select: { prosthesisTypeAssignments: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Process with ID "${id}" not found.`);
    }

    if (existing._count.prosthesisTypeAssignments > 0) {
      throw new BadRequestException(
        `Cannot delete Process "${existing.name}" because it is currently assigned to ${existing._count.prosthesisTypeAssignments} prosthesis type workflow recipe(s). Please remove this step from the prosthesis recipes first.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.process.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          branchId: existing.branchId,
          userId: actor.id,
          action: 'DELETE_PROCESS',
          resourceType: 'PROCESS',
          resourceId: id,
          moduleKey: 'LAB',
          oldValues: {
            name: existing.name,
            type: existing.type,
            processAreaId: existing.processAreaId,
            branchId: existing.branchId,
          },
        },
      });
    });

    this.logger.log(`Process deleted: ${existing.name} (${id}) by Tenant Admin ${actor.id}`);
    return {
      success: true,
      message: `Process "${existing.name}" has been deleted successfully.`,
    };
  }
}
