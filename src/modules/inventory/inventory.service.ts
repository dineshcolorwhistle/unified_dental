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
  CreateInventoryItemDto,
  QueryInventoryItemsDto,
  UpdateInventoryItemDto,
  InventoryItemStatus,
} from './dto/inventory.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

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
  ): Promise<string> {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);

    if (isTenantAdminUser) {
      if (!requestedBranchId || requestedBranchId === 'all') {
        const branchWhere: any = { tenantId, status: 'ACTIVE' };
        if (moduleKey) {
          branchWhere.moduleKey = moduleKey;
        }
        const firstBranch = await this.prisma.branch.findFirst({
          where: branchWhere,
        });
        if (!firstBranch) {
          throw new BadRequestException(
            moduleKey
              ? `No active ${moduleKey} branch found in organization.`
              : 'No active branch found in organization.',
          );
        }
        return firstBranch.id;
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
   * Normalizes a date string or Date to UTC noon to prevent timezone date shifts
   */
  private normalizeDateToUtcNoon(dateInput?: string | Date | null): Date | null {
    if (!dateInput) return null;

    let year: number;
    let month: number;
    let day: number;

    if (typeof dateInput === 'string') {
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateInput);
      if (match) {
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10) - 1;
        day = parseInt(match[3], 10);
      } else {
        const parsed = new Date(dateInput);
        if (isNaN(parsed.getTime())) {
          return null;
        }
        year = parsed.getUTCFullYear();
        month = parsed.getUTCMonth();
        day = parsed.getUTCDate();
      }
    } else {
      year = dateInput.getUTCFullYear();
      month = dateInput.getUTCMonth();
      day = dateInput.getUTCDate();
    }

    return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
  }

  /**
   * Auto-generate a unique SKU in format INV-YYYYMMDD-XXXX
   */
  async generateSku(tenantId: string): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const datePart = `${y}${m}${d}`;

    for (let i = 0; i < 10; i++) {
      const random4 = Math.floor(1000 + Math.random() * 9000);
      const skuCandidate = `INV-${datePart}-${random4}`;

      const existing = await (this.prisma as any).inventoryItem.findFirst({
        where: { tenantId, sku: skuCandidate },
        select: { id: true },
      });

      if (!existing) {
        return skuCandidate;
      }
    }

    return `INV-${datePart}-${Date.now().toString().slice(-4)}`;
  }

  /**
   * List Inventory Items with filters, pagination, and statistical summary
   */
  async findAll(
    query: QueryInventoryItemsDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const moduleKey = query.moduleKey;

    const where: any = {
      tenantId,
    };

    if (moduleKey) {
      where.moduleKey = moduleKey;
    }

    // Branch scoping
    if (!isTenantAdminUser) {
      const userBranchId = await this.resolveBranch(actor, tenantId, undefined, moduleKey);
      where.branchId = userBranchId;
    } else if (query.branchId && query.branchId !== 'all') {
      where.branchId = query.branchId;
    }

    // Category filter
    if (query.categoryId && query.categoryId !== 'all') {
      where.categoryId = query.categoryId;
    }

    // Status filter
    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }

    // Search filter
    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { supplier: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Low stock filter
    if (query.lowStockOnly) {
      where.OR = [
        { status: InventoryItemStatus.LOW_STOCK },
        { status: InventoryItemStatus.OUT_OF_STOCK },
      ];
    }

    // Pagination
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    // Fetch items and count
    const [items, totalMatching] = await Promise.all([
      (this.prisma as any).inventoryItem.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true, productType: true, status: true },
          },
          branch: {
            select: { id: true, name: true, code: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
      (this.prisma as any).inventoryItem.count({ where }),
    ]);

    // Calculate aggregated metrics for current filtered scope (tenant + module + branch scope)
    const metricsWhere: any = { tenantId };
    if (moduleKey) metricsWhere.moduleKey = moduleKey;
    if (where.branchId) metricsWhere.branchId = where.branchId;

    const allScopedItems = await (this.prisma as any).inventoryItem.findMany({
      where: metricsWhere,
      select: {
        quantity: true,
        minQuantity: true,
        unitPrice: true,
        status: true,
      },
    });

    let totalStockValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const it of allScopedItems) {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unitPrice) || 0;
      totalStockValue += qty * price;

      if (qty === 0 || it.status === InventoryItemStatus.OUT_OF_STOCK) {
        outOfStockCount++;
      } else if (qty <= it.minQuantity || it.status === InventoryItemStatus.LOW_STOCK) {
        lowStockCount++;
      }
    }

    const totalPages = Math.ceil(totalMatching / limit) || 1;

    return {
      items,
      pagination: {
        page,
        limit,
        totalItems: totalMatching,
        totalPages,
      },
      metrics: {
        totalItems: allScopedItems.length,
        totalStockValue,
        lowStockCount,
        outOfStockCount,
      },
    };
  }

  /**
   * Get single item by ID
   */
  async findOne(id: string, tenantId: string, actor: AuthenticatedUser) {
    const item = await (this.prisma as any).inventoryItem.findUnique({
      where: { id },
      include: {
        category: true,
        branch: {
          select: { id: true, name: true, code: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!item || item.tenantId !== tenantId) {
      throw new NotFoundException('Inventory item not found.');
    }

    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (!isTenantAdminUser) {
      const userBranchId = await this.resolveBranch(actor, tenantId, undefined, item.moduleKey);
      if (item.branchId !== userBranchId) {
        throw new ForbiddenException('Access denied to item belonging to another branch.');
      }
    }

    return item;
  }

  /**
   * Create Inventory Item (Branch operator only; Tenant Admin restricted)
   */
  async create(
    dto: CreateInventoryItemDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (isTenantAdminUser && !actor.isSuperAdmin) {
      throw new ForbiddenException('Tenant Administrator can only view and delete inventory items.');
    }

    const moduleKey = dto.moduleKey || 'LAB';
    const branchId = await this.resolveBranch(actor, tenantId, dto.branchId, moduleKey);

    // Verify category exists
    const category = await (this.prisma as any).inventoryCategory.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category || category.tenantId !== tenantId) {
      throw new BadRequestException('Selected category does not exist or does not belong to this organization.');
    }

    // Resolve or generate SKU
    let sku = dto.sku?.trim();
    if (!sku) {
      sku = await this.generateSku(tenantId);
    } else {
      const existingSku = await (this.prisma as any).inventoryItem.findFirst({
        where: { tenantId, sku },
      });
      if (existingSku) {
        throw new ConflictException(`An inventory item with SKU '${sku}' already exists.`);
      }
    }

    // Derive auto-status if not manually forced
    let status = dto.status || InventoryItemStatus.IN_STOCK;
    const quantity = Number(dto.quantity) || 0;
    const minQuantity = dto.minQuantity !== undefined ? Number(dto.minQuantity) : 5;

    if (status === InventoryItemStatus.IN_STOCK || !dto.status) {
      if (quantity === 0) {
        status = InventoryItemStatus.OUT_OF_STOCK;
      } else if (quantity <= minQuantity) {
        status = InventoryItemStatus.LOW_STOCK;
      }
    }

    const expiryDate = this.normalizeDateToUtcNoon(dto.expiryDate);

    return (this.prisma as any).inventoryItem.create({
      data: {
        tenantId,
        branchId,
        moduleKey,
        categoryId: dto.categoryId,
        name: dto.name.trim(),
        sku,
        status,
        quantity,
        minQuantity,
        unitPrice: new Decimal(dto.unitPrice || 0),
        brand: dto.brand?.trim() || null,
        supplier: dto.supplier?.trim() || null,
        expiryDate,
        description: dto.description?.trim() || null,
        createdById: actor.id,
      },
      include: {
        category: {
          select: { id: true, name: true, productType: true },
        },
        branch: {
          select: { id: true, name: true, code: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  /**
   * Update Inventory Item (Branch operator only; Tenant Admin restricted)
   */
  async update(
    id: string,
    dto: UpdateInventoryItemDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const item = await (this.prisma as any).inventoryItem.findUnique({
      where: { id },
    });

    if (!item || item.tenantId !== tenantId) {
      throw new NotFoundException('Inventory item not found.');
    }

    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (isTenantAdminUser && !actor.isSuperAdmin) {
      throw new ForbiddenException('Tenant Administrator can only view and delete inventory items.');
    }

    if (!isTenantAdminUser) {
      const userBranchId = await this.resolveBranch(actor, tenantId, undefined, item.moduleKey);
      if (item.branchId !== userBranchId) {
        throw new ForbiddenException('Cannot modify item belonging to another branch.');
      }
    }

    if (dto.sku && dto.sku.trim() !== item.sku) {
      const trimmedSku = dto.sku.trim();
      const existingSku = await (this.prisma as any).inventoryItem.findFirst({
        where: {
          tenantId,
          sku: trimmedSku,
          NOT: { id },
        },
      });
      if (existingSku) {
        throw new ConflictException(`An inventory item with SKU '${trimmedSku}' already exists.`);
      }
    }

    if (dto.categoryId && dto.categoryId !== item.categoryId) {
      const cat = await (this.prisma as any).inventoryCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!cat || cat.tenantId !== tenantId) {
        throw new BadRequestException('Selected category does not exist.');
      }
    }

    const expiryDate =
      dto.expiryDate !== undefined ? this.normalizeDateToUtcNoon(dto.expiryDate) : undefined;

    const quantity = dto.quantity !== undefined ? Number(dto.quantity) : item.quantity;
    const minQuantity =
      dto.minQuantity !== undefined ? Number(dto.minQuantity) : item.minQuantity;

    let status = dto.status !== undefined ? dto.status : item.status;
    // If not discontinued and status wasn't explicitly set to a special state
    if (status !== InventoryItemStatus.DISCONTINUED && !dto.status) {
      if (quantity === 0) {
        status = InventoryItemStatus.OUT_OF_STOCK;
      } else if (quantity <= minQuantity) {
        status = InventoryItemStatus.LOW_STOCK;
      } else {
        status = InventoryItemStatus.IN_STOCK;
      }
    }

    return (this.prisma as any).inventoryItem.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        sku: dto.sku ? dto.sku.trim() : undefined,
        categoryId: dto.categoryId ? dto.categoryId : undefined,
        status,
        quantity,
        minQuantity,
        unitPrice: dto.unitPrice !== undefined ? new Decimal(dto.unitPrice) : undefined,
        brand: dto.brand !== undefined ? dto.brand?.trim() || null : undefined,
        supplier: dto.supplier !== undefined ? dto.supplier?.trim() || null : undefined,
        expiryDate,
        description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
      },
      include: {
        category: {
          select: { id: true, name: true, productType: true },
        },
        branch: {
          select: { id: true, name: true, code: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  /**
   * Delete Inventory Item (Tenant Admin ONLY)
   */
  async remove(id: string, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (!isTenantAdminUser) {
      throw new ForbiddenException('Only Tenant Administrators can delete inventory items.');
    }

    const item = await (this.prisma as any).inventoryItem.findUnique({
      where: { id },
    });

    if (!item || item.tenantId !== tenantId) {
      throw new NotFoundException('Inventory item not found.');
    }

    return (this.prisma as any).inventoryItem.delete({
      where: { id },
    });
  }
}
