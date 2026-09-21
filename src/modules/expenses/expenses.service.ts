import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';
import { CreateExpenseDto, QueryExpensesDto, UpdateExpenseDto } from './dto/expenses.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

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
  private normalizeDateToUtcNoon(dateInput: string | Date): Date {
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
          throw new BadRequestException(`Invalid date format: ${dateInput}`);
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
   * List expenses with filters, pagination, and statistical summary
   */
  async findAll(
    query: QueryExpensesDto,
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

    // Search filter
    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { paymentMethod: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Date range filter
    if (query.startDate || query.endDate) {
      where.expenseDate = {};
      if (query.startDate) {
        // Start of day in UTC
        const sMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(query.startDate);
        if (sMatch) {
          where.expenseDate.gte = new Date(Date.UTC(parseInt(sMatch[1], 10), parseInt(sMatch[2], 10) - 1, parseInt(sMatch[3], 10), 0, 0, 0, 0));
        } else {
          where.expenseDate.gte = new Date(query.startDate);
        }
      }
      if (query.endDate) {
        // End of day in UTC
        const eMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(query.endDate);
        if (eMatch) {
          where.expenseDate.lte = new Date(Date.UTC(parseInt(eMatch[1], 10), parseInt(eMatch[2], 10) - 1, parseInt(eMatch[3], 10), 23, 59, 59, 999));
        } else {
          where.expenseDate.lte = new Date(query.endDate);
        }
      }
    }

    // Aggregate statistics across matching dataset
    const aggregations = await this.prisma.expense.aggregate({
      where,
      _sum: { amount: true },
      _avg: { amount: true },
      _count: { id: true },
    });

    const totalExpenses = aggregations._sum.amount ? Number(aggregations._sum.amount) : 0;
    const averageExpense = aggregations._avg.amount ? Number(aggregations._avg.amount) : 0;
    const expenseCount = aggregations._count.id;

    // Pagination
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const [expenses, totalMatching] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true },
          },
          branch: {
            select: { id: true, name: true, code: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      expenses,
      metrics: {
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        averageExpense: Math.round(averageExpense * 100) / 100,
        expenseCount,
      },
      pagination: {
        page,
        limit,
        total: totalMatching,
        totalPages: Math.ceil(totalMatching / limit) || 1,
      },
    };
  }

  /**
   * Get single expense by ID
   */
  async findOne(id: string, tenantId: string, actor: AuthenticatedUser) {
    const expense = await this.prisma.expense.findUnique({
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

    if (!expense || expense.tenantId !== tenantId) {
      throw new NotFoundException('Expense not found.');
    }

    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (!isTenantAdminUser) {
      const userBranchId = await this.resolveBranch(actor, tenantId, undefined, expense.moduleKey);
      if (expense.branchId !== userBranchId) {
        throw new ForbiddenException('Access denied to expense from another branch.');
      }
    }

    return expense;
  }

  /**
   * Create a new expense (Lab Admin auto-assigned; Tenant Admin can only view and delete)
   */
  async create(
    dto: CreateExpenseDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (isTenantAdminUser && !actor.isSuperAdmin) {
      throw new ForbiddenException('Tenant Administrator can only view and delete expenses.');
    }

    const moduleKey = dto.moduleKey || 'LAB';
    const branchId = await this.resolveBranch(actor, tenantId, dto.branchId, moduleKey);

    // Verify category
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category || category.tenantId !== tenantId) {
      throw new BadRequestException('Invalid expense category specified.');
    }

    const expenseDate = this.normalizeDateToUtcNoon(dto.expenseDate);

    return this.prisma.expense.create({
      data: {
        tenantId,
        branchId,
        moduleKey,
        categoryId: category.id,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        amount: new Decimal(dto.amount),
        expenseDate,
        paymentMethod: dto.paymentMethod.trim(),
        createdById: actor.id,
      },
      include: {
        category: {
          select: { id: true, name: true },
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
   * Update an existing expense (Lab Admin for their branch; Tenant Admin can only view and delete)
   */
  async update(
    id: string,
    dto: UpdateExpenseDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
    });

    if (!expense || expense.tenantId !== tenantId) {
      throw new NotFoundException('Expense not found.');
    }

    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (isTenantAdminUser && !actor.isSuperAdmin) {
      throw new ForbiddenException('Tenant Administrator can only view and delete expenses.');
    }

    if (!isTenantAdminUser) {
      const userBranchId = await this.resolveBranch(actor, tenantId, undefined, expense.moduleKey);
      if (expense.branchId !== userBranchId) {
        throw new ForbiddenException('Cannot modify expense belonging to another branch.');
      }
    }

    let branchId = expense.branchId;
    if (dto.branchId && isTenantAdminUser) {
      branchId = await this.resolveBranch(actor, tenantId, dto.branchId, expense.moduleKey);
    }

    if (dto.categoryId) {
      const category = await this.prisma.expenseCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category || category.tenantId !== tenantId) {
        throw new BadRequestException('Invalid expense category specified.');
      }
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        title: dto.title ? dto.title.trim() : undefined,
        description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
        categoryId: dto.categoryId || undefined,
        amount: dto.amount !== undefined ? new Decimal(dto.amount) : undefined,
        expenseDate: dto.expenseDate ? this.normalizeDateToUtcNoon(dto.expenseDate) : undefined,
        paymentMethod: dto.paymentMethod ? dto.paymentMethod.trim() : undefined,
        branchId: isTenantAdminUser ? branchId : undefined,
      },
      include: {
        category: {
          select: { id: true, name: true },
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
   * Delete an expense (Tenant Admin ONLY)
   */
  async remove(id: string, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (!isTenantAdminUser) {
      throw new ForbiddenException('Only Tenant Administrators can delete expenses.');
    }

    const expense = await this.prisma.expense.findUnique({
      where: { id },
    });

    if (!expense || expense.tenantId !== tenantId) {
      throw new NotFoundException('Expense not found.');
    }

    return this.prisma.expense.delete({
      where: { id },
    });
  }
}
