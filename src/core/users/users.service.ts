import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  AssignUserModulesDto,
  AssignUserRolesDto,
  CreateUserDto,
  UpdateUserDto,
} from './dto/users.dto';
import * as bcrypt from 'bcrypt';
import { UserStatus } from '@prisma/client';
import { AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForTenant(tenantId: string, search?: string) {
    return this.prisma.user.findMany({
      where: {
        memberships: {
          some: { tenantId },
        },
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        memberships: {
          where: { tenantId },
        },
        userBranches: {
          where: { branch: { tenantId } },
          include: { branch: true },
        },
        moduleAccess: {
          where: { tenantId },
        },
        userRoles: {
          where: { tenantId },
          include: {
            role: true,
            branch: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(userId: string, tenantId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: tenantId ? { tenantId } : undefined,
          include: { tenant: true },
        },
        userBranches: {
          where: tenantId ? { branch: { tenantId } } : undefined,
          include: { branch: true },
        },
        moduleAccess: {
          where: tenantId ? { tenantId } : undefined,
        },
        userRoles: {
          where: tenantId ? { tenantId } : undefined,
          include: {
            role: true,
            branch: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user;
  }

  async create(dto: CreateUserDto, currentTenantId?: string, creatorUserId?: string) {
    const targetTenantId = dto.tenantId || currentTenantId;
    if (!targetTenantId) {
      throw new BadRequestException('Tenant ID is required to create a user');
    }

    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });

    const passwordHash = await bcrypt.hash(dto.password || 'Welcome@123456', 10);

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: targetTenantId },
        include: { plan: true },
      });

      if (!tenant) {
        throw new NotFoundException(`Tenant with ID ${targetTenantId} not found`);
      }

      const currentMemberCount = await tx.tenantMembership.count({
        where: {
          tenantId: targetTenantId,
        },
      });

      const effectiveMaxMembers =
        tenant.maxMembers !== null && tenant.maxMembers !== undefined
          ? Number(tenant.maxMembers)
          : tenant.plan?.memberCount !== null && tenant.plan?.memberCount !== undefined
          ? Number(tenant.plan.memberCount)
          : 10;

      if (currentMemberCount >= effectiveMaxMembers) {
        throw new BadRequestException(
          `Organization has reached the maximum allowed limit of ${effectiveMaxMembers} team member(s) (including tenant admin). Please upgrade your subscription plan or contact administrator for a limit override.`,
        );
      }

      let user = existing;
      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            passwordHash,
            name: dto.name,
            phone: dto.phone,
            status: UserStatus.ACTIVE,
          },
        });
      }

      // Check if membership already exists in this tenant
      const existingMembership = await tx.tenantMembership.findUnique({
        where: {
          userId_tenantId: {
            userId: user.id,
            tenantId: targetTenantId,
          },
        },
      });

      if (existingMembership) {
        throw new ConflictException(`User ${email} is already a member of this organization`);
      }

      // Create membership
      await tx.tenantMembership.create({
        data: {
          userId: user.id,
          tenantId: targetTenantId,
          status: UserStatus.ACTIVE,
        },
      });

      // Assign Branch if provided or pick default
      let branchId = dto.branchId;
      if (!branchId) {
        const defaultBranch = await tx.branch.findFirst({
          where: { tenantId: targetTenantId, isDefault: true },
        });
        branchId = defaultBranch?.id;
      }

      if (branchId) {
        await tx.userBranch.create({
          data: {
            userId: user.id,
            branchId,
            isDefault: true,
          },
        });
      }

      // Assign Module Access
      let moduleKeys = dto.moduleKeys;
      if (!moduleKeys || moduleKeys.length === 0) {
        const tenantMods = await tx.tenantModule.findMany({
          where: { tenantId: targetTenantId, isEnabled: true },
          select: { moduleKey: true },
        });
        moduleKeys = tenantMods.map((tm) => tm.moduleKey);
      }

      for (const mod of moduleKeys) {
        await tx.userModuleAccess.create({
          data: {
            userId: user.id,
            tenantId: targetTenantId,
            moduleKey: mod,
            isActive: true,
          },
        });
      }

      // Assign Role if provided or default staff
      if (dto.roleId) {
        await tx.userRole.create({
          data: {
            userId: user.id,
            tenantId: targetTenantId,
            branchId: branchId || null,
            roleId: dto.roleId,
          },
        });
      } else {
        const staffRole = await tx.role.findFirst({ where: { slug: 'staff' } });
        if (staffRole) {
          await tx.userRole.create({
            data: {
              userId: user.id,
              tenantId: targetTenantId,
              branchId: branchId || null,
              roleId: staffRole.id,
            },
          });
        }
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          tenantId: targetTenantId,
          branchId,
          userId: creatorUserId,
          action: 'CREATE_USER',
          resourceType: 'USER',
          resourceId: user.id,
          newValues: { email, name: dto.name, roleId: dto.roleId },
        },
      });

      return user;
    });
  }

  async update(userId: string, dto: UpdateUserDto, currentTenantId?: string, actorId?: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        phone: dto.phone,
        status: dto.status,
        locale: dto.locale,
      },
    });

    if (currentTenantId) {
      await this.prisma.auditLog.create({
        data: {
          tenantId: currentTenantId,
          userId: actorId,
          action: 'UPDATE_USER',
          resourceType: 'USER',
          resourceId: userId,
          newValues: dto as any,
        },
      });
    }

    return user;
  }

  async assignRoles(dto: AssignUserRolesDto, actorId?: string) {
    const { userId, tenantId, branchId, roleIds } = dto;

    return this.prisma.$transaction(async (tx) => {
      // Remove existing roles for this tenant/branch
      await tx.userRole.deleteMany({
        where: {
          userId,
          tenantId,
          branchId: branchId || null,
        },
      });

      // Insert new roles
      for (const roleId of roleIds) {
        await tx.userRole.create({
          data: {
            userId,
            tenantId,
            branchId: branchId || null,
            roleId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          branchId,
          userId: actorId,
          action: 'ASSIGN_ROLES',
          resourceType: 'USER',
          resourceId: userId,
          newValues: { roleIds },
        },
      });

      return { success: true, count: roleIds.length };
    });
  }

  async assignModules(dto: AssignUserModulesDto, actorId?: string) {
    const { userId, tenantId, modules } = dto;

    for (const item of modules) {
      await this.prisma.userModuleAccess.upsert({
        where: {
          userId_tenantId_moduleKey: {
            userId,
            tenantId,
            moduleKey: item.moduleKey,
          },
        },
        update: { isActive: item.isActive },
        create: {
          userId,
          tenantId,
          moduleKey: item.moduleKey,
          isActive: item.isActive,
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'UPDATE_USER_MODULE_ACCESS',
        resourceType: 'USER',
        resourceId: userId,
        newValues: { modules },
      },
    });

    return { success: true };
  }

  /**
   * Verify that the actor is a Tenant Administrator or Platform Super Admin
   */
  async assertTenantAdmin(actor: AuthenticatedUser, tenantId: string): Promise<void> {
    if (!actor) {
      throw new ForbiddenException('Authentication required');
    }

    if (actor.isSuperAdmin) {
      return;
    }

    const membership = await this.prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId: actor.id, tenantId } },
    });

    if (membership?.isOwner) {
      return;
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: actor.id, tenantId },
      include: { role: true },
    });

    const hasTenantAdminRole = userRoles.some((ur) => {
      const lower = ur.role?.slug?.toLowerCase() || '';
      return (
        lower === 'tenant-admin' ||
        lower === 'admin' ||
        lower.includes('tenant administrator') ||
        lower.includes('tenant admin')
      );
    });

    if (!hasTenantAdminRole) {
      throw new ForbiddenException('Only Tenant Administrators can remove users from the organization.');
    }
  }

  /**
   * Remove a member from the active tenant organization.
   * Enforced strictly for Tenant Admin / Super Admin only.
   * Cannot remove the organization owner or yourself.
   */
  async removeMemberFromTenant(userId: string, tenantId: string, actor: AuthenticatedUser) {
    if (!tenantId) {
      throw new BadRequestException('Organization context (tenant ID) is required.');
    }

    await this.assertTenantAdmin(actor, tenantId);

    if (userId === actor.id) {
      throw new BadRequestException('You cannot remove yourself from the organization.');
    }

    const membership = await this.prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: { user: true },
    });

    if (!membership) {
      throw new NotFoundException(`User with ID '${userId}' is not a member of this organization.`);
    }

    if (membership.isOwner) {
      throw new BadRequestException('The organization owner / primary tenant administrator cannot be removed.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Remove all roles in this tenant
      await tx.userRole.deleteMany({
        where: { userId, tenantId },
      });

      // 2. Remove branch links for branches belonging to this tenant
      const tenantBranches = await tx.branch.findMany({
        where: { tenantId },
        select: { id: true },
      });
      const branchIds = tenantBranches.map((b) => b.id);
      if (branchIds.length > 0) {
        await tx.userBranch.deleteMany({
          where: { userId, branchId: { in: branchIds } },
        });
      }

      // 3. Remove personal module accesses for this tenant
      await tx.userModuleAccess.deleteMany({
        where: { userId, tenantId },
      });

      // 4. Remove the TenantMembership record
      await tx.tenantMembership.delete({
        where: { userId_tenantId: { userId, tenantId } },
      });

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: actor.id,
          action: 'REMOVE_MEMBER',
          resourceType: 'USER',
          resourceId: userId,
          oldValues: {
            email: membership.user?.email,
            name: membership.user?.name,
          },
        },
      });

      return {
        success: true,
        message: `User '${membership.user?.name || membership.user?.email}' has been removed from the organization.`,
      };
    });
  }
}
