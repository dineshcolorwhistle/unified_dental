import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateSubscriptionPlanDto } from './dto/create-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-plan.dto';

@Injectable()
export class SubscriptionPlanService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(activeOnly = false) {
    return this.prisma.subscriptionPlan.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { tenants: true },
        },
      },
    });
  }

  async findById(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: { tenants: true },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Subscription plan with ID '${id}' not found`);
    }

    return plan;
  }

  async findByCode(code: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { code: code.toUpperCase().trim() },
      include: {
        _count: {
          select: { tenants: true },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Subscription plan with code '${code}' not found`);
    }

    return plan;
  }

  async create(dto: CreateSubscriptionPlanDto, userId?: string) {
    const code = dto.code.toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_');

    const existing = await this.prisma.subscriptionPlan.findUnique({
      where: { code },
    });

    if (existing) {
      throw new ConflictException(`Subscription plan with code '${code}' already exists`);
    }

    const planData: any = {
      name: dto.name.trim(),
      code,
      description: dto.description?.trim() || null,
      moduleCount: dto.moduleCount !== undefined ? Number(dto.moduleCount) : 1,
      branchCount: dto.branchCount !== undefined ? Number(dto.branchCount) : 3,
      memberCount: dto.memberCount !== undefined ? Number(dto.memberCount) : 10,
      maxUploadFileSizeMb: dto.maxUploadFileSizeMb !== undefined ? Number(dto.maxUploadFileSizeMb) : 25,
      modules: dto.modules || [],
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    };

    const created = await this.prisma.subscriptionPlan.create({
      data: planData,
      include: {
        _count: {
          select: { tenants: true },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE_SUBSCRIPTION_PLAN',
        resourceType: 'SUBSCRIPTION_PLAN',
        resourceId: created.id,
        newValues: created as any,
      },
    });

    return created;
  }

  async update(id: string, dto: UpdateSubscriptionPlanDto, userId?: string) {
    const existing = await this.findById(id);

    const updateData: any = {
      name: dto.name !== undefined ? dto.name.trim() : existing.name,
      description: dto.description !== undefined ? dto.description.trim() : existing.description,
      moduleCount: dto.moduleCount !== undefined ? Number(dto.moduleCount) : (existing as any).moduleCount || 1,
      branchCount: dto.branchCount !== undefined ? Number(dto.branchCount) : (existing as any).branchCount || 3,
      memberCount: dto.memberCount !== undefined ? Number(dto.memberCount) : (existing as any).memberCount || 10,
      maxUploadFileSizeMb: dto.maxUploadFileSizeMb !== undefined ? Number(dto.maxUploadFileSizeMb) : (existing as any).maxUploadFileSizeMb || 25,
      modules: dto.modules !== undefined ? dto.modules : existing.modules,
      isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
    };

    const updated = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { tenants: true },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE_SUBSCRIPTION_PLAN',
        resourceType: 'SUBSCRIPTION_PLAN',
        resourceId: id,
        oldValues: existing as any,
        newValues: updated as any,
      },
    });

    return updated;
  }

  async delete(id: string, userId?: string) {
    const existing = await this.findById(id);

    if (existing._count && existing._count.tenants > 0) {
      throw new BadRequestException(
        `Cannot delete subscription plan '${existing.name}' because it is assigned to ${existing._count.tenants} tenant(s). Reassign them first or deactivate the plan.`,
      );
    }

    const deleted = await this.prisma.subscriptionPlan.delete({
      where: { id },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'DELETE_SUBSCRIPTION_PLAN',
        resourceType: 'SUBSCRIPTION_PLAN',
        resourceId: id,
        oldValues: existing as any,
      },
    });

    return deleted;
  }
}
