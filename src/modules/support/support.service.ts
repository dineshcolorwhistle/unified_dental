import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { UpdateSupportTicketDto } from './dto/update-support-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import { SupportTicketStatus } from '@prisma/client';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Helper: verify if the authenticated user has Tenant Admin privileges
   */
  async isTenantAdmin(user: AuthenticatedUser, tenantId?: string): Promise<boolean> {
    if (user.isSuperAdmin) return true;
    const targetTenantId = tenantId || user.activeTenantId;
    if (!targetTenantId) return false;

    // Check JWT roles
    const hasRole = user.roles?.some((r) => {
      const lower = r.toLowerCase().replace(/_/g, '-');
      return (
        lower === 'tenant-admin' ||
        lower === 'admin' ||
        lower === 'administrator' ||
        lower.includes('tenant-admin') ||
        lower.includes('tenant admin')
      );
    });
    if (hasRole) return true;

    // Direct DB check for tenant ownership / membership
    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        userId_tenantId: {
          userId: user.id,
          tenantId: targetTenantId,
        },
      },
    });
    if (membership?.isOwner) return true;

    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId: user.id,
        tenantId: targetTenantId,
        role: {
          slug: { in: ['tenant-admin', 'admin', 'administrator'] },
        },
      },
    });
    return Boolean(userRole);
  }

  /**
   * Helper: verify if the authenticated user has Lab Admin privileges
   */
  async isLabAdmin(user: AuthenticatedUser, tenantId?: string): Promise<boolean> {
    if (user.isSuperAdmin) return false;
    const targetTenantId = tenantId || user.activeTenantId;
    if (!targetTenantId) return false;

    // Check JWT roles
    const hasRole = user.roles?.some((r) => {
      const lower = r.toLowerCase().replace(/_/g, '-');
      return (
        lower === 'lab admin' ||
        lower === 'lab-admin' ||
        lower.includes('lab admin') ||
        lower.includes('lab administrator')
      );
    });
    if (hasRole) return true;

    // Direct DB check
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId: user.id,
        tenantId: targetTenantId,
        role: {
          slug: { in: ['lab-admin', 'lab_admin', 'lab-administrator'] },
        },
      },
    });
    return Boolean(userRole);
  }

  /**
   * Generate next sequential ticket number: TICK-1001, TICK-1002, etc.
   */
  private async generateTicketNumber(): Promise<string> {
    const totalCount = await this.prisma.supportTicket.count();
    const nextSeq = 1001 + totalCount;
    let candidate = `TICK-${nextSeq}`;

    // Verify uniqueness
    let exists = await this.prisma.supportTicket.findUnique({
      where: { ticketNumber: candidate },
    });
    let offset = 1;
    while (exists) {
      candidate = `TICK-${nextSeq + offset}`;
      exists = await this.prisma.supportTicket.findUnique({
        where: { ticketNumber: candidate },
      });
      offset++;
    }
    return candidate;
  }

  /**
   * Create a new support ticket (Lab Admin only)
   */
  async createTicket(dto: CreateSupportTicketDto, user: AuthenticatedUser) {
    const tenantId = user.activeTenantId;
    if (!tenantId) {
      throw new BadRequestException('Active tenant context is required to create a support ticket.');
    }

    // Role check: Tenant Admin has NO permission to create tickets
    const isTenantAdminUser = await this.isTenantAdmin(user, tenantId);
    const isLabAdminUser = await this.isLabAdmin(user, tenantId);

    if (isTenantAdminUser && !isLabAdminUser && !user.isSuperAdmin) {
      throw new ForbiddenException(
        'Tenant Admins do not have permission to create support tickets. Only Lab Admins can create tickets.',
      );
    }

    // Enforce max 2 images
    if (dto.images && dto.images.length > 2) {
      throw new BadRequestException('A maximum of two images can be uploaded per support ticket.');
    }

    const ticketNumber = await this.generateTicketNumber();
    const branchId = dto.branchId || user.activeBranchId || null;

    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        title: dto.title.trim(),
        description: dto.description.trim(),
        status: SupportTicketStatus.CREATED,
        images: dto.images || [],
        moduleKey: 'LAB',
        tenantId,
        branchId,
        createdById: user.id,
      },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        branch: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    // Notify all Platform Super Admins
    try {
      const superAdmins = await this.prisma.user.findMany({
        where: { isSuperAdmin: true, status: 'ACTIVE' },
        select: { id: true },
      });

      for (const admin of superAdmins) {
        await this.notificationsService.create({
          userId: admin.id,
          moduleKey: 'LAB',
          type: 'SUPPORT_TICKET_CREATED',
          title: `New Support Ticket: ${ticket.title}`,
          body: `${user.name} from "${ticket.tenant.name}" created ticket #${ticket.ticketNumber}`,
          data: {
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            tenantId,
            branchId,
          },
        });
      }
    } catch (err) {
      this.logger.error(`Failed to dispatch platform admin notification for ticket #${ticket.ticketNumber}:`, err);
    }

    return ticket;
  }

  /**
   * Edit ticket details (Lab Admin only)
   */
  async updateTicket(id: string, dto: UpdateSupportTicketDto, user: AuthenticatedUser) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: { tenant: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID "${id}" was not found.`);
    }

    // Tenant boundary check
    if (!user.isSuperAdmin && user.activeTenantId !== ticket.tenantId) {
      throw new ForbiddenException('Access denied to support ticket outside your active tenant.');
    }

    // Role check: Tenant Admin cannot edit tickets
    const isTenantAdminUser = await this.isTenantAdmin(user, ticket.tenantId);
    const isLabAdminUser = await this.isLabAdmin(user, ticket.tenantId);

    if (isTenantAdminUser && !isLabAdminUser && !user.isSuperAdmin) {
      throw new ForbiddenException(
        'Tenant Admins do not have permission to edit support tickets. Only Lab Admins can edit tickets.',
      );
    }

    // Enforce max 2 images
    if (dto.images && dto.images.length > 2) {
      throw new BadRequestException('A maximum of two images can be uploaded per support ticket.');
    }

    return this.prisma.supportTicket.update({
      where: { id },
      data: {
        title: dto.title !== undefined ? dto.title.trim() : undefined,
        description: dto.description !== undefined ? dto.description.trim() : undefined,
        images: dto.images !== undefined ? dto.images : undefined,
      },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        branch: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
  }

  /**
   * Update ticket status (Platform Admin & Lab Admin)
   */
  async updateStatus(id: string, dto: UpdateTicketStatusDto, user: AuthenticatedUser) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        tenant: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID "${id}" was not found.`);
    }

    // Tenant check if not Platform Admin
    if (!user.isSuperAdmin && user.activeTenantId !== ticket.tenantId) {
      throw new ForbiddenException('Access denied to support ticket outside your active tenant.');
    }

    const previousStatus = ticket.status;
    const updatedTicket = await this.prisma.supportTicket.update({
      where: { id },
      data: { status: dto.status },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        branch: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    // Notify relevant parties if status actually changed
    if (previousStatus !== dto.status) {
      try {
        if (user.isSuperAdmin) {
          // Platform admin updated status -> notify ticket creator
          await this.notificationsService.create({
            tenantId: ticket.tenant.id,
            userId: ticket.createdById,
            moduleKey: 'LAB',
            type: 'SUPPORT_TICKET_STATUS',
            title: `Ticket #${ticket.ticketNumber} status updated`,
            body: `Status changed to "${dto.status.replace(/_/g, ' ')}" by Platform Support.`,
            data: { ticketId: ticket.id, status: dto.status },
          });
        } else {
          // Lab admin updated status -> notify platform super admins
          const superAdmins = await this.prisma.user.findMany({
            where: { isSuperAdmin: true, status: 'ACTIVE' },
            select: { id: true },
          });
          for (const admin of superAdmins) {
            await this.notificationsService.create({
              userId: admin.id,
              moduleKey: 'LAB',
              type: 'SUPPORT_TICKET_STATUS',
              title: `Ticket #${ticket.ticketNumber} status updated`,
              body: `${user.name} changed status to "${dto.status.replace(/_/g, ' ')}".`,
              data: { ticketId: ticket.id, status: dto.status },
            });
          }
        }
      } catch (err) {
        this.logger.error(`Failed to send status update notification for ticket #${ticket.ticketNumber}:`, err);
      }
    }

    return updatedTicket;
  }

  /**
   * Delete ticket (Tenant Admin & Platform Admin only; Lab Admin cannot delete)
   */
  async deleteTicket(id: string, user: AuthenticatedUser) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID "${id}" was not found.`);
    }

    // Role check: Only Tenant Admin and Super Admin can delete
    const isTenantAdminUser = await this.isTenantAdmin(user, ticket.tenantId);
    if (!isTenantAdminUser && !user.isSuperAdmin) {
      throw new ForbiddenException(
        'Lab Admins cannot delete support tickets. Only Tenant Admins have permission to delete tickets.',
      );
    }

    if (!user.isSuperAdmin && user.activeTenantId !== ticket.tenantId) {
      throw new ForbiddenException('Access denied to support ticket outside your active tenant.');
    }

    await this.prisma.supportTicket.delete({
      where: { id },
    });

    return { success: true, message: `Support ticket #${ticket.ticketNumber} deleted successfully.` };
  }

  /**
   * Add reply message to the ticket conversation thread
   * NOTE: Replies are disabled once ticket status is COMPLETED.
   */
  async addMessage(ticketId: string, dto: CreateTicketMessageDto, user: AuthenticatedUser) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        tenant: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID "${ticketId}" was not found.`);
    }

    // Tenant check
    if (!user.isSuperAdmin && user.activeTenantId !== ticket.tenantId) {
      throw new ForbiddenException('Access denied to support ticket outside your active tenant.');
    }

    // CRITICAL REQUIREMENT: Disable replies if status is COMPLETED
    if (ticket.status === SupportTicketStatus.COMPLETED) {
      throw new BadRequestException(
        'This support ticket has been marked as Completed. Further replies in this conversation are disabled.',
      );
    }

    const message = await this.prisma.supportTicketMessage.create({
      data: {
        ticketId,
        senderId: user.id,
        message: dto.message.trim(),
        attachments: dto.attachments || [],
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            isSuperAdmin: true,
          },
        },
      },
    });

    // Touch ticket updatedAt
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });

    // Notify relevant recipient
    try {
      if (user.isSuperAdmin) {
        // Platform admin replied -> notify ticket creator
        await this.notificationsService.create({
          tenantId: ticket.tenant.id,
          userId: ticket.createdById,
          moduleKey: 'LAB',
          type: 'SUPPORT_TICKET_MESSAGE',
          title: `Platform Support replied on #${ticket.ticketNumber}`,
          body: dto.message.length > 80 ? `${dto.message.substring(0, 77)}...` : dto.message,
          data: { ticketId, ticketNumber: ticket.ticketNumber },
        });
      } else {
        // Lab admin replied -> notify platform super admins
        const superAdmins = await this.prisma.user.findMany({
          where: { isSuperAdmin: true, status: 'ACTIVE' },
          select: { id: true },
        });
        for (const admin of superAdmins) {
          await this.notificationsService.create({
            userId: admin.id,
            moduleKey: 'LAB',
            type: 'SUPPORT_TICKET_MESSAGE',
            title: `Reply on #${ticket.ticketNumber} from "${ticket.tenant.name}"`,
            body: dto.message.length > 80 ? `${dto.message.substring(0, 77)}...` : dto.message,
            data: { ticketId, ticketNumber: ticket.ticketNumber },
          });
        }
      }
    } catch (err) {
      this.logger.error(`Failed to send message notification for ticket #${ticket.ticketNumber}:`, err);
    }

    return message;
  }

  /**
   * List support tickets with filtering, search, and pagination
   */
  async findAll(query: TicketQueryDto, user: AuthenticatedUser) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    // Scoping: Super Admin sees global tickets unless explicitly filtering by tenantId
    if (user.isSuperAdmin && !user.activeTenantId) {
      if (query.tenantId) {
        where.tenantId = query.tenantId;
      }
    } else {
      // Scoped strictly to current active tenant
      where.tenantId = user.activeTenantId;
    }

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { ticketNumber: { contains: term, mode: 'insensitive' } },
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { tenant: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          branch: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieve single ticket details with full conversation history
   */
  async findOne(id: string, user: AuthenticatedUser) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        branch: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        messages: {
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                isSuperAdmin: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID "${id}" was not found.`);
    }

    // Tenant isolation check
    if (!user.isSuperAdmin && user.activeTenantId !== ticket.tenantId) {
      throw new ForbiddenException('Access denied to support ticket outside your active tenant.');
    }

    return ticket;
  }

  /**
   * KPI metrics for Platform Admin dashboard
   */
  async getMetrics(user: AuthenticatedUser, tenantId?: string) {
    const where: any = {};
    if (!user.isSuperAdmin || tenantId) {
      where.tenantId = tenantId || user.activeTenantId;
    }

    const [total, createdCount, inProgressCount, completedCount] = await Promise.all([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.count({ where: { ...where, status: SupportTicketStatus.CREATED } }),
      this.prisma.supportTicket.count({ where: { ...where, status: SupportTicketStatus.IN_PROGRESS } }),
      this.prisma.supportTicket.count({ where: { ...where, status: SupportTicketStatus.COMPLETED } }),
    ]);

    return {
      total,
      createdCount,
      inProgressCount,
      completedCount,
    };
  }
}
