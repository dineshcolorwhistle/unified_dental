import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ToggleModuleDto } from './dto/toggle-module.dto';

@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeDisabled = true) {
    const modules = await this.prisma.systemModule.findMany({
      where: includeDisabled ? undefined : { isEnabled: true },
      orderBy: { createdAt: 'asc' },
    });

    const clinicTypesCount = await this.prisma.clinicType.count();

    return Promise.all(
      modules.map(async (m) => {
        const tenantCount = await this.prisma.tenantModule.count({
          where: { moduleKey: m.code },
        });
        return {
          ...m,
          tenantCount,
          clinicTypesCount: m.code === 'CLINIC' ? clinicTypesCount : 0,
        };
      }),
    );
  }

  async findById(id: string) {
    const module = await this.prisma.systemModule.findUnique({
      where: { id },
    });

    if (!module) {
      throw new NotFoundException(`Module with ID '${id}' not found`);
    }

    const tenantCount = await this.prisma.tenantModule.count({
      where: { moduleKey: module.code },
    });
    const clinicTypesCount = module.code === 'CLINIC' ? await this.prisma.clinicType.count() : 0;

    return {
      ...module,
      tenantCount,
      clinicTypesCount,
    };
  }

  async findByCode(code: string) {
    const module = await this.prisma.systemModule.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!module) {
      throw new NotFoundException(`Module with code '${code}' not found`);
    }

    return module;
  }

  async create(dto: CreateModuleDto, userId?: string) {
    const code = dto.code.toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_');

    const existing = await this.prisma.systemModule.findUnique({
      where: { code },
    });

    if (existing) {
      throw new ConflictException(`Module with code '${code}' already exists`);
    }

    const created = await this.prisma.systemModule.create({
      data: {
        name: dto.name.trim(),
        code,
        description: dto.description?.trim() || null,
        isEnabled: dto.isEnabled !== undefined ? dto.isEnabled : true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE_SYSTEM_MODULE',
        resourceType: 'SYSTEM_MODULE',
        resourceId: created.id,
        moduleKey: created.code,
        newValues: created as any,
      },
    });

    return created;
  }

  async update(id: string, dto: UpdateModuleDto, userId?: string) {
    const existing = await this.findById(id);

    const updated = await this.prisma.systemModule.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : existing.name,
        description: dto.description !== undefined ? dto.description.trim() : existing.description,
        isEnabled: dto.isEnabled !== undefined ? dto.isEnabled : existing.isEnabled,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE_SYSTEM_MODULE',
        resourceType: 'SYSTEM_MODULE',
        resourceId: id,
        moduleKey: existing.code,
        oldValues: existing as any,
        newValues: updated as any,
      },
    });

    return updated;
  }

  async toggleStatus(id: string, isEnabled: boolean, userId?: string) {
    const existing = await this.findById(id);

    const updated = await this.prisma.systemModule.update({
      where: { id },
      data: { isEnabled },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: isEnabled ? 'ENABLE_SYSTEM_MODULE' : 'DISABLE_SYSTEM_MODULE',
        resourceType: 'SYSTEM_MODULE',
        resourceId: id,
        moduleKey: existing.code,
        newValues: { isEnabled },
      },
    });

    return updated;
  }

  async delete(id: string, userId?: string) {
    const existing = await this.findById(id);

    // 1. Check if ANY tenants have this module associated
    const associatedTenantsCount = await this.prisma.tenantModule.count({
      where: { moduleKey: existing.code },
    });

    if (associatedTenantsCount > 0) {
      throw new BadRequestException(
        `Cannot delete system module '${existing.name}' because it is associated with ${associatedTenantsCount} organization(s). Remove it from all organizations first.`,
      );
    }

    // 2. Specific safeguard for CLINIC: Cannot delete if any Clinic Types exist
    if (existing.code === 'CLINIC') {
      const associatedClinicTypesCount = await this.prisma.clinicType.count();
      if (associatedClinicTypesCount > 0) {
        throw new BadRequestException(
          `Cannot delete system module 'CLINIC' because ${associatedClinicTypesCount} clinic type(s) are defined under it (e.g. Dental Clinic). Please delete all clinic types first.`,
        );
      }
    }

    const deleted = await this.prisma.systemModule.delete({
      where: { id },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'DELETE_SYSTEM_MODULE',
        resourceType: 'SYSTEM_MODULE',
        resourceId: id,
        moduleKey: existing.code,
        oldValues: existing as any,
      },
    });

    return deleted;
  }

  async getTenantModules(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        modules: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    const systemModules = await this.findAll(true);

    return systemModules.map((m) => {
      const active = tenant.modules.find((tm) => tm.moduleKey === m.code);
      return {
        id: m.id,
        key: m.code,
        code: m.code,
        name: m.name,
        description: m.description,
        isSystemEnabled: m.isEnabled,
        isEnabled: active ? active.isEnabled : false,
        enabledAt: active ? active.enabledAt : null,
        config: active ? active.config : {},
      };
    });
  }

  async toggleModule(dto: ToggleModuleDto, userId?: string) {
    const { tenantId, moduleKey, isEnabled, config } = dto;

    if (isEnabled) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { plan: true, modules: true },
      });
      if (tenant) {
        const allowedCount =
          tenant.maxModules !== null && tenant.maxModules !== undefined
            ? Number(tenant.maxModules)
            : tenant.plan?.moduleCount !== null && tenant.plan?.moduleCount !== undefined
            ? Number(tenant.plan.moduleCount)
            : 1;
        const currentlyActiveCount = tenant.modules.filter(
          (m) => m.isEnabled && m.moduleKey !== moduleKey,
        ).length;
        if (currentlyActiveCount + 1 > allowedCount) {
          throw new BadRequestException(
            `Cannot enable module '${moduleKey}'. Organization is limited to a maximum of ${allowedCount} module(s). Please upgrade the subscription plan or request a limit override.`,
          );
        }
      }
    }

    const moduleRecord = await this.prisma.tenantModule.upsert({
      where: {
        tenantId_moduleKey: {
          tenantId,
          moduleKey,
        },
      },
      update: {
        isEnabled,
        enabledAt: isEnabled ? new Date() : undefined,
        config: config || undefined,
      },
      create: {
        tenantId,
        moduleKey,
        isEnabled,
        enabledAt: isEnabled ? new Date() : null,
        config: config || {},
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: isEnabled ? 'ENABLE_MODULE' : 'DISABLE_MODULE',
        resourceType: 'TENANT_MODULE',
        resourceId: moduleRecord.id,
        moduleKey,
        newValues: { isEnabled, config },
      },
    });

    return moduleRecord;
  }
}
