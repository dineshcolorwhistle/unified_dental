import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';
import {
  CreateInventoryCategoryDto,
  UpdateInventoryCategoryDto,
  ProductType,
  CategoryStatus,
} from './dto/inventory.dto';

@Injectable()
export class InventoryCategoriesService {
  private readonly logger = new Logger(InventoryCategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to verify if user is Tenant Admin or Super Admin
   */
  async isTenantAdmin(actor: AuthenticatedUser, tenantId: string): Promise<boolean> {
    if (actor.isSuperAdmin) return true;

    const isOwnerMem = (actor as any).memberships?.some(
      (m: any) => m.tenantId === tenantId && m.isOwner,
    );
    if (isOwnerMem) return true;

    const hasAdminRole = actor.roles?.some((r: string) => {
      const lower = r.toLowerCase();
      return (
        lower === 'tenant-admin' ||
        lower.includes('tenant administrator') ||
        lower.includes('tenant admin')
      );
    });
    if (hasAdminRole) return true;

    const membership = await this.prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId: actor.id, tenantId } },
    });
    if (membership?.isOwner) return true;

    const userAdminRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: { slug: { in: ['tenant-admin', 'admin', 'administrator'] } },
      },
    });

    return Boolean(userAdminRole);
  }

  /**
   * Resolve branch ID for Branch User, or validate provided branch ID for Tenant Admin
   */
  async resolveBranch(
    actor: AuthenticatedUser,
    tenantId: string,
    requestedBranchId?: string,
    moduleKey?: string,
  ): Promise<string | null> {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);

    if (isTenantAdminUser) {
      if (!requestedBranchId || requestedBranchId === 'all') {
        return null;
      }

      const branchWhere: any = { id: requestedBranchId, tenantId };
      if (moduleKey) {
        branchWhere.moduleKey = moduleKey;
      }
      const branch = await this.prisma.branch.findFirst({
        where: branchWhere,
      });
      if (!branch) {
        throw new BadRequestException(
          moduleKey
            ? `Specified branch is invalid or does not belong to ${moduleKey} module.`
            : 'Specified branch is invalid or does not belong to this organization.',
        );
      }
      return branch.id;
    }

    // For Branch Admin / User: Resolve from assigned role branch or user branches
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        branch: moduleKey ? { tenantId, moduleKey } : { tenantId },
      },
      include: { branch: true },
    });

    if (userRole?.branchId) {
      return userRole.branchId;
    }

    const userBranch = await this.prisma.userBranch.findFirst({
      where: {
        userId: actor.id,
        branch: moduleKey ? { tenantId, moduleKey } : { tenantId },
      },
    });

    if (userBranch?.branchId) {
      return userBranch.branchId;
    }

    throw new ForbiddenException(
      moduleKey
        ? `User is not assigned to any ${moduleKey} branch.`
        : 'User is not assigned to any branch in this organization.',
    );
  }

  /**
   * Get all Inventory Categories
   */
  async findAll(
    tenantId: string,
    actor: AuthenticatedUser,
    branchIdFilter?: string,
    moduleKey?: string,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    let resolvedBranchId: string | null = null;

    if (!isTenantAdminUser) {
      resolvedBranchId = await this.resolveBranch(actor, tenantId, undefined, moduleKey);
    } else if (branchIdFilter && branchIdFilter !== 'all') {
      resolvedBranchId = branchIdFilter;
    }

    const where: any = {
      tenantId,
    };

    if (moduleKey) {
      where.moduleKey = moduleKey;
    }

    if (resolvedBranchId) {
      where.OR = [
        { branchId: resolvedBranchId },
        { branchId: null }, // organization-wide categories
      ];
    }

    return (this.prisma as any).inventoryCategory.findMany({
      where,
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create an Inventory Category (Branch Operator only; Tenant Admin can only view and delete)
   */
  async create(
    dto: CreateInventoryCategoryDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (isTenantAdminUser && !actor.isSuperAdmin) {
      throw new ForbiddenException('Tenant Administrator can only view and delete inventory categories.');
    }

    const moduleKey = dto.moduleKey || 'LAB';
    const branchId = await this.resolveBranch(actor, tenantId, dto.branchId, moduleKey);

    const trimmedName = dto.name.trim();

    // Check duplicate
    const existing = await (this.prisma as any).inventoryCategory.findFirst({
      where: {
        tenantId,
        branchId,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(`Inventory category '${trimmedName}' already exists in this branch.`);
    }

    return (this.prisma as any).inventoryCategory.create({
      data: {
        tenantId,
        branchId,
        moduleKey,
        name: trimmedName,
        productType: dto.productType || ProductType.FOR_USE,
        status: dto.status || CategoryStatus.ACTIVE,
        description: dto.description?.trim() || null,
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  /**
   * Update an Inventory Category (Branch Operator only; Tenant Admin can only view and delete)
   */
  async update(
    id: string,
    dto: UpdateInventoryCategoryDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const category = await (this.prisma as any).inventoryCategory.findUnique({
      where: { id },
    });

    if (!category || category.tenantId !== tenantId) {
      throw new NotFoundException('Inventory category not found.');
    }

    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (isTenantAdminUser && !actor.isSuperAdmin) {
      throw new ForbiddenException('Tenant Administrator can only view and delete inventory categories.');
    }

    if (!isTenantAdminUser) {
      const userBranchId = await this.resolveBranch(actor, tenantId, undefined, category.moduleKey);
      if (category.branchId && category.branchId !== userBranchId) {
        throw new ForbiddenException('Cannot modify inventory category belonging to another branch.');
      }
    }

    if (dto.name) {
      const trimmedName = dto.name.trim();
      const existing = await (this.prisma as any).inventoryCategory.findFirst({
        where: {
          tenantId,
          branchId: category.branchId,
          name: { equals: trimmedName, mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (existing) {
        throw new ConflictException(`Inventory category '${trimmedName}' already exists in this branch.`);
      }
    }

    return (this.prisma as any).inventoryCategory.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        productType: dto.productType ? dto.productType : undefined,
        status: dto.status ? dto.status : undefined,
        description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  /**
   * Delete an Inventory Category (Tenant Admin ONLY)
   */
  async remove(id: string, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (!isTenantAdminUser) {
      throw new ForbiddenException('Only Tenant Administrators can delete inventory categories.');
    }

    const category = await (this.prisma as any).inventoryCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    if (!category || category.tenantId !== tenantId) {
      throw new NotFoundException('Inventory category not found.');
    }

    if (category._count.items > 0) {
      throw new ConflictException(
        `Cannot delete category '${category.name}' because it is currently linked to ${category._count.items} inventory item(s). Please reassign or delete linked items first.`,
      );
    }

    return (this.prisma as any).inventoryCategory.delete({
      where: { id },
    });
  }
}
