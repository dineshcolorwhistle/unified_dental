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
  CreateWhatsappTemplateDto,
  UpdateWhatsappTemplateDto,
  QueryWhatsappTemplatesDto,
} from './dto';
import { WhatsappTemplateStatus } from '@prisma/client';

@Injectable()
export class WhatsappTemplatesService {
  private readonly logger = new Logger(WhatsappTemplatesService.name);

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
   * Helper to verify if actor has Lab Administrator privileges
   */
  isLabAdmin(actor: AuthenticatedUser): boolean {
    return Boolean(
      actor.roles?.some((r: string) => {
        const lower = r.toLowerCase();
        return (
          lower === 'lab-admin' ||
          lower === 'lab admin' ||
          lower.includes('lab administrator') ||
          lower.includes('lab admin')
        );
      }),
    );
  }

  /**
   * Resolve branch ID for Lab Admin or validate requested branch ID for Tenant Admin
   */
  async resolveLabBranch(
    actor: AuthenticatedUser,
    tenantId: string,
    requestedBranchId?: string,
  ): Promise<string | null> {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);

    if (isTenantAdminUser) {
      if (!requestedBranchId || requestedBranchId === 'all') {
        const firstLab = await this.prisma.branch.findFirst({
          where: { tenantId, moduleKey: 'LAB', status: 'ACTIVE' },
        });
        return firstLab?.id || null;
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
   * List all WhatsApp Templates in tenant organization
   */
  async findAll(
    tenantId: string,
    actor: AuthenticatedUser,
    query?: QueryWhatsappTemplatesDto,
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
   * Get single WhatsApp Template by ID
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
      throw new NotFoundException(`WhatsApp Template with ID "${id}" not found.`);
    }

    if (!isTenantAdminUser && template.branchId) {
      const labBranchId = await this.resolveLabBranch(actor, tenantId);
      if (labBranchId && template.branchId !== labBranchId) {
        throw new ForbiddenException('You do not have access to templates for other branches.');
      }
    }

    return template;
  }

  /**
   * Create a new WhatsApp Template
   */
  async create(dto: CreateWhatsappTemplateDto, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isLabAdminUser = this.isLabAdmin(actor);

    if (!isTenantAdminUser && !isLabAdminUser) {
      throw new ForbiddenException('Only Lab Administrators and Tenant Administrators can create WhatsApp templates.');
    }

    const branchId = await this.resolveLabBranch(actor, tenantId, dto.branchId);

    // Duplicate check within organization & branch
    const duplicate = await this.prisma.whatsappTemplate.findFirst({
      where: {
        tenantId,
        branchId: branchId || null,
        name: { equals: dto.name.trim(), mode: 'insensitive' },
      },
    });

    if (duplicate) {
      throw new ConflictException(
        `A WhatsApp template named "${dto.name.trim()}" already exists.`,
      );
    }

    const template = await this.prisma.$transaction(async (tx) => {
      const created = await tx.whatsappTemplate.create({
        data: {
          tenantId,
          branchId,
          name: dto.name.trim(),
          status: dto.status || WhatsappTemplateStatus.ACTIVE,
          message: dto.message.trim(),
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

      await tx.auditLog.create({
        data: {
          tenantId,
          branchId,
          userId: actor.id,
          action: 'CREATE_WHATSAPP_TEMPLATE',
          resourceType: 'WHATSAPP_TEMPLATE',
          resourceId: created.id,
          moduleKey: 'LAB',
          newValues: {
            name: created.name,
            status: created.status,
            message: created.message,
            branchId,
          },
        },
      });

      return created;
    });

    this.logger.log(`WhatsApp Template "${template.name}" (${template.id}) created by user ${actor.id}`);
    return template;
  }

  /**
   * Update an existing WhatsApp Template
   */
  async update(
    id: string,
    dto: UpdateWhatsappTemplateDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.findOne(tenantId, id, actor);
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);

    let finalBranchId = existing.branchId;
    if (isTenantAdminUser && dto.branchId !== undefined) {
      finalBranchId = dto.branchId || null;
    }

    if (dto.name && dto.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.prisma.whatsappTemplate.findFirst({
        where: {
          tenantId,
          branchId: finalBranchId,
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          `A WhatsApp template named "${dto.name.trim()}" already exists.`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.whatsappTemplate.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name.trim() }),
          ...(dto.status && { status: dto.status }),
          ...(dto.message && { message: dto.message.trim() }),
          ...(finalBranchId !== undefined && { branchId: finalBranchId }),
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

      await tx.auditLog.create({
        data: {
          tenantId,
          branchId: res.branchId,
          userId: actor.id,
          action: 'UPDATE_WHATSAPP_TEMPLATE',
          resourceType: 'WHATSAPP_TEMPLATE',
          resourceId: res.id,
          moduleKey: 'LAB',
          oldValues: {
            name: existing.name,
            status: existing.status,
            message: existing.message,
            branchId: existing.branchId,
          },
          newValues: {
            name: res.name,
            status: res.status,
            message: res.message,
            branchId: res.branchId,
          },
        },
      });

      return res;
    });

    this.logger.log(`WhatsApp Template "${updated.name}" (${updated.id}) updated by user ${actor.id}`);
    return updated;
  }

  /**
   * Delete a WhatsApp Template
   * STRICT ENFORCEMENT: ONLY Tenant Admin can delete.
   * Lab Admin is strictly restricted from deleting templates.
   */
  async remove(id: string, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (!isTenantAdminUser) {
      throw new ForbiddenException(
        'Permission denied. Only Tenant Administrators have authorization to delete WhatsApp templates.',
      );
    }

    const existing = await this.findOne(tenantId, id, actor);

    await this.prisma.$transaction(async (tx) => {
      await tx.whatsappTemplate.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          branchId: existing.branchId,
          userId: actor.id,
          action: 'DELETE_WHATSAPP_TEMPLATE',
          resourceType: 'WHATSAPP_TEMPLATE',
          resourceId: id,
          moduleKey: 'LAB',
          oldValues: {
            name: existing.name,
            status: existing.status,
            message: existing.message,
            branchId: existing.branchId,
          },
        },
      });
    });

    this.logger.log(`WhatsApp Template "${existing.name}" (${id}) deleted by user ${actor.id}`);
    return {
      success: true,
      message: `WhatsApp template "${existing.name}" deleted successfully.`,
    };
  }
}
