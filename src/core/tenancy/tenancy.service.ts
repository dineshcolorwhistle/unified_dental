import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantStatus, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TenancyService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(search?: string) {
    return this.prisma.tenant.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: {
        plan: true,
        modules: true,
        branches: {
          select: {
            id: true,
            name: true,
            isDefault: true,
            status: true,
          },
        },
        _count: {
          select: {
            memberships: true,
            branches: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: slug.toLowerCase() },
      include: {
        plan: true,
        modules: true,
        branches: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with slug '${slug}' not found`);
    }

    return tenant;
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        plan: true,
        modules: true,
        branches: true,
        _count: {
          select: {
            memberships: true,
            branches: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID '${id}' not found`);
    }

    return tenant;
  }

  async create(dto: CreateTenantDto, creatorUserId?: string) {
    const slug = dto.slug.toLowerCase().trim();

    // Check slug uniqueness
    const existing = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Tenant subdomain '${slug}' is already in use`);
    }

    return this.prisma.$transaction(async (tx) => {
      let modulesToEnable = dto.modules || [];
      if (dto.planId) {
        const plan = await tx.subscriptionPlan.findUnique({ where: { id: dto.planId } });
        if (!plan) {
          throw new NotFoundException(`Subscription plan with ID '${dto.planId}' not found`);
        }
        const maxAllowed = Number((plan as any).moduleCount) || 1;
        if (modulesToEnable.length > maxAllowed) {
          throw new BadRequestException(
            `Selected ${modulesToEnable.length} module(s), but subscription plan '${plan.name}' allows at most ${maxAllowed} module(s).`,
          );
        }
      }

      if (modulesToEnable.length > 0) {
        const activeSystemModules = await tx.systemModule.findMany({
          where: { code: { in: modulesToEnable }, isEnabled: true },
        });
        const activeCodes = activeSystemModules.map((m) => m.code);
        const disabledModules = modulesToEnable.filter((m) => !activeCodes.includes(m));
        if (disabledModules.length > 0) {
          throw new BadRequestException(
            `Cannot activate disabled system module(s): ${disabledModules.join(', ')}. Enable them in System Modules first.`,
          );
        }
      }

      // 1. Create tenant with planId
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug,
          status: dto.status || TenantStatus.ACTIVE,
          settings: dto.settings || {},
          planId: dto.planId || undefined,
        },
      });

      // 2. Enable selected modules
      for (const mod of modulesToEnable) {
        await tx.tenantModule.create({
          data: {
            tenantId: tenant.id,
            moduleKey: mod,
            isEnabled: true,
          },
        });
      }

      // 3. Create default branch
      const defaultBranch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: 'Main Branch',
          code: 'MAIN-01',
          isDefault: true,
        },
      });

      // 4. Create Initial Tenant Admin User if provided
      if (dto.adminEmail) {
        const passwordHash = await bcrypt.hash(dto.adminPassword || 'Admin@123456', 10);
        const adminUser = await tx.user.upsert({
          where: { email: dto.adminEmail.toLowerCase().trim() },
          update: {},
          create: {
            email: dto.adminEmail.toLowerCase().trim(),
            passwordHash,
            name: dto.adminName || 'Tenant Administrator',
            status: UserStatus.ACTIVE,
          },
        });

        // Add Tenant Membership as Owner
        await tx.tenantMembership.create({
          data: {
            userId: adminUser.id,
            tenantId: tenant.id,
            isOwner: true,
            status: UserStatus.ACTIVE,
          },
        });

        // Assign default branch
        await tx.userBranch.create({
          data: {
            userId: adminUser.id,
            branchId: defaultBranch.id,
            isDefault: true,
          },
        });

        // Grant access to selected modules
        for (const mod of modulesToEnable) {
          await tx.userModuleAccess.create({
            data: {
              userId: adminUser.id,
              tenantId: tenant.id,
              moduleKey: mod,
              isActive: true,
            },
          });
        }

        // Find tenant-admin role
        const tenantAdminRole = await tx.role.findFirst({ where: { slug: 'tenant-admin' } });
        if (tenantAdminRole) {
          await tx.userRole.create({
            data: {
              userId: adminUser.id,
              tenantId: tenant.id,
              branchId: defaultBranch.id,
              roleId: tenantAdminRole.id,
            },
          });
        }
      }

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          branchId: defaultBranch.id,
          userId: creatorUserId,
          action: 'CREATE_TENANT',
          resourceType: 'TENANT',
          resourceId: tenant.id,
          newValues: {
            name: tenant.name,
            slug: tenant.slug,
            planId: tenant.planId,
            modules: modulesToEnable,
          },
        },
      });

      return this.findById(tenant.id);
    });
  }

  async update(id: string, dto: UpdateTenantDto, userId?: string) {
    const tenant = await this.findById(id);

    const targetPlanId = dto.planId !== undefined ? dto.planId : tenant.planId;
    let targetModules = dto.modules !== undefined
      ? dto.modules
      : tenant.modules.filter((m) => m.isEnabled).map((m) => m.moduleKey);

    if (targetPlanId) {
      const plan = await this.prisma.subscriptionPlan.findUnique({
        where: { id: targetPlanId },
      });
      const maxAllowed = Number((plan as any)?.moduleCount) || 1;
      if (plan && targetModules.length > maxAllowed) {
        throw new BadRequestException(
          `Tenant cannot have ${targetModules.length} enabled module(s). Subscription plan '${plan.name}' allows at most ${maxAllowed} module(s).`,
        );
      }
    }

    // If explicit modules array is provided, synchronize tenant modules
    if (dto.modules !== undefined) {
      for (const existingMod of tenant.modules) {
        if (!dto.modules.includes(existingMod.moduleKey) && existingMod.isEnabled) {
          await this.prisma.tenantModule.update({
            where: { id: existingMod.id },
            data: { isEnabled: false },
          });
        }
      }
      for (const modKey of dto.modules) {
        await this.prisma.tenantModule.upsert({
          where: { tenantId_moduleKey: { tenantId: id, moduleKey: modKey } },
          update: { isEnabled: true },
          create: { tenantId: id, moduleKey: modKey, isEnabled: true },
        });
      }
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        name: dto.name,
        status: dto.status,
        planId: dto.planId !== undefined ? dto.planId : undefined,
        settings: dto.settings ? { ...(tenant.settings as object || {}), ...dto.settings } : undefined,
      },
      include: {
        plan: true,
        modules: true,
        branches: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: id,
        userId,
        action: 'UPDATE_TENANT',
        resourceType: 'TENANT',
        resourceId: id,
        oldValues: tenant as any,
        newValues: updated as any,
      },
    });

    return updated;
  }
}
