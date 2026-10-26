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
import {
  CreateClinicPaymentMethodDto,
  UpdateClinicPaymentMethodDto,
  QueryClinicPaymentMethodsDto,
} from './dto';

@Injectable()
export class ClinicPaymentMethodsService {
  private readonly logger = new Logger(ClinicPaymentMethodsService.name);

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
   * Helper to verify if user is Clinic Admin
   */
  async isClinicAdmin(actor: AuthenticatedUser, tenantId: string): Promise<boolean> {
    const hasClinicAdminRole = actor.roles?.some((r: string) => {
      const lower = r.toLowerCase();
      return (
        lower === 'clinic-admin' ||
        lower.includes('clinic administrator') ||
        lower.includes('clinic admin')
      );
    });
    if (hasClinicAdminRole) return true;

    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: { slug: { in: ['clinic-admin'] } },
      },
    });

    return Boolean(userRole);
  }

  /**
   * Resolve branch ID for Clinic Admin, or validate provided branch ID for Tenant Admin
   */
  async resolveClinicBranch(
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
        where: { id: requestedBranchId, tenantId, moduleKey: 'CLINIC' },
      });
      if (!branch) {
        throw new BadRequestException('Specified clinic branch is invalid or does not belong to this organization.');
      }
      return branch.id;
    }

    // For Clinic Admin: Resolve from assigned role branch
    const clinicAdminRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: { slug: 'clinic-admin' },
      },
      include: { branch: true },
    });

    if (clinicAdminRole?.branchId) {
      return clinicAdminRole.branchId;
    }

    const userBranch = await this.prisma.userBranch.findFirst({
      where: {
        userId: actor.id,
        branch: { tenantId, moduleKey: 'CLINIC' },
      },
    });

    if (userBranch?.branchId) {
      return userBranch.branchId;
    }

    return null;
  }

  /**
   * List all Clinic Payment Methods in tenant organization.
   */
  async findAll(
    tenantId: string,
    actor: AuthenticatedUser,
    query?: QueryClinicPaymentMethodsDto,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isClinicAdminUser = await this.isClinicAdmin(actor, tenantId);

    if (!isTenantAdminUser && !isClinicAdminUser) {
      // Also allow staff/doctor read-only for payment methods (e.g. in expense creation)
      const isStaffOrDoctor = actor.roles?.some((r) => {
        const lower = r.toLowerCase();
        return lower.includes('clinic') || lower.includes('staff') || lower.includes('doctor');
      });
      if (!isStaffOrDoctor && !actor.isSuperAdmin) {
        throw new ForbiddenException('You do not have permission to view clinic payment methods.');
      }
    }

    let targetBranchId: string | null = null;
    if (!isTenantAdminUser) {
      targetBranchId = await this.resolveClinicBranch(actor, tenantId);
    } else if (query?.branchId && query.branchId !== 'all') {
      targetBranchId = query.branchId;
    }

    const where: any = {
      tenantId,
      moduleKey: 'CLINIC',
    };

    // Auto-seed default payment methods for target branch if clinic branch has 0 methods
    if (targetBranchId) {
      const branchCount = await this.prisma.paymentMethod.count({
        where: { tenantId, branchId: targetBranchId, moduleKey: 'CLINIC' },
      });
      if (branchCount === 0) {
        const defaultMethods = [
          { name: 'Cash', description: 'Cash payment / Efectivo en clínica' },
          { name: 'Credit Card', description: 'Credit card terminal / Terminal punto de venta' },
          { name: 'Debit Card', description: 'Debit card terminal / Tarjeta de Débito' },
          { name: 'Bank Transfer', description: 'SPEI / Electronic bank transfer' },
          { name: 'Insurance Co-pay', description: 'Dental Insurance / Seguro dental' },
        ];
        for (const dm of defaultMethods) {
          try {
            await this.prisma.paymentMethod.create({
              data: {
                tenantId,
                branchId: targetBranchId,
                moduleKey: 'CLINIC',
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
      where.branchId = targetBranchId;
    } else {
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
   * Find a single clinic payment method by ID
   */
  async findOne(tenantId: string, id: string, actor: AuthenticatedUser) {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id, tenantId, moduleKey: 'CLINIC' },
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    if (!method) {
      throw new NotFoundException(`Clinic payment method with ID "${id}" not found.`);
    }

    return method;
  }

  /**
   * Create a new Clinic Payment Method
   */
  async create(dto: CreateClinicPaymentMethodDto, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isClinicAdminUser = await this.isClinicAdmin(actor, tenantId);

    if (!isTenantAdminUser && !isClinicAdminUser) {
      throw new ForbiddenException('Only Clinic Administrators and Tenant Administrators can create payment methods.');
    }

    let branchId = dto.branchId ? dto.branchId.trim() : null;

    if (!isTenantAdminUser) {
      const clinicBranchId = await this.resolveClinicBranch(actor, tenantId);
      if (!clinicBranchId) {
        throw new ForbiddenException('User is not assigned to any Dental Clinic branch.');
      }
      branchId = clinicBranchId;
    } else {
      if (!branchId || branchId === 'all') {
        throw new BadRequestException('Branch is required. Payment methods must be scoped to a specific clinic branch.');
      }
      const branchExists = await this.prisma.branch.findFirst({
        where: { id: branchId, tenantId, moduleKey: 'CLINIC' },
      });
      if (!branchExists) {
        throw new BadRequestException('Selected clinic branch is invalid.');
      }
    }

    const trimmedName = dto.name.trim();

    // Check duplicate name within the same tenant, branch, and moduleKey
    const existing = await this.prisma.paymentMethod.findFirst({
      where: {
        tenantId,
        branchId,
        moduleKey: 'CLINIC',
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(
        `A payment method named "${trimmedName}" already exists for this clinic branch.`,
      );
    }

    const created = await this.prisma.paymentMethod.create({
      data: {
        tenantId,
        branchId,
        moduleKey: 'CLINIC',
        name: trimmedName,
        description: dto.description?.trim() || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    this.logger.log(`Clinic payment method "${created.name}" created by user ${actor.id}`);
    return created;
  }

  /**
   * Update a Clinic Payment Method
   */
  async update(
    id: string,
    dto: UpdateClinicPaymentMethodDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isClinicAdminUser = await this.isClinicAdmin(actor, tenantId);

    if (!isTenantAdminUser && !isClinicAdminUser) {
      throw new ForbiddenException('Only Clinic Administrators and Tenant Administrators can update payment methods.');
    }

    const existing = await this.findOne(tenantId, id, actor);

    // If Clinic Admin, check branch authorization
    if (!isTenantAdminUser) {
      const clinicBranchId = await this.resolveClinicBranch(actor, tenantId);
      if (existing.branchId && existing.branchId !== clinicBranchId) {
        throw new ForbiddenException('You can only update payment methods within your assigned clinic branch.');
      }
    }

    const updateData: any = {};

    if (dto.name !== undefined) {
      const trimmed = dto.name.trim();
      if (!trimmed) {
        throw new BadRequestException('Payment method name cannot be empty.');
      }

      const duplicate = await this.prisma.paymentMethod.findFirst({
        where: {
          tenantId,
          branchId: dto.branchId || existing.branchId,
          moduleKey: 'CLINIC',
          name: { equals: trimmed, mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          `A payment method named "${trimmed}" already exists for this clinic branch.`,
        );
      }

      updateData.name = trimmed;
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description?.trim() || null;
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    if (dto.branchId !== undefined && isTenantAdminUser) {
      const branchId = dto.branchId ? dto.branchId.trim() : null;
      if (branchId) {
        const branchExists = await this.prisma.branch.findFirst({
          where: { id: branchId, tenantId, moduleKey: 'CLINIC' },
        });
        if (!branchExists) {
          throw new BadRequestException('Selected clinic branch is invalid.');
        }
      }
      updateData.branchId = branchId;
    }

    const updated = await this.prisma.paymentMethod.update({
      where: { id },
      data: updateData,
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    this.logger.log(`Clinic payment method "${updated.name}" updated by user ${actor.id}`);
    return updated;
  }

  /**
   * Delete or deactivate a Clinic Payment Method (Tenant Admin ONLY)
   */
  async remove(id: string, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);

    if (!isTenantAdminUser) {
      throw new ForbiddenException('Only Tenant Administrators can delete payment methods.');
    }

    const existing = await this.findOne(tenantId, id, actor);

    // Check if used in expenses
    const usedInExpenses = await this.prisma.expense.count({
      where: {
        tenantId,
        paymentMethod: { equals: existing.name, mode: 'insensitive' },
      },
    });

    if (usedInExpenses > 0) {
      // Soft deactivate
      await this.prisma.paymentMethod.update({
        where: { id },
        data: { isActive: false },
      });
      return {
        success: true,
        deactivated: true,
        message: `Payment method "${existing.name}" is used in ${usedInExpenses} expense record(s). It has been deactivated instead of permanently deleted.`,
      };
    }

    await this.prisma.paymentMethod.delete({
      where: { id },
    });

    this.logger.log(`Clinic payment method "${existing.name}" permanently deleted by user ${actor.id}`);
    return {
      success: true,
      deactivated: false,
      message: `Payment method "${existing.name}" permanently removed.`,
    };
  }
}
