import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CreateClinicTypeDto } from './dto/create-clinic-type.dto';
import { UpdateClinicTypeDto } from './dto/update-clinic-type.dto';

function nameToCode(name: string): string {
  return name
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9\s_]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');
}

@Injectable()
export class ClinicTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive = true) {
    const types = await this.prisma.clinicType.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: {
        _count: {
          select: {
            tenants: true,
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return types.map((t) => ({
      ...t,
      tenantCount: t._count.tenants,
    }));
  }

  async findById(id: string) {
    const clinicType = await this.prisma.clinicType.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            tenants: true,
          },
        },
      },
    });

    if (!clinicType) {
      throw new NotFoundException(`Clinic type with ID '${id}' not found`);
    }

    return {
      ...clinicType,
      tenantCount: clinicType._count.tenants,
    };
  }

  async findByCode(code: string) {
    const clinicType = await this.prisma.clinicType.findUnique({
      where: { code: code.toUpperCase().trim() },
      include: {
        _count: {
          select: {
            tenants: true,
          },
        },
      },
    });

    if (!clinicType) {
      throw new NotFoundException(`Clinic type with code '${code}' not found`);
    }

    return {
      ...clinicType,
      tenantCount: clinicType._count.tenants,
    };
  }

  async create(dto: CreateClinicTypeDto, userId?: string) {
    const code = (dto.code || nameToCode(dto.name)).toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_');

    const existing = await this.prisma.clinicType.findUnique({
      where: { code },
    });

    if (existing) {
      throw new ConflictException(`Clinic type with code '${code}' already exists`);
    }

    // Always enforce 'dashboard' is enabled
    const features = Array.from(new Set(['dashboard', ...(dto.features || [])]));

    if (dto.isDefault) {
      await this.prisma.clinicType.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await this.prisma.clinicType.create({
      data: {
        name: dto.name.trim(),
        code,
        description: dto.description?.trim() || null,
        icon: dto.icon?.trim() || 'Stethoscope',
        features,
        isDefault: dto.isDefault ?? false,
        isActive: dto.isActive ?? true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE_CLINIC_TYPE',
        resourceType: 'CLINIC_TYPE',
        resourceId: created.id,
        moduleKey: 'CLINIC',
        newValues: created as any,
      },
    });

    return created;
  }

  async update(id: string, dto: UpdateClinicTypeDto, userId?: string) {
    const existing = await this.findById(id);

    // If features are updated, always preserve 'dashboard'
    let features = existing.features;
    if (dto.features !== undefined) {
      features = Array.from(new Set(['dashboard', ...dto.features]));
    }

    if (dto.isDefault && !existing.isDefault) {
      await this.prisma.clinicType.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.clinicType.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : existing.name,
        description: dto.description !== undefined ? dto.description.trim() : existing.description,
        icon: dto.icon !== undefined ? dto.icon.trim() : existing.icon,
        features,
        isDefault: dto.isDefault !== undefined ? dto.isDefault : existing.isDefault,
        isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE_CLINIC_TYPE',
        resourceType: 'CLINIC_TYPE',
        resourceId: id,
        moduleKey: 'CLINIC',
        oldValues: existing as any,
        newValues: updated as any,
      },
    });

    return updated;
  }

  async delete(id: string, userId?: string) {
    const existing = await this.findById(id);

    // Safety Check 1: Cannot delete the default clinic type
    if (existing.isDefault) {
      throw new BadRequestException(
        `Cannot delete the default clinic type '${existing.name}'. Please designate another clinic type as default before deleting this one.`,
      );
    }

    // Safety Check 2: Cannot delete if any tenants are associated
    const associatedTenantsCount = await this.prisma.tenant.count({
      where: { clinicTypeId: id },
    });

    if (associatedTenantsCount > 0) {
      throw new BadRequestException(
        `Cannot delete clinic type '${existing.name}' because it is actively assigned to ${associatedTenantsCount} organization(s). Please reassign those organizations to another clinic type before deleting.`,
      );
    }

    const deleted = await this.prisma.clinicType.delete({
      where: { id },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'DELETE_CLINIC_TYPE',
        resourceType: 'CLINIC_TYPE',
        resourceId: id,
        moduleKey: 'CLINIC',
        oldValues: existing as any,
      },
    });

    return deleted;
  }
}
