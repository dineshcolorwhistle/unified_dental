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
  CreateServiceDto,
  UpdateServiceDto,
  QueryServicesDto,
} from './dto';

@Injectable()
export class ClinicServicesService {
  private readonly logger = new Logger(ClinicServicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to verify if actor has Tenant Administrator or Super Admin privileges
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
   * Helper to verify if actor has Clinic Administrator privileges
   */
  async isClinicAdmin(actor: AuthenticatedUser, tenantId: string): Promise<boolean> {
    if (actor.isSuperAdmin) return true;

    const hasClinicAdminRole = actor.roles?.some((r: string) => {
      const lower = r.toLowerCase();
      return lower === 'clinic-admin' || lower === 'clinic admin' || lower.includes('clinic administrator');
    });
    if (hasClinicAdminRole) return true;

    const clinicAdminRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: { slug: { in: ['clinic-admin'] } },
      },
    });

    return Boolean(clinicAdminRole);
  }

  /**
   * Resolve clinic branch for non-tenant-admin users.
   */
  async resolveClinicBranch(
    actor: AuthenticatedUser,
    tenantId: string,
    requestedBranchId?: string,
  ): Promise<string | null> {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);

    if (isTenantAdminUser) {
      if (!requestedBranchId || requestedBranchId === 'all') {
        return null; // Tenant admin sees all branches
      }
      const branch = await this.prisma.branch.findFirst({
        where: { id: requestedBranchId, tenantId, moduleKey: 'CLINIC' },
      });
      if (!branch) {
        throw new BadRequestException('Specified clinic branch is invalid.');
      }
      return branch.id;
    }

    // Clinic admin: resolve from assigned branch
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

    return userBranch?.branchId || null;
  }

  /**
   * List all Services for a tenant.
   */
  async findAll(
    tenantId: string,
    actor: AuthenticatedUser,
    query?: QueryServicesDto,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isClinicAdminUser = await this.isClinicAdmin(actor, tenantId);

    if (!isTenantAdminUser && !isClinicAdminUser) {
      const isStaffOrDoctor = actor.roles?.some((r) => {
        const lower = r.toLowerCase();
        return lower.includes('clinic') || lower.includes('staff') || lower.includes('doctor');
      });
      if (!isStaffOrDoctor && !actor.isSuperAdmin) {
        throw new ForbiddenException('You do not have permission to view services.');
      }
    }

    let targetBranchId: string | null = null;
    if (!isTenantAdminUser) {
      targetBranchId = await this.resolveClinicBranch(actor, tenantId);
    } else if (query?.branchId && query.branchId !== 'all') {
      targetBranchId = query.branchId;
    }

    const where: any = { tenantId };

    if (targetBranchId) {
      where.branchId = targetBranchId;
    }

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.search) {
      const q = query.search.trim();
      if (q) {
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ];
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.service.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Get a single Service by ID.
   */
  async findOne(tenantId: string, id: string, actor: AuthenticatedUser) {
    const record = await this.prisma.service.findFirst({
      where: { id, tenantId },
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    if (!record) {
      throw new NotFoundException('Service not found.');
    }

    return record;
  }

  /**
   * Create a new Service.
   */
  async create(dto: CreateServiceDto, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isClinicAdminUser = await this.isClinicAdmin(actor, tenantId);

    if (!isTenantAdminUser && !isClinicAdminUser) {
      throw new ForbiddenException('Only Tenant Admins or Clinic Admins can create services.');
    }

    const trimmedName = dto.name.trim();

    // Resolve branch
    let branchId: string | null = null;
    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, tenantId, moduleKey: 'CLINIC' },
      });
      if (!branch) {
        throw new BadRequestException('Specified clinic branch is invalid.');
      }
      branchId = branch.id;
    } else if (!isTenantAdminUser) {
      branchId = await this.resolveClinicBranch(actor, tenantId);
    }

    // Check uniqueness within tenant+branch
    const existing = await this.prisma.service.findFirst({
      where: {
        tenantId,
        branchId,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(`A service named "${trimmedName}" already exists in this branch.`);
    }

    const record = await this.prisma.service.create({
      data: {
        tenantId,
        branchId,
        name: trimmedName,
        description: dto.description?.trim() || null,
        price: dto.price,
        status: 'ACTIVE',
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    this.logger.log(`Service "${record.name}" created by user ${actor.id} in tenant ${tenantId}`);
    return record;
  }

  /**
   * Update an existing Service.
   */
  async update(id: string, dto: UpdateServiceDto, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isClinicAdminUser = await this.isClinicAdmin(actor, tenantId);

    if (!isTenantAdminUser && !isClinicAdminUser) {
      throw new ForbiddenException('Only Tenant Admins or Clinic Admins can update services.');
    }

    const existing = await this.prisma.service.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Service not found.');
    }

    // Name uniqueness check if name changed
    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      const duplicate = await this.prisma.service.findFirst({
        where: {
          tenantId,
          branchId: existing.branchId,
          name: { equals: trimmedName, mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new ConflictException(`A service named "${trimmedName}" already exists in this branch.`);
      }
    }

    const record = await this.prisma.service.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    this.logger.log(`Service "${record.name}" updated by user ${actor.id}`);
    return record;
  }

  /**
   * Delete a Service.
   */
  async remove(id: string, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isClinicAdminUser = await this.isClinicAdmin(actor, tenantId);

    if (!isTenantAdminUser && !isClinicAdminUser) {
      throw new ForbiddenException('Only Tenant Admins or Clinic Admins can delete services.');
    }

    const existing = await this.prisma.service.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Service not found.');
    }

    await this.prisma.service.delete({ where: { id } });

    this.logger.log(`Service "${existing.name}" deleted by user ${actor.id}`);
    return { success: true, message: `Service "${existing.name}" has been deleted.` };
  }
}
