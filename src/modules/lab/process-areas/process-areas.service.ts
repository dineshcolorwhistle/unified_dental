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
import { CreateProcessAreaDto, UpdateProcessAreaDto } from './dto';

@Injectable()
export class ProcessAreasService {
  private readonly logger = new Logger(ProcessAreasService.name);

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
   * Resolve branch ID for Lab Admin, or validate provided branch ID for Tenant Admin
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
   * List all Process Areas in tenant organization.
   * Lab Admin is restricted to their assigned branch.
   * Tenant Admin can filter by branch or view all.
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

    return this.prisma.processArea.findMany({
      where,
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: { processes: true },
        },
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  /**
   * Find a single Process Area by ID.
   */
  async findOne(tenantId: string, id: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);

    const area = await this.prisma.processArea.findFirst({
      where: { id, tenantId, moduleKey: 'LAB' },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        processes: {
          select: {
            id: true,
            name: true,
            type: true,
            defaultTechnician: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        _count: {
          select: { processes: true },
        },
      },
    });

    if (!area) {
      throw new NotFoundException(`Process Area with ID "${id}" not found.`);
    }

    if (!isTenantAdminUser) {
      const userBranchId = await this.resolveLabBranch(actor, tenantId);
      if (area.branchId && area.branchId !== userBranchId) {
        throw new ForbiddenException('You do not have permission to view process areas outside your branch.');
      }
    }

    return area;
  }

  /**
   * Create a new Process Area.
   * Lab Admin can create (locked to their branch).
   * Tenant Admin can create for any LAB branch.
   */
  async create(dto: CreateProcessAreaDto, tenantId: string, actor: AuthenticatedUser) {
    const branchId = await this.resolveLabBranch(actor, tenantId, dto.branchId);

    // Duplicate check within the branch
    const existing = await this.prisma.processArea.findFirst({
      where: {
        tenantId,
        branchId,
        name: { equals: dto.name.trim(), mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(
        `A Process Area with the name "${dto.name.trim()}" already exists in this branch.`,
      );
    }

    const processArea = await this.prisma.$transaction(async (tx) => {
      const created = await tx.processArea.create({
        data: {
          tenantId,
          branchId,
          moduleKey: 'LAB',
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
        },
        include: {
          branch: {
            select: { id: true, name: true, code: true },
          },
          _count: {
            select: { processes: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          branchId,
          userId: actor.id,
          action: 'CREATE_PROCESS_AREA',
          resourceType: 'PROCESS_AREA',
          resourceId: created.id,
          moduleKey: 'LAB',
          newValues: {
            name: created.name,
            description: created.description,
            branchId,
          },
        },
      });

      return created;
    });

    this.logger.log(`Process Area created: ${processArea.name} (${processArea.id}) by user ${actor.id}`);
    return processArea;
  }

  /**
   * Update a Process Area.
   * Lab Admin can update (only their branch).
   * Tenant Admin can update any.
   */
  async update(id: string, dto: UpdateProcessAreaDto, tenantId: string, actor: AuthenticatedUser) {
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

    if (dto.name && dto.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.prisma.processArea.findFirst({
        where: {
          tenantId,
          branchId: finalBranchId,
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          `A Process Area with the name "${dto.name.trim()}" already exists in this branch.`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.processArea.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name.trim() }),
          ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
          ...(finalBranchId && { branchId: finalBranchId }),
        },
        include: {
          branch: {
            select: { id: true, name: true, code: true },
          },
          _count: {
            select: { processes: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          branchId: res.branchId,
          userId: actor.id,
          action: 'UPDATE_PROCESS_AREA',
          resourceType: 'PROCESS_AREA',
          resourceId: res.id,
          moduleKey: 'LAB',
          oldValues: {
            name: existing.name,
            description: existing.description,
            branchId: existing.branchId,
          },
          newValues: {
            name: res.name,
            description: res.description,
            branchId: res.branchId,
          },
        },
      });

      return res;
    });

    this.logger.log(`Process Area updated: ${updated.name} (${updated.id}) by user ${actor.id}`);
    return updated;
  }

  /**
   * Remove a Process Area.
   * STRICT ENFORCEMENT: ONLY Tenant Admin can delete.
   * Validates that no Process is currently linked to this area.
   */
  async remove(id: string, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (!isTenantAdminUser) {
      throw new ForbiddenException(
        'Permission denied. Only Tenant Administrators have authorization to delete Process Areas.',
      );
    }

    const existing = await this.prisma.processArea.findFirst({
      where: { id, tenantId, moduleKey: 'LAB' },
      include: {
        _count: {
          select: { processes: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Process Area with ID "${id}" not found.`);
    }

    if (existing._count.processes > 0) {
      throw new BadRequestException(
        `Cannot delete Process Area "${existing.name}" because it is currently linked to ${existing._count.processes} process(es). Please reassign or delete the associated processes first.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.processArea.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          branchId: existing.branchId,
          userId: actor.id,
          action: 'DELETE_PROCESS_AREA',
          resourceType: 'PROCESS_AREA',
          resourceId: id,
          moduleKey: 'LAB',
          oldValues: {
            name: existing.name,
            description: existing.description,
            branchId: existing.branchId,
          },
        },
      });
    });

    this.logger.log(`Process Area deleted: ${existing.name} (${id}) by Tenant Admin ${actor.id}`);
    return {
      success: true,
      message: `Process Area "${existing.name}" has been deleted successfully.`,
    };
  }
}
