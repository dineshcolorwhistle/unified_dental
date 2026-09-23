import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';
import { CreateQrInquiryDto } from './dto/create-qr-inquiry.dto';
import { QueryQrInquiriesDto } from './dto/query-qr-inquiries.dto';

@Injectable()
export class QrTrackingService {
  private readonly logger = new Logger(QrTrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public lookup of a work order by its unique QR token.
   * STRICT GUARANTEE: All prices, quotes, balances, and payment records are omitted.
   */
  async findByQrToken(qrToken: string) {
    if (!qrToken || typeof qrToken !== 'string' || !qrToken.trim()) {
      throw new BadRequestException('QR token is required');
    }

    const trimmedToken = qrToken.trim();

    const order = await this.prisma.workOrder.findFirst({
      where: {
        OR: [
          { qrToken: trimmedToken },
          { folioNumber: trimmedToken },
        ],
      },
      select: {
        id: true,
        folioNumber: true,
        fileNumber: true,
        boxNumber: true,
        patient: true,
        specification: true,
        color: true,
        notes: true,
        deliveryDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        doctor: {
          select: {
            id: true,
            name: true,
            clinicName: true,
          },
        },
        prosthesisType: {
          select: {
            id: true,
            name: true,
            // Explicitly do NOT select price
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            settings: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        processes: {
          orderBy: { sequence: 'asc' },
          select: {
            id: true,
            processName: true,
            processType: true,
            sequence: true,
            isVerification: true,
            status: true,
            startedAt: true,
            endedAt: true,
            totalActiveDuration: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Work order not found for the provided QR code');
    }

    return {
      ...order,
      tenant: {
        id: order.tenant.id,
        name: order.tenant.name,
        slug: order.tenant.slug,
        logoUrl: (order.tenant.settings as any)?.logoUrl || null,
      },
    };
  }

  /**
   * Submit an inquiry / lead from the public QR tracking page.
   */
  async createInquiry(dto: CreateQrInquiryDto) {
    const trimmedToken = dto.qrToken.trim();

    const order = await this.prisma.workOrder.findFirst({
      where: {
        OR: [
          { qrToken: trimmedToken },
          { folioNumber: trimmedToken },
        ],
      },
      select: {
        id: true,
        folioNumber: true,
        tenantId: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Work order not found for this QR code');
    }

    const inquiry = await this.prisma.qrInquiry.create({
      data: {
        tenantId: order.tenantId,
        workOrderId: order.id,
        workOrderFolio: order.folioNumber,
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim() || '',
        message: dto.message?.trim() || null,
        status: 'NEW',
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    this.logger.log(
      `New QR inquiry created for tenant ${order.tenantId} (Folio: ${order.folioNumber}) by ${dto.name}`,
    );

    return {
      success: true,
      message: 'Inquiry submitted successfully',
      id: inquiry.id,
    };
  }

  /**
   * Platform Super Admin: Query all QR inquiries across tenants.
   */
  async findAllInquiries(actor: AuthenticatedUser, query: QueryQrInquiriesDto) {
    const isSuperAdmin = actor?.isSuperAdmin;
    const actorTenantId = actor?.activeTenantId;

    if (!isSuperAdmin && !actorTenantId) {
      throw new ForbiddenException('You do not have permission to view QR inquiries');
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (!isSuperAdmin) {
      where.tenantId = actorTenantId;
    } else if (query.tenantId && query.tenantId !== 'ALL') {
      where.tenantId = query.tenantId;
    }

    if (query.status && query.status !== 'ALL') {
      where.status = query.status;
    }

    if (query.search && query.search.trim().length > 0) {
      const q = query.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { workOrderFolio: { contains: q, mode: 'insensitive' } },
        { message: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, inquiries] = await Promise.all([
      this.prisma.qrInquiry.count({ where }),
      this.prisma.qrInquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              settings: true,
            },
          },
          workOrder: {
            select: {
              id: true,
              folioNumber: true,
              status: true,
              patient: true,
            },
          },
        },
      }),
    ]);

    const data = inquiries.map((item) => ({
      ...item,
      tenant: {
        id: item.tenant.id,
        name: item.tenant.name,
        slug: item.tenant.slug,
        logoUrl: (item.tenant.settings as any)?.logoUrl || null,
      },
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Platform Super Admin: Update inquiry status (NEW, CONTACTED, CLOSED).
   */
  async updateInquiryStatus(
    id: string,
    status: string,
    notes: string | undefined,
    actor: AuthenticatedUser,
  ) {
    const inquiry = await this.prisma.qrInquiry.findUnique({
      where: { id },
    });

    if (!inquiry) {
      throw new NotFoundException('Inquiry not found');
    }

    if (!actor?.isSuperAdmin && inquiry.tenantId !== actor?.activeTenantId) {
      throw new ForbiddenException('You do not have permission to update this inquiry');
    }

    return this.prisma.qrInquiry.update({
      where: { id },
      data: {
        status: status.toUpperCase(),
        ...(notes !== undefined && { notes: notes.trim() }),
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  /**
   * Platform Super Admin: Delete an inquiry.
   */
  async deleteInquiry(id: string, actor: AuthenticatedUser) {
    const inquiry = await this.prisma.qrInquiry.findUnique({
      where: { id },
    });

    if (!inquiry) {
      throw new NotFoundException('Inquiry not found');
    }

    if (!actor?.isSuperAdmin && inquiry.tenantId !== actor?.activeTenantId) {
      throw new ForbiddenException('You do not have permission to delete this inquiry');
    }

    await this.prisma.qrInquiry.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Inquiry deleted successfully',
    };
  }
}
