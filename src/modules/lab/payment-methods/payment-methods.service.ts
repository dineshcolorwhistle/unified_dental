import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto, QueryPaymentMethodsDto } from './dto';

@Injectable()
export class PaymentMethodsService {
  private readonly logger = new Logger(PaymentMethodsService.name);

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
   * Resolve branch ID for Lab Admin, or validate provided branch ID for Tenant Admin
   */
  async resolveLabBranch(
    actor: AuthenticatedUser,
    tenantId: string,
    requestedBranchId?: string,
  ): Promise<string | null> {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);

    if (isTenantAdminUser) {
      if (!requestedBranchId || requestedBranchId === 'all') {
        return null;
      }

      const branch = await this.prisma.branch.findFirst({
        where: { id: requestedBranchId, tenantId },
      });
      if (!branch) {
        throw new BadRequestException('Specified branch is invalid or does not belong to this organization.');
      }
      return branch.id;
    }

    // For Lab Admin: Resolve from assigned role branch
    const labAdminRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: { slug: 'lab-admin' },
      },
      include: { branch: true },
    });

    if (labAdminRole?.branchId) {
      return labAdminRole.branchId;
    }

    const userBranch = await this.prisma.userBranch.findFirst({
      where: {
        userId: actor.id,
        branch: { tenantId, moduleKey: 'LAB' },
      },
    });

    if (userBranch?.branchId) {
      return userBranch.branchId;
    }

    return null;
  }

  /**
   * List all Payment Methods in tenant organization.
   * Scoped by branch for Lab Admins, filtered or all for Tenant Admins.
   */
  async findAll(
    tenantId: string,
    actor: AuthenticatedUser,
    query?: QueryPaymentMethodsDto,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    let targetBranchId: string | null = null;

    if (!isTenantAdminUser) {
      targetBranchId = await this.resolveLabBranch(actor, tenantId);
    } else if (query?.branchId && query.branchId !== 'all') {
      targetBranchId = query.branchId;
    }

    const where: any = {
      tenantId,
      moduleKey: query?.moduleKey || 'LAB',
    };

    // 1. Auto-migrate legacy payment methods where branchId is null
    const nullMethods = await this.prisma.paymentMethod.findMany({
      where: { tenantId, branchId: null },
    });
    if (nullMethods.length > 0) {
      const tenantBranches = await this.prisma.branch.findMany({
        where: { tenantId },
      });
      for (const br of tenantBranches) {
        for (const nm of nullMethods) {
          const exists = await this.prisma.paymentMethod.findFirst({
            where: { tenantId, branchId: br.id, name: { equals: nm.name, mode: 'insensitive' } },
          });
          if (!exists) {
            try {
              await this.prisma.paymentMethod.create({
                data: {
                  tenantId,
                  branchId: br.id,
                  moduleKey: nm.moduleKey,
                  name: nm.name,
                  description: nm.description,
                  isActive: nm.isActive,
                },
              });
            } catch {}
          }
        }
      }
      await this.prisma.paymentMethod.deleteMany({
        where: { tenantId, branchId: null },
      });
    }

    // 2. Resolve target branch ID (strictly scoped)
    if (!targetBranchId) {
      if (!isTenantAdminUser) {
        targetBranchId = await this.resolveLabBranch(actor, tenantId);
      } else if (query?.branchId && query.branchId !== 'all') {
        targetBranchId = query.branchId;
      }
    }

    // 3. Auto-seed default payment methods for target branch if branch has 0 methods
    if (targetBranchId) {
      const branchCount = await this.prisma.paymentMethod.count({
        where: { tenantId, branchId: targetBranchId },
      });
      if (branchCount === 0) {
        const defaultMethods = [
          { name: 'Cash', description: 'Cash payment / Efectivo' },
          { name: 'Credit Card', description: 'Credit card payment / Tarjeta de Crédito' },
          { name: 'Debit Card', description: 'Debit card payment / Tarjeta de Débito' },
          { name: 'Bank Transfer', description: 'Electronic bank transfer / SPEI / Transferencia' },
          { name: 'Check', description: 'Bank check / Cheque' },
        ];
        for (const dm of defaultMethods) {
          try {
            await this.prisma.paymentMethod.create({
              data: {
                tenantId,
                branchId: targetBranchId,
                moduleKey: query?.moduleKey || 'LAB',
                name: dm.name,
                description: dm.description,
                isActive: true,
              },
            });
          } catch {}
        }
      }
    }

    if (query?.activeOnly === true || query?.activeOnly === 'true') {
      where.isActive = true;
    }

    if (targetBranchId) {
      // Strictly scoped to target branch
      where.branchId = targetBranchId;
    } else {
      // Exclude null branchId
      where.branchId = { not: null };
    }

    if (query?.search && query.search.trim().length > 0) {
      const q = query.search.trim();
      const searchCondition = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
      if (where.OR) {
        where.AND = [{ OR: searchCondition }];
      } else {
        where.OR = searchCondition;
      }
    }

    const items = await this.prisma.paymentMethod.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ name: 'asc' }],
    });

    return items;
  }

  /**
   * Find a single payment method by ID
   */
  async findOne(tenantId: string, id: string, actor: AuthenticatedUser) {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id, tenantId },
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    if (!method) {
      throw new NotFoundException(`Payment method with ID "${id}" not found.`);
    }

    return method;
  }

  /**
   * Create a new Payment Method
   */
  async create(dto: CreatePaymentMethodDto, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    let branchId = dto.branchId ? dto.branchId.trim() : null;

    if (!isTenantAdminUser) {
      const labBranchId = await this.resolveLabBranch(actor, tenantId);
      if (!labBranchId) {
        throw new ForbiddenException('User is not assigned to any Dental Lab branch.');
      }
      branchId = labBranchId;
    } else {
      if (!branchId || branchId === 'all') {
        throw new BadRequestException('Branch is required. Payment methods must be scoped to a specific branch.');
      }
      const branchExists = await this.prisma.branch.findFirst({
        where: { id: branchId, tenantId },
      });
      if (!branchExists) {
        throw new BadRequestException('Selected branch is invalid.');
      }
    }

    const trimmedName = dto.name.trim();

    // Check duplicate name within the same tenant & branch
    const existing = await this.prisma.paymentMethod.findFirst({
      where: {
        tenantId,
        branchId,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(
        `A payment method named "${trimmedName}" already exists for this branch.`,
      );
    }

    const created = await this.prisma.paymentMethod.create({
      data: {
        tenantId,
        branchId,
        moduleKey: 'LAB',
        name: trimmedName,
        description: dto.description?.trim() || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    this.logger.log(`Payment method "${created.name}" created by user ${actor.id}`);
    return created;
  }

  /**
   * Update a Payment Method
   */
  async update(
    id: string,
    dto: UpdatePaymentMethodDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.prisma.paymentMethod.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Payment method with ID "${id}" not found.`);
    }

    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (!isTenantAdminUser && existing.branchId) {
      const userBranchId = await this.resolveLabBranch(actor, tenantId);
      if (existing.branchId !== userBranchId) {
        throw new ForbiddenException('You do not have permission to modify payment methods of other branches.');
      }
    }

    let branchId = existing.branchId;
    if (isTenantAdminUser && dto.branchId !== undefined && dto.branchId.trim() !== '') {
      branchId = dto.branchId.trim();
    }

    const trimmedName = dto.name !== undefined ? dto.name.trim() : existing.name;

    // Check conflict if name or branchId changed
    if (trimmedName !== existing.name || branchId !== existing.branchId) {
      const duplicate = await this.prisma.paymentMethod.findFirst({
        where: {
          tenantId,
          branchId,
          id: { not: id },
          name: { equals: trimmedName, mode: 'insensitive' },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          `A payment method named "${trimmedName}" already exists for this branch.`,
        );
      }
    }

    const updated = await this.prisma.paymentMethod.update({
      where: { id },
      data: {
        name: trimmedName,
        description: dto.description !== undefined ? dto.description?.trim() || null : existing.description,
        branchId,
        isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    this.logger.log(`Payment method "${updated.name}" updated by user ${actor.id}`);
    return updated;
  }

  /**
   * Delete a Payment Method
   */
  async remove(id: string, tenantId: string, actor: AuthenticatedUser) {
    const existing = await this.prisma.paymentMethod.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Payment method with ID "${id}" not found.`);
    }

    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (!isTenantAdminUser && existing.branchId) {
      const userBranchId = await this.resolveLabBranch(actor, tenantId);
      if (existing.branchId !== userBranchId) {
        throw new ForbiddenException('You do not have permission to delete payment methods of other branches.');
      }
    }

    // Check if referenced by expenses or work order payments
    const [linkedExpenses, linkedPayments] = await Promise.all([
      this.prisma.expense.count({
        where: { tenantId, paymentMethod: existing.name },
      }),
      this.prisma.workOrderPayment.count({
        where: { paymentMethod: existing.name },
      }),
    ]);

    if (linkedExpenses > 0 || linkedPayments > 0) {
      // Soft-deactivate instead of throwing hard error to preserve audit trails
      await this.prisma.paymentMethod.update({
        where: { id },
        data: { isActive: false },
      });
      return {
        success: true,
        deactivated: true,
        message: `Payment method "${existing.name}" is used in ${linkedExpenses} expense(s) and ${linkedPayments} payment(s), so it was deactivated instead of deleted.`,
      };
    }

    await this.prisma.paymentMethod.delete({
      where: { id },
    });

    this.logger.log(`Payment method "${existing.name}" deleted by user ${actor.id}`);
    return {
      success: true,
      message: `Payment method "${existing.name}" has been deleted.`,
    };
  }
}
