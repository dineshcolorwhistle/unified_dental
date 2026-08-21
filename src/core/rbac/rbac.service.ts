import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/rbac.dto';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllPermissions() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    });

    // Group permissions by group name
    const grouped: Record<string, typeof permissions> = {};
    for (const p of permissions) {
      if (!grouped[p.group]) {
        grouped[p.group] = [];
      }
      grouped[p.group].push(p);
    }

    return {
      permissions,
      grouped,
    };
  }

  async getRolesForTenant(tenantId?: string) {
    return this.prisma.role.findMany({
      where: {
        OR: [
          { isSystem: true },
          tenantId ? { tenantId } : { tenantId: null },
        ],
      },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: {
          select: { userRoles: true },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async createRole(dto: CreateRoleDto, tenantId?: string, actorId?: string) {
    const slug = dto.slug.toLowerCase().trim();

    const existing = await this.prisma.role.findFirst({
      where: {
        slug,
        tenantId: tenantId || null,
      },
    });

    if (existing) {
      throw new ConflictException(`Role with slug '${slug}' already exists in this scope`);
    }

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          tenantId: tenantId || null,
          name: dto.name,
          slug,
          description: dto.description,
          moduleKey: dto.moduleKey,
          isSystem: false,
        },
      });

      if (dto.permissionIds && dto.permissionIds.length > 0) {
        for (const permissionId of dto.permissionIds) {
          await tx.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId,
            },
          });
        }
      }

      if (tenantId) {
        await tx.auditLog.create({
          data: {
            tenantId,
            userId: actorId,
            action: 'CREATE_ROLE',
            resourceType: 'ROLE',
            resourceId: role.id,
            newValues: { name: role.name, permissionsCount: dto.permissionIds?.length },
          },
        });
      }

      return tx.role.findUnique({
        where: { id: role.id },
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      });
    });
  }

  async updateRole(id: string, dto: UpdateRoleDto, tenantId?: string, actorId?: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    if (role.isSystem) {
      throw new BadRequestException('System-defined default roles cannot be modified');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
        },
      });

      if (dto.permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        for (const permissionId of dto.permissionIds) {
          await tx.rolePermission.create({
            data: {
              roleId: id,
              permissionId,
            },
          });
        }
      }

      if (tenantId) {
        await tx.auditLog.create({
          data: {
            tenantId,
            userId: actorId,
            action: 'UPDATE_ROLE',
            resourceType: 'ROLE',
            resourceId: id,
            newValues: dto as any,
          },
        });
      }

      return tx.role.findUnique({
        where: { id },
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      });
    });
  }
}
