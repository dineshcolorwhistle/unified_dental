import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branches.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForTenant(tenantId: string, moduleKey?: string) {
    const branches = await this.prisma.branch.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: {
            userBranches: true,
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    if (moduleKey) {
      const target = moduleKey.toUpperCase();
      return branches.filter((b) => {
        const bMod = (b.settings as any)?.moduleKey || 'CLINIC';
        return bMod.toUpperCase() === target;
      });
    }

    return branches;
  }

  async findById(id: string, tenantId?: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        userBranches: {
          include: { user: true },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }

    if (tenantId && branch.tenantId !== tenantId) {
      throw new NotFoundException(`Branch with ID ${id} not found in this organization`);
    }

    return branch;
  }

  async create(dto: CreateBranchDto, currentTenantId?: string, actorId?: string) {
    const tenantId = dto.tenantId || currentTenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required to create a branch');
    }

    const moduleKey = dto.moduleKey ? dto.moduleKey.toUpperCase() : 'CLINIC';

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        include: {
          plan: true,
          branches: true,
        },
      });

      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      // Check branch limit
      const currentBranchCount = tenant.branches.length;
      const effectiveMaxBranches = tenant.maxBranches !== null && tenant.maxBranches !== undefined
        ? tenant.maxBranches
        : (tenant.plan?.branchCount || 3);

      if (currentBranchCount >= effectiveMaxBranches) {
        throw new BadRequestException(
          `Organization has reached the maximum allowed limit of ${effectiveMaxBranches} branch(es). Please upgrade your subscription plan or contact administrator for a limit override.`,
        );
      }

      // If marking as default or if this is the first branch, set isDefault
      const isDefaultBranch = dto.isDefault ?? currentBranchCount === 0;

      if (isDefaultBranch) {
        await tx.branch.updateMany({
          where: { tenantId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const branch = await tx.branch.create({
        data: {
          tenantId,
          name: dto.name,
          code: dto.code,
          address: dto.address,
          phone: dto.phone,
          email: dto.email,
          isDefault: isDefaultBranch,
          status: dto.status || 'ACTIVE',
          settings: {
            ...(dto.settings || {}),
            moduleKey,
          },
        },
      });

      // Auto-assign creator/actor to this new branch
      if (actorId) {
        await tx.userBranch.upsert({
          where: {
            userId_branchId: {
              userId: actorId,
              branchId: branch.id,
            },
          },
          update: {},
          create: {
            userId: actorId,
            branchId: branch.id,
            isDefault: isDefaultBranch,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          branchId: branch.id,
          userId: actorId,
          action: 'CREATE_BRANCH',
          resourceType: 'BRANCH',
          resourceId: branch.id,
          newValues: { name: branch.name, code: branch.code, moduleKey },
        },
      });

      return branch;
    });
  }

  async update(id: string, dto: UpdateBranchDto, currentTenantId?: string, actorId?: string) {
    const branch = await this.findById(id, currentTenantId);
    const existingSettings = (branch.settings as object) || {};

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.branch.updateMany({
          where: { tenantId: branch.tenantId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      const newSettings = {
        ...existingSettings,
        ...(dto.settings || {}),
        ...(dto.moduleKey ? { moduleKey: dto.moduleKey.toUpperCase() } : {}),
      };

      const updated = await tx.branch.update({
        where: { id },
        data: {
          name: dto.name,
          code: dto.code,
          address: dto.address,
          phone: dto.phone,
          email: dto.email,
          isDefault: dto.isDefault,
          status: dto.status,
          settings: newSettings,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: branch.tenantId,
          branchId: id,
          userId: actorId,
          action: 'UPDATE_BRANCH',
          resourceType: 'BRANCH',
          resourceId: id,
          oldValues: branch as any,
          newValues: updated as any,
        },
      });

      return updated;
    });
  }

  async remove(id: string, currentTenantId?: string, actorId?: string) {
    const branch = await this.findById(id, currentTenantId);

    return this.prisma.$transaction(async (tx) => {
      // 1. If deleting default branch, assign default to another branch if available
      if (branch.isDefault) {
        const nextBranch = await tx.branch.findFirst({
          where: {
            tenantId: branch.tenantId,
            id: { not: id },
          },
          orderBy: { createdAt: 'asc' },
        });

        if (nextBranch) {
          await tx.branch.update({
            where: { id: nextBranch.id },
            data: { isDefault: true },
          });
        }
      }

      // 2. Unlink userBranches
      await tx.userBranch.deleteMany({
        where: { branchId: id },
      });

      // 3. Unlink userRoles
      await tx.userRole.deleteMany({
        where: { branchId: id },
      });

      // 4. Nullify auditLogs
      await tx.auditLog.updateMany({
        where: { branchId: id },
        data: { branchId: null },
      });

      // 5. Nullify files
      await tx.fileRecord.updateMany({
        where: { branchId: id },
        data: { branchId: null },
      });

      // 6. Delete branch
      await tx.branch.delete({
        where: { id },
      });

      // 7. Audit log
      await tx.auditLog.create({
        data: {
          tenantId: branch.tenantId,
          branchId: null,
          userId: actorId,
          action: 'DELETE_BRANCH',
          resourceType: 'BRANCH',
          resourceId: id,
          oldValues: branch as any,
        },
      });

      return { success: true, message: `Branch ${branch.name} deleted successfully` };
    });
  }

  async resetBranches(tenantId?: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      let targetTenantIds: string[] = [];

      if (tenantId) {
        targetTenantIds = [tenantId];
      } else {
        const smileTenant = await tx.tenant.findUnique({
          where: { slug: 'smile-dental' },
        });
        if (smileTenant) {
          targetTenantIds = [smileTenant.id];
        } else {
          const allTenants = await tx.tenant.findMany({ select: { id: true } });
          targetTenantIds = allTenants.map((t) => t.id);
        }
      }

      // Find all branches in target tenants
      const branches = await tx.branch.findMany({
        where: {
          tenantId: { in: targetTenantIds },
        },
      });

      const branchIds = branches.map((b) => b.id);

      if (branchIds.length > 0) {
        await tx.userBranch.deleteMany({
          where: { branchId: { in: branchIds } },
        });

        await tx.userRole.deleteMany({
          where: { branchId: { in: branchIds } },
        });

        await tx.auditLog.updateMany({
          where: { branchId: { in: branchIds } },
          data: { branchId: null },
        });

        await tx.fileRecord.updateMany({
          where: { branchId: { in: branchIds } },
          data: { branchId: null },
        });

        await tx.branch.deleteMany({
          where: { id: { in: branchIds } },
        });
      }

      if (actorId && targetTenantIds.length === 1) {
        await tx.auditLog.create({
          data: {
            tenantId: targetTenantIds[0],
            branchId: null,
            userId: actorId,
            action: 'RESET_BRANCHES',
            resourceType: 'BRANCH',
            resourceId: 'ALL',
            newValues: { deletedCount: branches.length },
          },
        });
      }

      return {
        success: true,
        message: `Successfully reset branches (${branches.length} branch(es) deleted)`,
        deletedCount: branches.length,
      };
    });
  }
}
