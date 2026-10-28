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
  CreateClinicWhatsappTemplateDto,
  UpdateClinicWhatsappTemplateDto,
  QueryClinicWhatsappTemplateDto,
} from './dto';

@Injectable()
export class ClinicWhatsappTemplatesService {
  private readonly logger = new Logger(ClinicWhatsappTemplatesService.name);

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
        return null; // Tenant admin sees all branches / global
      }
      const branch = await this.prisma.branch.findFirst({
        where: { id: requestedBranchId, tenantId, moduleKey: 'CLINIC' },
      });
      if (!branch) {
        throw new BadRequestException('Specified clinic branch is invalid.');
      }
      return branch.id;
    }

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
   * List all WhatsApp Templates for a clinic.
   */
  async findAll(
    tenantId: string,
    actor: AuthenticatedUser,
    query?: QueryClinicWhatsappTemplateDto,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    let targetBranchId: string | null = null;

    if (!isTenantAdminUser) {
      targetBranchId = await this.resolveClinicBranch(actor, tenantId);
    } else if (query?.branchId && query.branchId !== 'all') {
      targetBranchId = query.branchId;
    }

    const where: any = {
      tenantId,
      ...(targetBranchId ? { OR: [{ branchId: targetBranchId }, { branchId: null }] } : {}),
    };

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.search && query.search.trim()) {
      const q = query.search.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { message: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
    }

    return this.prisma.whatsappTemplate.findMany({
      where,
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Get single WhatsApp template by ID
   */
  async findOne(tenantId: string, id: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);

    const template = await this.prisma.whatsappTemplate.findFirst({
      where: { id, tenantId },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('WhatsApp template not found.');
    }

    if (!isTenantAdminUser && template.branchId) {
      const actorBranchId = await this.resolveClinicBranch(actor, tenantId);
      if (actorBranchId && template.branchId !== actorBranchId) {
        throw new ForbiddenException('You do not have access to this WhatsApp template.');
      }
    }

    return template;
  }

  /**
   * Create a new WhatsApp template
   */
  async create(
    dto: CreateClinicWhatsappTemplateDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isClinicAdminUser = await this.isClinicAdmin(actor, tenantId);

    if (!isTenantAdminUser && !isClinicAdminUser) {
      throw new ForbiddenException('Only Administrators can create WhatsApp templates.');
    }

    let branchId: string | null = null;
    if (isTenantAdminUser) {
      if (dto.branchId) {
        const branch = await this.prisma.branch.findFirst({
          where: { id: dto.branchId, tenantId, moduleKey: 'CLINIC' },
        });
        if (!branch) {
          throw new BadRequestException('Specified clinic branch does not exist.');
        }
        branchId = branch.id;
      }
    } else {
      branchId = await this.resolveClinicBranch(actor, tenantId);
    }

    const trimmedName = dto.name.trim();

    // Check duplicate name within the same tenant & branch
    const existing = await this.prisma.whatsappTemplate.findFirst({
      where: {
        tenantId,
        branchId,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(
        `A WhatsApp template with name "${trimmedName}" already exists for this clinic.`,
      );
    }

    return this.prisma.whatsappTemplate.create({
      data: {
        tenantId,
        branchId,
        name: trimmedName,
        message: dto.message.trim(),
        status: dto.status || 'ACTIVE',
        createdById: actor.id,
      },
      include: {
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
   * Update an existing WhatsApp template
   */
  async update(
    id: string,
    dto: UpdateClinicWhatsappTemplateDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    await this.findOne(tenantId, id, actor);

    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isClinicAdminUser = await this.isClinicAdmin(actor, tenantId);

    if (!isTenantAdminUser && !isClinicAdminUser) {
      throw new ForbiddenException('Only Administrators can update WhatsApp templates.');
    }

    const existing = await this.prisma.whatsappTemplate.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('WhatsApp template not found.');
    }

    const data: any = {};

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      const duplicate = await this.prisma.whatsappTemplate.findFirst({
        where: {
          tenantId,
          branchId: existing.branchId,
          name: { equals: trimmedName, mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          `A WhatsApp template with name "${trimmedName}" already exists for this clinic.`,
        );
      }
      data.name = trimmedName;
    }

    if (dto.message !== undefined) {
      data.message = dto.message.trim();
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    if (isTenantAdminUser && dto.branchId !== undefined) {
      if (dto.branchId) {
        const branch = await this.prisma.branch.findFirst({
          where: { id: dto.branchId, tenantId, moduleKey: 'CLINIC' },
        });
        if (!branch) {
          throw new BadRequestException('Specified clinic branch does not exist.');
        }
        data.branchId = branch.id;
      } else {
        data.branchId = null;
      }
    }

    return this.prisma.whatsappTemplate.update({
      where: { id },
      data,
      include: {
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
   * Delete a WhatsApp template
   */
  async remove(id: string, tenantId: string, actor: AuthenticatedUser) {
    await this.findOne(tenantId, id, actor);

    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isClinicAdminUser = await this.isClinicAdmin(actor, tenantId);

    if (!isTenantAdminUser && !isClinicAdminUser) {
      throw new ForbiddenException('Only Administrators can delete WhatsApp templates.');
    }

    return this.prisma.whatsappTemplate.delete({
      where: { id },
    });
  }
}
