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

  async findAllForTenant(tenantId: string) {
    return this.prisma.branch.findMany({
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
  }

  async findById(id: string, tenantId?: string) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id,
        tenantId: tenantId || undefined,
      },
      include: {
        userBranches: {
          include: { user: true },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }

    return branch;
  }

  async create(dto: CreateBranchDto, currentTenantId?: string, actorId?: string) {
    const tenantId = dto.tenantId || currentTenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required to create a branch');
    }

    return this.prisma.$transaction(async (tx) => {
      // If marking as default, unset other defaults
      if (dto.isDefault) {
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
          isDefault: dto.isDefault || false,
          status: dto.status || 'ACTIVE',
          settings: dto.settings || {},
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
            isDefault: false,
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
          newValues: { name: branch.name, code: branch.code },
        },
      });

      return branch;
    });
  }

  async update(id: string, dto: UpdateBranchDto, currentTenantId?: string, actorId?: string) {
    const branch = await this.findById(id, currentTenantId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.branch.updateMany({
          where: { tenantId: branch.tenantId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

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
          settings: dto.settings ? { ...(branch.settings as object || {}), ...dto.settings } : undefined,
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
}
