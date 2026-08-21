import {
  BadRequestException,
  ConflictException,
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
            branchId,
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
              branchId,
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
}
