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
    return this.prisma.systemModule.findMany({
      where: includeDisabled ? undefined : { isEnabled: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string) {
    const module = await this.prisma.systemModule.findUnique({
      where: { id },
    });

    if (!module) {
      throw new NotFoundException(`Module with ID '${id}' not found`);
    }

    return module;
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

    // Check if any tenants currently have this module active
    const activeTenantsCount = await this.prisma.tenantModule.count({
      where: { moduleKey: existing.code, isEnabled: true },
    });

    if (activeTenantsCount > 0) {
      throw new BadRequestException(
        `Cannot delete module '${existing.name}' because it is actively enabled in ${activeTenantsCount} tenant(s). Disable it first or remove it from tenants.`,
      );
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
