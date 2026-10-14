import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branches.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verify that the actor is a Tenant Administrator or Platform Super Admin
   */
  async assertTenantAdmin(userId: string, tenantId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: { where: { tenantId } },
        userRoles: {
          where: { tenantId },
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw new ForbiddenException('User profile not found');
    }

    if (user.isSuperAdmin) {
      return;
    }

    const membership = user.memberships[0];
    if (membership?.isOwner) {
      return;
    }

    const hasAdminRole = user.userRoles.some((ur) => {
      const lower = ur.role.slug.toLowerCase();
      return (
        lower === 'tenant-admin' ||
        lower === 'admin' ||
        lower.includes('tenant administrator') ||
        lower.includes('tenant admin')
      );
    });

    if (!hasAdminRole) {
      throw new ForbiddenException(
        'Only Tenant Administrators can create or modify branches.',
      );
    }
  }

  async findAllForTenant(tenantId: string, moduleKey?: string) {
    const branches = await this.prisma.branch.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: {
            userBranches: true,
          },
        },
        userBranches: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                status: true,
                isSuperAdmin: true,
                memberships: {
                  where: { tenantId },
                  select: { isOwner: true, status: true },
                },
                userRoles: {
                  where: { tenantId },
                  include: { role: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    const enrichedBranches = branches.map((b) => {
      const branchModule = (b.moduleKey || (b.settings as any)?.moduleKey || 'CLINIC').toUpperCase();

      let labAdminCount = 0;
      let technicianCount = 0;
      let clinicAdminCount = 0;
      let doctorCount = 0;
      let clinicStaffCount = 0;

      for (const ub of b.userBranches || []) {
        const user = ub.user;
        if (!user || user.isSuperAdmin) continue;

        const isOwner = Boolean(user.memberships?.[0]?.isOwner);

        // Filter roles scoped to this tenant and either specific to this branch or tenant-wide
        const branchRoles = (user.userRoles || []).filter(
          (ur) => !ur.branchId || ur.branchId === b.id,
        );

        const roleSlugs = branchRoles.map((ur) => ur.role?.slug?.toLowerCase() || '');
        const roleNames = branchRoles.map((ur) => ur.role?.name?.toLowerCase() || '');

        // Branch Staff Members count ONLY roles matching this branch's module scope.
        // Organization Owner and Tenant Admin are tenant-wide governance roles, NOT branch staff.
        if (branchModule === 'LAB') {
          const isLabAdmin =
            roleSlugs.some((s) => s === 'lab-admin' || s === 'lab_admin' || s === 'lab-administrator') ||
            roleNames.some((n) => n.includes('lab admin'));

          const isTechnician =
            roleSlugs.some((s) => s === 'lab-technician' || s === 'technician' || s === 'lab_technician') ||
            roleNames.some((n) => n.includes('technician'));

          if (isLabAdmin) {
            labAdminCount++;
          } else if (isTechnician) {
            technicianCount++;
          }
        } else if (branchModule === 'CLINIC') {
          const isClinicAdmin =
            roleSlugs.some((s) => s === 'clinic-admin' || s === 'clinic_admin' || s === 'clinic-administrator') ||
            roleNames.some((n) => n.includes('clinic admin'));

          const isDoctor =
            roleSlugs.some((s) => s === 'clinic-doctor' || s === 'doctor' || s === 'dentist' || s === 'clinic_doctor') ||
            roleNames.some((n) => n.includes('doctor') || n.includes('dentist'));

          const isStaff =
            roleSlugs.some((s) => s === 'clinic-staff' || s === 'receptionist' || s === 'nurse' || s === 'staff') ||
            roleNames.some((n) => n.includes('receptionist') || n.includes('nurse') || n.includes('staff'));

          if (isClinicAdmin) {
            clinicAdminCount++;
          } else if (isDoctor) {
            doctorCount++;
          } else if (isStaff && !isOwner) {
            clinicStaffCount++;
          }
        }
      }

      const details: Array<{ role: string; count: number }> = [];
      if (labAdminCount > 0) details.push({ role: 'Lab Admin', count: labAdminCount });
      if (technicianCount > 0) details.push({ role: 'Technician', count: technicianCount });
      if (clinicAdminCount > 0) details.push({ role: 'Clinic Admin', count: clinicAdminCount });
      if (doctorCount > 0) details.push({ role: 'Doctor', count: doctorCount });
      if (clinicStaffCount > 0) details.push({ role: 'Staff', count: clinicStaffCount });

      const total = details.reduce((sum, d) => sum + d.count, 0);

      return {
        ...b,
        _count: {
          ...b._count,
          userBranches: total,
        },
        staffBreakdown: {
          total,
          details,
        },
      };
    });

    if (moduleKey) {
      const target = moduleKey.toUpperCase();
      return enrichedBranches.filter((b) => {
        const bMod = b.moduleKey || (b.settings as any)?.moduleKey || 'CLINIC';
        return bMod.toUpperCase() === target;
      });
    }

    return enrichedBranches;
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

    if (actorId) {
      await this.assertTenantAdmin(actorId, tenantId);
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
          moduleKey,
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

    if (actorId) {
      await this.assertTenantAdmin(actorId, branch.tenantId);
    }

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
          moduleKey: dto.moduleKey ? dto.moduleKey.toUpperCase() : undefined,
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

    if (actorId) {
      await this.assertTenantAdmin(actorId, branch.tenantId);
    }

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
    if (actorId && tenantId) {
      await this.assertTenantAdmin(actorId, tenantId);
    }

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
