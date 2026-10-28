import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';
import {
  CreateSpecializationDto,
  UpdateSpecializationDto,
  QuerySpecializationsDto,
} from './dto';

@Injectable()
export class SpecializationsService {
  private readonly logger = new Logger(SpecializationsService.name);

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
   * List all Specializations for a tenant.
   */
  async findAll(
    tenantId: string,
    actor: AuthenticatedUser,
    query?: QuerySpecializationsDto,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isClinicAdminUser = await this.isClinicAdmin(actor, tenantId);

    if (!isTenantAdminUser && !isClinicAdminUser) {
      // Allow staff/doctor read-only
      const isStaffOrDoctor = actor.roles?.some((r) => {
        const lower = r.toLowerCase();
        return lower.includes('clinic') || lower.includes('staff') || lower.includes('doctor');
      });
      if (!isStaffOrDoctor && !actor.isSuperAdmin) {
        throw new ForbiddenException('You do not have permission to view specializations.');
      }
    }

    const where: any = { tenantId };

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
      this.prisma.specialization.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.specialization.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Get a single Specialization by ID.
   */
  async findOne(tenantId: string, id: string, actor: AuthenticatedUser) {
    const record = await this.prisma.specialization.findFirst({
      where: { id, tenantId },
    });

    if (!record) {
      throw new NotFoundException('Specialization not found.');
    }

    return record;
  }

  /**
   * Create a new Specialization.
   */
  async create(dto: CreateSpecializationDto, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isClinicAdminUser = await this.isClinicAdmin(actor, tenantId);

    if (!isTenantAdminUser && !isClinicAdminUser) {
      throw new ForbiddenException('Only Tenant Admins or Clinic Admins can create specializations.');
    }

    const trimmedName = dto.name.trim();

    // Check uniqueness within tenant
    const existing = await this.prisma.specialization.findFirst({
      where: { tenantId, name: { equals: trimmedName, mode: 'insensitive' } },
    });

    if (existing) {
      throw new ConflictException(`A specialization named "${trimmedName}" already exists.`);
    }

    const record = await this.prisma.specialization.create({
      data: {
        tenantId,
        name: trimmedName,
        description: dto.description?.trim() || null,
        status: 'ACTIVE',
      },
    });

    this.logger.log(`Specialization "${record.name}" created by user ${actor.id} in tenant ${tenantId}`);
    return record;
  }

  /**
   * Update an existing Specialization.
   */
  async update(id: string, dto: UpdateSpecializationDto, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isClinicAdminUser = await this.isClinicAdmin(actor, tenantId);

    if (!isTenantAdminUser && !isClinicAdminUser) {
      throw new ForbiddenException('Only Tenant Admins or Clinic Admins can update specializations.');
    }

    const existing = await this.prisma.specialization.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Specialization not found.');
    }

    // Name uniqueness check if name changed
    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      const duplicate = await this.prisma.specialization.findFirst({
        where: {
          tenantId,
          name: { equals: trimmedName, mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new ConflictException(`A specialization named "${trimmedName}" already exists.`);
      }
    }

    const record = await this.prisma.specialization.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });

    this.logger.log(`Specialization "${record.name}" updated by user ${actor.id}`);
    return record;
  }

  /**
   * Delete a Specialization.
   */
  async remove(id: string, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isClinicAdminUser = await this.isClinicAdmin(actor, tenantId);

    if (!isTenantAdminUser && !isClinicAdminUser) {
      throw new ForbiddenException('Only Tenant Admins or Clinic Admins can delete specializations.');
    }

    const existing = await this.prisma.specialization.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Specialization not found.');
    }

    await this.prisma.specialization.delete({ where: { id } });

    this.logger.log(`Specialization "${existing.name}" deleted by user ${actor.id}`);
    return { success: true, message: `Specialization "${existing.name}" has been deleted.` };
  }
}
