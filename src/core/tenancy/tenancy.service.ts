import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuthService } from '../auth/auth.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantStatus, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_TIMEZONE, DEFAULT_CURRENCY } from '../../shared/common/utils/timezone.util';

@Injectable()
export class TenancyService {
  private readonly logger = new Logger(TenancyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}



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

    const adminEmail = dto.adminEmail?.toLowerCase().trim();
    const adminName = dto.adminName?.trim();

    if (!adminEmail || !adminName) {
      throw new BadRequestException('Initial administrator name and email are required');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let modulesToEnable = dto.modules || [];
      let plan: any = null;
      if (dto.planId) {
        plan = await tx.subscriptionPlan.findUnique({ where: { id: dto.planId } });
        if (!plan) {
          throw new NotFoundException(`Subscription plan with ID '${dto.planId}' not found`);
        }
      }

      const effectiveMaxModules =
        dto.maxModules !== undefined && dto.maxModules !== null
          ? Number(dto.maxModules)
          : plan
          ? Number((plan as any).moduleCount) || 1
          : 1;

      if (modulesToEnable.length > effectiveMaxModules) {
        throw new BadRequestException(
          `Selected ${modulesToEnable.length} module(s), but maximum allowed is ${effectiveMaxModules} module(s).`,
        );
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

      // 1. Create tenant with planId and overrides
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug,
          status: dto.status || TenantStatus.ACTIVE,
          settings: {
            timezone: DEFAULT_TIMEZONE,
            currency: DEFAULT_CURRENCY,
            dateFormat: 'DD/MM/YYYY',
            timeFormat: '12h',
            ...(dto.settings || {}),
          },
          planId: dto.planId || undefined,
          maxBranches: dto.maxBranches !== undefined ? (dto.maxBranches === null ? null : Number(dto.maxBranches)) : undefined,
          maxMembers: dto.maxMembers !== undefined ? (dto.maxMembers === null ? null : Number(dto.maxMembers)) : undefined,
          maxUploadFileSizeMb: dto.maxUploadFileSizeMb !== undefined ? (dto.maxUploadFileSizeMb === null ? null : Number(dto.maxUploadFileSizeMb)) : undefined,
          maxModules: dto.maxModules !== undefined ? (dto.maxModules === null ? null : Number(dto.maxModules)) : undefined,
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

      // 3. Create Initial Tenant Administrator User
      const initialPassword = dto.adminPassword?.trim() || uuidv4();
      const passwordHash = await bcrypt.hash(initialPassword, 10);
      const adminUser = await tx.user.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
          email: adminEmail,
          passwordHash,
          name: adminName,
          locale: dto.locale || 'en',
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

      // Find tenant-admin role and assign tenant-wide (branchId: null)
      const tenantAdminRole = await tx.role.findFirst({ where: { slug: 'tenant-admin' } });
      if (tenantAdminRole) {
        await tx.userRole.create({
          data: {
            userId: adminUser.id,
            tenantId: tenant.id,
            branchId: null,
            roleId: tenantAdminRole.id,
          },
        });
      }

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          branchId: null,
          userId: creatorUserId,
          action: 'CREATE_TENANT',
          resourceType: 'TENANT',
          resourceId: tenant.id,
          newValues: {
            name: tenant.name,
            slug: tenant.slug,
            planId: tenant.planId,
            modules: modulesToEnable,
            adminEmail,
            adminName,
          },
        },
      });

      return { tenantId: tenant.id, adminUserId: adminUser.id, adminEmail, adminName };
    });

    // 5. Send Welcome Email (outside transaction to avoid blocking DB on email delivery)
    if (result.adminUserId && result.adminEmail) {
      try {
        const resetToken = await this.authService.generatePasswordResetToken(result.adminUserId);
        await this.mailService.sendWelcomeInvite(
          result.adminEmail,
          result.adminName,
          dto.name,
          resetToken,
          dto.locale,
          slug,
        );
        this.logger.log(`✉️ Welcome email sent to tenant admin: ${result.adminEmail} (locale: ${dto.locale || 'en'}, slug: ${slug})`);
      } catch (error) {
        this.logger.warn(`Failed to send welcome email to ${result.adminEmail}: ${error.message}`);
        // Don't fail tenant creation if email fails
      }
    }

    return this.findById(result.tenantId);
  }

  async update(id: string, dto: UpdateTenantDto, userId?: string) {
    const tenant = await this.findById(id);

    const targetPlanId = dto.planId !== undefined ? dto.planId : tenant.planId;
    let targetModules = dto.modules !== undefined
      ? dto.modules
      : tenant.modules.filter((m) => m.isEnabled).map((m) => m.moduleKey);

    let plan: any = null;
    if (targetPlanId) {
      plan = await this.prisma.subscriptionPlan.findUnique({
        where: { id: targetPlanId },
      });
    }

    const effectiveMaxModules =
      dto.maxModules !== undefined && dto.maxModules !== null
        ? Number(dto.maxModules)
        : tenant.maxModules !== null && tenant.maxModules !== undefined && dto.maxModules === undefined
        ? Number(tenant.maxModules)
        : plan
        ? Number((plan as any)?.moduleCount) || 1
        : 1;

    if (targetModules.length > effectiveMaxModules) {
      throw new BadRequestException(
        `Tenant cannot have ${targetModules.length} enabled module(s). Maximum allowed is ${effectiveMaxModules} module(s).`,
      );
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
        maxBranches: dto.maxBranches !== undefined ? (dto.maxBranches === null ? null : Number(dto.maxBranches)) : undefined,
        maxMembers: dto.maxMembers !== undefined ? (dto.maxMembers === null ? null : Number(dto.maxMembers)) : undefined,
        maxUploadFileSizeMb: dto.maxUploadFileSizeMb !== undefined ? (dto.maxUploadFileSizeMb === null ? null : Number(dto.maxUploadFileSizeMb)) : undefined,
        maxModules: dto.maxModules !== undefined ? (dto.maxModules === null ? null : Number(dto.maxModules)) : undefined,
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

  async updateSettings(id: string, settings: Record<string, any>, userId?: string) {
    const tenant = await this.findById(id);

    const currentSettings = (tenant.settings as Record<string, any>) || {};
    const mergedSettings = {
      timezone: DEFAULT_TIMEZONE,
      currency: DEFAULT_CURRENCY,
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12h',
      ...currentSettings,
      ...settings,
    };

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        settings: mergedSettings,
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
        action: 'UPDATE_TENANT_SETTINGS',
        resourceType: 'TENANT',
        resourceId: id,
        oldValues: currentSettings,
        newValues: mergedSettings,
      },
    });

    return updated;
  }

  async delete(id: string, userId?: string) {
    const tenant = await this.findById(id);

    await this.prisma.auditLog.create({
      data: {
        tenantId: id,
        userId,
        action: 'DELETE_TENANT',
        resourceType: 'TENANT',
        resourceId: id,
        oldValues: {
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
          planId: tenant.planId,
        },
      },
    });

    // Delete tenant (cascades to branches, memberships, modules, etc. per Prisma schema)
    await this.prisma.tenant.delete({
      where: { id },
    });

    return {
      success: true,
      message: `Tenant '${tenant.name}' has been deleted successfully`,
    };
  }
}

