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
import { CreateExpenseSubcategoryDto, UpdateExpenseSubcategoryDto } from './dto/expenses.dto';
import { ExpenseCategoriesService } from './expense-categories.service';

@Injectable()
export class ExpenseSubcategoriesService {
  private readonly logger = new Logger(ExpenseSubcategoriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: ExpenseCategoriesService,
  ) {}

  /**
   * Get all Expense Subcategories, optionally filtered by categoryId, branchId, moduleKey
   */
  async findAll(
    tenantId: string,
    actor: AuthenticatedUser,
    categoryId?: string,
    branchIdFilter?: string,
    moduleKey?: string,
  ) {
    const isTenantAdminUser = await this.categoriesService.isTenantAdmin(actor, tenantId);
    let resolvedBranchId: string | null = null;

    if (!isTenantAdminUser) {
      resolvedBranchId = await this.categoriesService.resolveBranch(actor, tenantId, undefined, moduleKey);
    } else if (branchIdFilter && branchIdFilter !== 'all') {
      resolvedBranchId = branchIdFilter;
    }

    const where: any = {
      tenantId,
    };

    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }

    if (moduleKey || resolvedBranchId) {
      where.category = {};
      if (moduleKey) {
        where.category.moduleKey = moduleKey;
      }
      if (resolvedBranchId) {
        where.category.OR = [
          { branchId: resolvedBranchId },
          { branchId: null },
        ];
      }
    }

    const subcategories = await this.prisma.expenseSubcategory.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, branchId: true, moduleKey: true },
        },
        _count: {
          select: { expenses: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Aggregate amounts per subcategory
    const expenseSums = await this.prisma.expense.groupBy({
      by: ['subcategoryId'],
      where: {
        tenantId,
        subcategoryId: { in: subcategories.map((s) => s.id) },
      },
      _sum: {
        amount: true,
      },
    });

    const sumMap = new Map<string, number>();
    for (const item of expenseSums) {
      if (item.subcategoryId) {
        sumMap.set(item.subcategoryId, item._sum.amount ? Number(item._sum.amount) : 0);
      }
    }

    return subcategories.map((sub) => ({
      ...sub,
      totalAmount: sumMap.get(sub.id) || 0,
    }));
  }

  /**
   * Create an Expense Subcategory
   */
  async create(
    dto: CreateExpenseSubcategoryDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const isTenantAdminUser = await this.categoriesService.isTenantAdmin(actor, tenantId);
    if (isTenantAdminUser && !actor.isSuperAdmin) {
      throw new ForbiddenException('Tenant Administrator can only view and delete expense categories/subcategories.');
    }

    // Verify parent category exists and belongs to this tenant
    const parentCategory = await this.prisma.expenseCategory.findUnique({
      where: { id: dto.categoryId },
    });

    if (!parentCategory || parentCategory.tenantId !== tenantId) {
      throw new NotFoundException('Parent expense category not found in this organization.');
    }

    if (!isTenantAdminUser) {
      const userBranchId = await this.categoriesService.resolveBranch(actor, tenantId, undefined, parentCategory.moduleKey);
      if (parentCategory.branchId && parentCategory.branchId !== userBranchId) {
        throw new ForbiddenException('Cannot add subcategory to an expense category belonging to another branch.');
      }
    }

    const trimmedName = dto.name.trim();

    // Duplicate check within parent category
    const existing = await this.prisma.expenseSubcategory.findFirst({
      where: {
        tenantId,
        categoryId: dto.categoryId,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Expense subcategory '${trimmedName}' already exists in category '${parentCategory.name}'.`,
      );
    }

    return this.prisma.expenseSubcategory.create({
      data: {
        tenantId,
        categoryId: dto.categoryId,
        name: trimmedName,
        description: dto.description?.trim() || null,
      },
      include: {
        category: {
          select: { id: true, name: true, branchId: true },
        },
      },
    });
  }

  /**
   * Update an Expense Subcategory
   */
  async update(
    id: string,
    dto: UpdateExpenseSubcategoryDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const subcategory = await this.prisma.expenseSubcategory.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!subcategory || subcategory.tenantId !== tenantId) {
      throw new NotFoundException('Expense subcategory not found.');
    }

    const isTenantAdminUser = await this.categoriesService.isTenantAdmin(actor, tenantId);
    if (isTenantAdminUser && !actor.isSuperAdmin) {
      throw new ForbiddenException('Tenant Administrator can only view and delete expense subcategories.');
    }

    if (!isTenantAdminUser) {
      const userBranchId = await this.categoriesService.resolveBranch(actor, tenantId, undefined, subcategory.category.moduleKey);
      if (subcategory.category.branchId && subcategory.category.branchId !== userBranchId) {
        throw new ForbiddenException('Cannot modify expense subcategory belonging to another branch.');
      }
    }

    if (dto.name) {
      const trimmedName = dto.name.trim();
      const existing = await this.prisma.expenseSubcategory.findFirst({
        where: {
          tenantId,
          categoryId: subcategory.categoryId,
          name: { equals: trimmedName, mode: 'insensitive' },
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException(
          `Expense subcategory '${trimmedName}' already exists in category '${subcategory.category.name}'.`,
        );
      }
    }

    return this.prisma.expenseSubcategory.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
      },
      include: {
        category: {
          select: { id: true, name: true, branchId: true },
        },
      },
    });
  }

  /**
   * Delete an Expense Subcategory (Tenant Admin ONLY)
   */
  async remove(id: string, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.categoriesService.isTenantAdmin(actor, tenantId);
    if (!isTenantAdminUser) {
      throw new ForbiddenException('Only Tenant Administrators can delete expense subcategories.');
    }

    const subcategory = await this.prisma.expenseSubcategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { expenses: true },
        },
      },
    });

    if (!subcategory || subcategory.tenantId !== tenantId) {
      throw new NotFoundException('Expense subcategory not found.');
    }

    if (subcategory._count.expenses > 0) {
      throw new ConflictException(
        `Cannot delete subcategory '${subcategory.name}' because it is currently linked to ${subcategory._count.expenses} expense(s). Please reassign or delete linked expenses first.`,
      );
    }

    return this.prisma.expenseSubcategory.delete({
      where: { id },
    });
  }
}

