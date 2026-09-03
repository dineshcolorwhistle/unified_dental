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
import { CreateProsthesisTypeDto, UpdateProsthesisTypeDto, ReorderProcessesDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ProsthesisTypesService {
  private readonly logger = new Logger(ProsthesisTypesService.name);

  constructor(private readonly prisma: PrismaService) {}

  private readonly fullInclude = {
    branch: {
      select: { id: true, name: true, code: true },
    },
    processAssignments: {
      orderBy: { sequence: 'asc' as const },
      include: {
        process: {
          include: {
            processArea: {
              select: { id: true, name: true },
            },
            defaultTechnician: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    },
  };

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
   * List all Prosthesis Types.
   */
  async findAll(
    tenantId: string,
    actor: AuthenticatedUser,
    branchIdFilter?: string,
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
    };

    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    return this.prisma.prosthesisType.findMany({
      where,
      include: this.fullInclude,
      orderBy: [{ name: 'asc' }],
    });
  }

  /**
   * Find single Prosthesis Type by ID
   */
  async findOne(tenantId: string, id: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);

    const item = await this.prisma.prosthesisType.findFirst({
      where: { id, tenantId, moduleKey: 'LAB' },
      include: this.fullInclude,
    });

    if (!item) {
      throw new NotFoundException(`Prosthesis Type with ID "${id}" not found.`);
    }

    if (!isTenantAdminUser) {
      const userBranchId = await this.resolveLabBranch(actor, tenantId);
      if (item.branchId && item.branchId !== userBranchId) {
        throw new ForbiddenException('You do not have permission to view prosthesis types outside your branch.');
      }
    }

    return item;
  }

  /**
   * Create a new Prosthesis Type with workflow recipe.
   */
  async create(dto: CreateProsthesisTypeDto, tenantId: string, actor: AuthenticatedUser) {
    const branchId = await this.resolveLabBranch(actor, tenantId, dto.branchId);

    // Duplicate check in this branch
    const existing = await this.prisma.prosthesisType.findFirst({
      where: {
        tenantId,
        branchId,
        name: { equals: dto.name.trim(), mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(
        `A Prosthesis Type with the name "${dto.name.trim()}" already exists in this branch.`,
      );
    }

    // Validate process IDs if provided
    const processIds = dto.processIds || [];
    if (processIds.length > 0) {
      const existingProcesses = await this.prisma.process.findMany({
        where: {
          id: { in: processIds },
          tenantId,
          branchId,
          moduleKey: 'LAB',
        },
        select: { id: true },
      });

      const foundIds = new Set(existingProcesses.map((p) => p.id));
      const invalidIds = processIds.filter((pid) => !foundIds.has(pid));
      if (invalidIds.length > 0) {
        throw new BadRequestException(
          `The following process IDs do not belong to this branch: ${invalidIds.join(', ')}`,
        );
      }
    }

    const priceValue = dto.price !== undefined ? new Decimal(dto.price) : new Decimal(0);

    const prosthesisType = await this.prisma.$transaction(async (tx) => {
      const created = await tx.prosthesisType.create({
        data: {
          tenantId,
          branchId,
          moduleKey: 'LAB',
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          price: priceValue,
          processAssignments: {
            create: processIds.map((processId, index) => ({
              processId,
              sequence: index,
            })),
          },
        },
        include: this.fullInclude,
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          branchId,
          userId: actor.id,
          action: 'CREATE_PROSTHESIS_TYPE',
          resourceType: 'PROSTHESIS_TYPE',
          resourceId: created.id,
          moduleKey: 'LAB',
          newValues: {
            name: created.name,
            description: created.description,
            price: Number(created.price),
            stepsCount: processIds.length,
            branchId,
          },
        },
      });

      return created;
    });

    this.logger.log(`Prosthesis Type created: ${prosthesisType.name} (${prosthesisType.id}) by user ${actor.id}`);
    return prosthesisType;
  }

  /**
   * Update a Prosthesis Type.
   */
  async update(id: string, dto: UpdateProsthesisTypeDto, tenantId: string, actor: AuthenticatedUser) {
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

    // Name unique check
    if (dto.name && dto.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.prisma.prosthesisType.findFirst({
        where: {
          tenantId,
          branchId: finalBranchId,
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          `A Prosthesis Type with the name "${dto.name.trim()}" already exists in this branch.`,
        );
      }
    }

    // Validate processIds if provided
    if (dto.processIds !== undefined && dto.processIds.length > 0) {
      const existingProcesses = await this.prisma.process.findMany({
        where: {
          id: { in: dto.processIds },
          tenantId,
          ...(finalBranchId && { branchId: finalBranchId }),
          moduleKey: 'LAB',
        },
        select: { id: true },
      });

      const foundIds = new Set(existingProcesses.map((p) => p.id));
      const invalidIds = dto.processIds.filter((pid) => !foundIds.has(pid));
      if (invalidIds.length > 0) {
        throw new BadRequestException(
          `The following process IDs do not belong to this branch: ${invalidIds.join(', ')}`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // If processIds is explicitly sent, replace assignments
      if (dto.processIds !== undefined) {
        await tx.prosthesisTypeProcess.deleteMany({
          where: { prosthesisTypeId: id },
        });

        if (dto.processIds.length > 0) {
          await tx.prosthesisTypeProcess.createMany({
            data: dto.processIds.map((processId, index) => ({
              prosthesisTypeId: id,
              processId,
              sequence: index,
            })),
          });
        }
      }

      const res = await tx.prosthesisType.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name.trim() }),
          ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
          ...(dto.price !== undefined && { price: new Decimal(dto.price) }),
          ...(finalBranchId && { branchId: finalBranchId }),
        },
        include: this.fullInclude,
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          branchId: res.branchId,
          userId: actor.id,
          action: 'UPDATE_PROSTHESIS_TYPE',
          resourceType: 'PROSTHESIS_TYPE',
          resourceId: res.id,
          moduleKey: 'LAB',
          oldValues: {
            name: existing.name,
            description: existing.description,
            price: Number(existing.price),
          },
          newValues: {
            name: res.name,
            description: res.description,
            price: Number(res.price),
            stepsCount: dto.processIds !== undefined ? dto.processIds.length : undefined,
          },
        },
      });

      return res;
    });

    this.logger.log(`Prosthesis Type updated: ${updated.name} (${updated.id}) by user ${actor.id}`);
    return updated;
  }

  /**
   * Dedicated reorder endpoint for workflow recipe steps.
   */
  async reorderProcesses(
    id: string,
    dto: ReorderProcessesDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.findOne(tenantId, id, actor);

    // Verify all process IDs belong to this prosthesis type
    const currentAssignments = await this.prisma.prosthesisTypeProcess.findMany({
      where: { prosthesisTypeId: id },
      select: { processId: true },
    });

    const currentProcessIds = new Set(currentAssignments.map((a) => a.processId));
    if (dto.processIds.length !== currentProcessIds.size) {
      throw new BadRequestException('The process list must contain all existing steps for this prosthesis type.');
    }

    for (const pid of dto.processIds) {
      if (!currentProcessIds.has(pid)) {
        throw new BadRequestException(`Process ID "${pid}" is not part of this prosthesis recipe.`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.prosthesisTypeProcess.deleteMany({
        where: { prosthesisTypeId: id },
      });

      await tx.prosthesisTypeProcess.createMany({
        data: dto.processIds.map((processId, index) => ({
          prosthesisTypeId: id,
          processId,
          sequence: index,
        })),
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          branchId: existing.branchId,
          userId: actor.id,
          action: 'REORDER_PROSTHESIS_RECIPE',
          resourceType: 'PROSTHESIS_TYPE',
          resourceId: id,
          moduleKey: 'LAB',
          newValues: {
            newSequenceOrder: dto.processIds,
          },
        },
      });
    });

    this.logger.log(`Prosthesis recipe steps reordered: ${existing.name} (${id}) by user ${actor.id}`);
    return this.findOne(tenantId, id, actor);
  }

  /**
   * Remove a Prosthesis Type.
   * STRICT ENFORCEMENT: ONLY Tenant Admin can delete.
   */
  async remove(id: string, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (!isTenantAdminUser) {
      throw new ForbiddenException(
        'Permission denied. Only Tenant Administrators have authorization to delete Prosthesis Types.',
      );
    }

    const existing = await this.prisma.prosthesisType.findFirst({
      where: { id, tenantId, moduleKey: 'LAB' },
    });

    if (!existing) {
      throw new NotFoundException(`Prosthesis Type with ID "${id}" not found.`);
    }

    await this.prisma.$transaction(async (tx) => {
      // Cascade delete junction
      await tx.prosthesisTypeProcess.deleteMany({
        where: { prosthesisTypeId: id },
      });

      await tx.prosthesisType.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          branchId: existing.branchId,
          userId: actor.id,
          action: 'DELETE_PROSTHESIS_TYPE',
          resourceType: 'PROSTHESIS_TYPE',
          resourceId: id,
          moduleKey: 'LAB',
          oldValues: {
            name: existing.name,
            description: existing.description,
            price: Number(existing.price),
            branchId: existing.branchId,
          },
        },
      });
    });

    this.logger.log(`Prosthesis Type deleted: ${existing.name} (${id}) by Tenant Admin ${actor.id}`);
    return {
      success: true,
      message: `Prosthesis Type "${existing.name}" has been deleted successfully.`,
    };
  }
}
