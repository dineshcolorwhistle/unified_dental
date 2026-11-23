import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';
import {
  QueryIncomeRecordsDto,
  AddServiceLineDto,
  UpdateServiceLineDto,
  AddProductLineDto,
  UpdateProductLineDto,
  AddIncomePaymentDto,
} from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class IncomeService {
  private readonly logger = new Logger(IncomeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to ensure appointment has not ended before mutating service/product lines
   */
  private async assertAppointmentNotEnded(incomeRecordId: string, tenantId: string) {
    const record = await this.prisma.incomeRecord.findFirst({
      where: { id: incomeRecordId, tenantId },
      include: { appointment: { select: { status: true } } },
    });
    if (!record) throw new NotFoundException('Income record not found');
    if (record.appointment?.status === 'COMPLETED' || record.status === 'FINALIZED') {
      throw new ForbiddenException(
        'Cannot add, modify, or delete services or products after the appointment has ended. Only payment settlements are permitted.',
      );
    }
    return record;
  }

  /**
   * Helper to check admin status
   */
  private async isTenantAdmin(actor: AuthenticatedUser, tenantId: string): Promise<boolean> {
    if (actor.isSuperAdmin) return true;
    const isOwner = (actor as any).memberships?.some(
      (m: any) => m.tenantId === tenantId && m.isOwner,
    );
    if (isOwner) return true;
    const hasAdminRole = actor.roles?.some((r: string) => {
      const lower = r.toLowerCase();
      return (
        lower === 'tenant-admin' ||
        lower.includes('tenant administrator') ||
        lower.includes('tenant admin')
      );
    });
    if (hasAdminRole) return true;

    const userAdminRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: { slug: { in: ['tenant-admin', 'admin', 'administrator'] } },
      },
    });
    return !!userAdminRole;
  }

  /**
   * Helper to recalculate IncomeRecord totals.
   * NOTE: ONLY COMPLETED service lines contribute to totalServices and grandTotal!
   */
  async recalculateTotals(incomeRecordId: string): Promise<any> {
    const serviceLines = await this.prisma.incomeServiceLine.findMany({
      where: { incomeRecordId },
    });

    const productLines = await this.prisma.incomeProductLine.findMany({
      where: { incomeRecordId },
    });

    const payments = await this.prisma.incomePayment.findMany({
      where: { incomeRecordId },
    });

    // Only completed services contribute to billable total
    let totalServices = 0;
    let totalDiscount = 0;

    for (const line of serviceLines) {
      if (line.isCompleted) {
        totalServices += Number(line.lineTotal);
        totalDiscount += Number(line.discountAmount);
      }
    }

    let totalProducts = 0;
    for (const p of productLines) {
      totalProducts += Number(p.lineTotal);
    }

    const grandTotal = totalServices + totalProducts;

    let totalPaid = 0;
    for (const pay of payments) {
      totalPaid += Number(pay.amount) + Number(pay.advanceUsed || 0);
    }

    const balanceDue = Math.max(0, grandTotal - totalPaid);

    const updated = await this.prisma.incomeRecord.update({
      where: { id: incomeRecordId },
      data: {
        totalServices: new Prisma.Decimal(totalServices.toFixed(2)),
        totalProducts: new Prisma.Decimal(totalProducts.toFixed(2)),
        totalDiscount: new Prisma.Decimal(totalDiscount.toFixed(2)),
        grandTotal: new Prisma.Decimal(grandTotal.toFixed(2)),
        totalPaid: new Prisma.Decimal(totalPaid.toFixed(2)),
        balanceDue: new Prisma.Decimal(balanceDue.toFixed(2)),
      },
    });

    // Settle individual line payment statuses based on payments received
    await this.updatePaymentStatuses(incomeRecordId);

    return updated;
  }

  /**
   * Helper to update line payment statuses accurately based on received payments and completion
   */
  async updatePaymentStatuses(incomeRecordId: string): Promise<void> {
    const serviceLines = await this.prisma.incomeServiceLine.findMany({
      where: { incomeRecordId },
      orderBy: { createdAt: 'asc' },
    });

    const productLines = await this.prisma.incomeProductLine.findMany({
      where: { incomeRecordId },
      orderBy: { createdAt: 'asc' },
    });

    const payments = await this.prisma.incomePayment.findMany({
      where: { incomeRecordId },
    });

    let servicesPaymentPool = 0;
    let productsPaymentPool = 0;
    let bothPaymentPool = 0;

    for (const pay of payments) {
      const totalAmount = Number(pay.amount) + Number(pay.advanceUsed || 0);
      if (pay.allocation === 'SERVICES') {
        servicesPaymentPool += totalAmount;
      } else if (pay.allocation === 'PRODUCTS') {
        productsPaymentPool += totalAmount;
      } else {
        bothPaymentPool += totalAmount;
      }
    }

    // 1. Pay products from products pool first, then from both pool
    let remainingProdFunds = productsPaymentPool;
    for (const prod of productLines) {
      const cost = Number(prod.lineTotal);
      if (remainingProdFunds >= cost) {
        remainingProdFunds -= cost;
        await this.prisma.incomeProductLine.update({
          where: { id: prod.id },
          data: { paymentStatus: 'PAID' },
        });
      } else if (remainingProdFunds + bothPaymentPool >= cost) {
        const fromBoth = cost - remainingProdFunds;
        remainingProdFunds = 0;
        bothPaymentPool -= fromBoth;
        await this.prisma.incomeProductLine.update({
          where: { id: prod.id },
          data: { paymentStatus: 'PAID' },
        });
      } else {
        await this.prisma.incomeProductLine.update({
          where: { id: prod.id },
          data: { paymentStatus: 'PENDING' },
        });
      }
    }

    // 2. Pay completed services from services pool, then from remaining both pool
    let remainingSvcFunds = servicesPaymentPool + bothPaymentPool;
    for (const line of serviceLines) {
      // Uncompleted services cannot be paid
      if (!line.isCompleted) {
        if (line.paymentStatus !== 'PENDING') {
          await this.prisma.incomeServiceLine.update({
            where: { id: line.id },
            data: { paymentStatus: 'PENDING' },
          });
        }
        continue;
      }

      const cost = Number(line.lineTotal);
      if (remainingSvcFunds >= cost) {
        remainingSvcFunds -= cost;
        await this.prisma.incomeServiceLine.update({
          where: { id: line.id },
          data: { paymentStatus: 'PAID' },
        });
      } else {
        await this.prisma.incomeServiceLine.update({
          where: { id: line.id },
          data: { paymentStatus: 'PENDING' },
        });
      }
    }
  }

  /**
   * Helper to write income audit entry
   */
  private async writeAudit(
    tenantId: string,
    incomeRecordId: string,
    userId: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    oldValues?: any,
    newValues?: any,
    description?: string,
  ) {
    try {
      await this.prisma.incomeAudit.create({
        data: {
          tenantId,
          incomeRecordId,
          userId,
          action,
          resourceType,
          resourceId,
          oldValues: oldValues ? (oldValues as any) : undefined,
          newValues: newValues ? (newValues as any) : undefined,
          description,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to write income audit: ${err.message}`);
    }
  }

  /**
   * List all income records with pagination and filters
   */
  async findAll(tenantId: string, query: QueryIncomeRecordsDto, actor: AuthenticatedUser) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.IncomeRecordWhereInput = { tenantId };

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.doctorId && query.doctorId !== 'ALL') {
      where.doctorId = query.doctorId;
    }

    if (query.status && query.status !== 'ALL') {
      where.status = query.status;
    }

    if (query.startDate || query.endDate) {
      where.appointment = { ...where.appointment };
      if (query.startDate) {
        where.appointment.date = {
          ...(where.appointment.date as any),
          gte: new Date(query.startDate + 'T00:00:00Z'),
        };
      }
      if (query.endDate) {
        where.appointment.date = {
          ...(where.appointment.date as any),
          lte: new Date(query.endDate + 'T23:59:59Z'),
        };
      }
    }

    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { appointment: { appointmentNumber: { contains: q, mode: 'insensitive' } } },
        { patient: { firstName: { contains: q, mode: 'insensitive' } } },
        { patient: { fatherLastName: { contains: q, mode: 'insensitive' } } },
        { patient: { recordNumber: { contains: q, mode: 'insensitive' } } },
        { doctor: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.incomeRecord.count({ where }),
      this.prisma.incomeRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          appointment: {
            select: {
              id: true,
              appointmentNumber: true,
              date: true,
              startTime: true,
              endTime: true,
              status: true,
              expectedAmount: true,
            },
          },
          patient: {
            select: {
              id: true,
              recordNumber: true,
              firstName: true,
              fatherLastName: true,
              motherLastName: true,
              phoneNumber: true,
            },
          },
          doctor: {
            select: {
              id: true,
              name: true,
              email: true,
              colorCode: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    return {
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Get or auto-create an income record for an appointment
   */
  async getOrCreateByAppointment(
    appointmentId: string,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    let record = await this.prisma.incomeRecord.findFirst({
      where: { appointmentId, tenantId },
      include: {
        appointment: {
          include: {
            appointmentServices: true,
          },
        },
        patient: true,
        doctor: true,
        serviceLines: {
          orderBy: { createdAt: 'asc' },
          include: {
            service: true,
            doctor: { select: { id: true, name: true } },
            completedBy: { select: { id: true, name: true } },
          },
        },
        productLines: {
          orderBy: { createdAt: 'asc' },
          include: {
            inventoryItem: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: {
            paymentMethod: true,
            createdBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (record) {
      return record;
    }

    // Appointment must exist
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: {
        appointmentServices: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID '${appointmentId}' not found`);
    }

    // Create DRAFT IncomeRecord
    record = await this.prisma.incomeRecord.create({
      data: {
        tenantId,
        branchId: appointment.branchId,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        status: 'DRAFT',
        createdById: actor.id,
      },
      include: {
        appointment: {
          include: {
            appointmentServices: true,
          },
        },
        patient: true,
        doctor: true,
        serviceLines: {
          include: {
            service: true,
            doctor: { select: { id: true, name: true } },
            completedBy: { select: { id: true, name: true } },
          },
        },
        productLines: {
          include: {
            inventoryItem: true,
          },
        },
        payments: {
          include: {
            paymentMethod: true,
            createdBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Pre-populate service lines from appointmentServices if any
    if (appointment.appointmentServices && appointment.appointmentServices.length > 0) {
      for (const aptSvc of appointment.appointmentServices) {
        const lineTotal = Number(aptSvc.unitPrice) * (aptSvc.quantity || 1);
        await this.prisma.incomeServiceLine.create({
          data: {
            tenantId,
            incomeRecordId: record.id,
            doctorId: appointment.doctorId,
            serviceId: aptSvc.serviceId,
            serviceName: aptSvc.serviceName,
            quantity: aptSvc.quantity || 1,
            unitPrice: aptSvc.unitPrice,
            discountType: 'PERCENTAGE',
            discountValue: 0,
            discountAmount: 0,
            lineTotal: new Prisma.Decimal(lineTotal.toFixed(2)),
            isFromAppointment: true,
            isCompleted: false, // Default uncompleted
          },
        });
      }
      await this.recalculateTotals(record.id);
    }

    await this.writeAudit(
      tenantId,
      record.id,
      actor.id,
      'INCOME_RECORD_CREATED',
      'INCOME_RECORD',
      record.id,
      null,
      { status: 'DRAFT' },
      `Income record auto-generated for appointment ${appointment.appointmentNumber}`,
    );

    return this.findOne(record.id, tenantId);
  }

  /**
   * Find single income record by ID with all relations
   */
  async findOne(id: string, tenantId: string) {
    const record = await this.prisma.incomeRecord.findFirst({
      where: { id, tenantId },
      include: {
        appointment: {
          select: {
            id: true,
            appointmentNumber: true,
            date: true,
            startTime: true,
            endTime: true,
            durationMinutes: true,
            status: true,
            expectedAmount: true,
            actualStartTime: true,
            actualEndTime: true,
            appointmentServices: true,
          },
        },
        patient: {
          select: {
            id: true,
            recordNumber: true,
            firstName: true,
            fatherLastName: true,
            motherLastName: true,
            phoneNumber: true,
            phoneCountryCode: true,
            email: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            colorCode: true,
          },
        },
        createdBy: {
          select: { id: true, name: true },
        },
        serviceLines: {
          orderBy: { createdAt: 'asc' },
          include: {
            service: { select: { id: true, name: true, price: true } },
            doctor: { select: { id: true, name: true } },
            completedBy: { select: { id: true, name: true } },
          },
        },
        productLines: {
          orderBy: { createdAt: 'asc' },
          include: {
            inventoryItem: { select: { id: true, name: true, sku: true, unitPrice: true, quantity: true } },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
          include: {
            paymentMethod: { select: { id: true, name: true, type: true } },
            advancePayment: { select: { id: true, receiptNumber: true, balanceRemaining: true } },
            createdBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`Income record with ID '${id}' not found`);
    }

    return record;
  }

  /**
   * Add a service line
   */
  async addServiceLine(
    incomeRecordId: string,
    dto: AddServiceLineDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    await this.assertAppointmentNotEnded(incomeRecordId, tenantId);

    const record = await this.prisma.incomeRecord.findFirst({
      where: { id: incomeRecordId, tenantId },
    });
    if (!record) throw new NotFoundException('Income record not found');

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, tenantId },
    });
    if (!service) throw new NotFoundException('Service not found');

    const doctorId = dto.doctorId || record.doctorId;

    // Check doctor custom price if unitPrice not explicitly provided
    let unitPrice = dto.unitPrice !== undefined ? Number(dto.unitPrice) : null;
    if (unitPrice === null) {
      const doctorSvc = await this.prisma.doctorService.findFirst({
        where: { tenantId, doctorId, serviceId: dto.serviceId },
      });
      unitPrice = doctorSvc ? Number(doctorSvc.customPrice) : Number(service.price);
    }

    const qty = dto.quantity || 1;
    const discountType = dto.discountType || 'PERCENTAGE';
    const discountValue = Number(dto.discountValue || 0);

    let discountAmount = 0;
    if (discountType === 'PERCENTAGE') {
      discountAmount = (unitPrice * qty * discountValue) / 100;
    } else {
      discountAmount = discountValue;
    }
    const lineTotal = Math.max(0, unitPrice * qty - discountAmount);

    const line = await this.prisma.incomeServiceLine.create({
      data: {
        tenantId,
        incomeRecordId,
        doctorId,
        serviceId: dto.serviceId,
        serviceName: service.name,
        quantity: qty,
        unitPrice: new Prisma.Decimal(unitPrice.toFixed(2)),
        discountType,
        discountValue: new Prisma.Decimal(discountValue.toFixed(2)),
        discountAmount: new Prisma.Decimal(discountAmount.toFixed(2)),
        lineTotal: new Prisma.Decimal(lineTotal.toFixed(2)),
        isFromAppointment: false,
        isCompleted: false, // Starts as pending
      },
    });

    await this.recalculateTotals(incomeRecordId);

    await this.writeAudit(
      tenantId,
      incomeRecordId,
      actor.id,
      'SERVICE_ADDED',
      'SERVICE_LINE',
      line.id,
      null,
      { serviceName: service.name, quantity: qty, unitPrice, lineTotal },
      `Added service ${service.name} (Qty: ${qty})`,
    );

    return this.findOne(incomeRecordId, tenantId);
  }

  /**
   * Update service line (quantity, discount)
   */
  async updateServiceLine(
    incomeRecordId: string,
    lineId: string,
    dto: UpdateServiceLineDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    await this.assertAppointmentNotEnded(incomeRecordId, tenantId);

    const line = await this.prisma.incomeServiceLine.findFirst({
      where: { id: lineId, incomeRecordId, tenantId },
    });
    if (!line) throw new NotFoundException('Service line not found');

    if (line.isCompleted || line.paymentStatus === 'PAID') {
      throw new BadRequestException('Completed or paid service lines cannot be modified.');
    }

    const qty = dto.quantity !== undefined ? dto.quantity : line.quantity;
    const unitPrice = dto.unitPrice !== undefined ? Number(dto.unitPrice) : Number(line.unitPrice);
    const discountType = dto.discountType || line.discountType;
    const discountValue = dto.discountValue !== undefined ? Number(dto.discountValue) : Number(line.discountValue);

    let discountAmount = 0;
    if (discountType === 'PERCENTAGE') {
      discountAmount = (unitPrice * qty * discountValue) / 100;
    } else {
      discountAmount = discountValue;
    }
    const lineTotal = Math.max(0, unitPrice * qty - discountAmount);

    const updated = await this.prisma.incomeServiceLine.update({
      where: { id: lineId },
      data: {
        quantity: qty,
        unitPrice: new Prisma.Decimal(unitPrice.toFixed(2)),
        discountType,
        discountValue: new Prisma.Decimal(discountValue.toFixed(2)),
        discountAmount: new Prisma.Decimal(discountAmount.toFixed(2)),
        lineTotal: new Prisma.Decimal(lineTotal.toFixed(2)),
      },
    });

    await this.recalculateTotals(incomeRecordId);

    await this.writeAudit(
      tenantId,
      incomeRecordId,
      actor.id,
      'SERVICE_UPDATED',
      'SERVICE_LINE',
      line.id,
      { quantity: line.quantity, discountValue: line.discountValue, lineTotal: line.lineTotal },
      { quantity: qty, discountValue, lineTotal },
      `Updated service ${line.serviceName}`,
    );

    return this.findOne(incomeRecordId, tenantId);
  }

  /**
   * Mark service line as completed (Irreversible)
   */
  async toggleServiceComplete(
    incomeRecordId: string,
    lineId: string,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    await this.assertAppointmentNotEnded(incomeRecordId, tenantId);

    const line = await this.prisma.incomeServiceLine.findFirst({
      where: { id: lineId, incomeRecordId, tenantId },
    });
    if (!line) throw new NotFoundException('Service line not found');

    if (line.isCompleted) {
      throw new BadRequestException('Service is already completed and cannot be reverted.');
    }

    await this.prisma.incomeServiceLine.update({
      where: { id: lineId },
      data: {
        isCompleted: true,
        completedAt: new Date(),
        completedById: actor.id,
      },
    });

    // Recalculate totals — completed services count into billable total
    await this.recalculateTotals(incomeRecordId);

    await this.writeAudit(
      tenantId,
      incomeRecordId,
      actor.id,
      'SERVICE_COMPLETED',
      'SERVICE_LINE',
      line.id,
      { isCompleted: false },
      { isCompleted: true },
      `Marked service '${line.serviceName}' as Completed`,
    );

    return this.findOne(incomeRecordId, tenantId);
  }

  /**
   * Delete service line (disallowed if completed or paid)
   */
  async removeServiceLine(
    incomeRecordId: string,
    lineId: string,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    await this.assertAppointmentNotEnded(incomeRecordId, tenantId);

    const line = await this.prisma.incomeServiceLine.findFirst({
      where: { id: lineId, incomeRecordId, tenantId },
    });
    if (!line) throw new NotFoundException('Service line not found');

    if (line.isCompleted || line.paymentStatus === 'PAID') {
      throw new BadRequestException('Completed or paid service lines cannot be deleted.');
    }

    await this.prisma.incomeServiceLine.delete({ where: { id: lineId } });

    await this.recalculateTotals(incomeRecordId);

    await this.writeAudit(
      tenantId,
      incomeRecordId,
      actor.id,
      'SERVICE_DELETED',
      'SERVICE_LINE',
      line.id,
      { serviceName: line.serviceName, lineTotal: line.lineTotal },
      null,
      `Deleted service line '${line.serviceName}'`,
    );

    return this.findOne(incomeRecordId, tenantId);
  }

  /**
   * Add a product line from inventory (deducts stock)
   */
  async addProductLine(
    incomeRecordId: string,
    dto: AddProductLineDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    await this.assertAppointmentNotEnded(incomeRecordId, tenantId);

    const record = await this.prisma.incomeRecord.findFirst({
      where: { id: incomeRecordId, tenantId },
    });
    if (!record) throw new NotFoundException('Income record not found');

    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: dto.inventoryItemId, tenantId },
    });
    if (!item) throw new NotFoundException('Inventory item not found');

    const qty = dto.quantity || 1;
    if (item.quantity < qty) {
      throw new BadRequestException(
        `Insufficient inventory stock for '${item.name}'. Available: ${item.quantity}, Requested: ${qty}`,
      );
    }

    const unitPrice = dto.unitPrice !== undefined ? Number(dto.unitPrice) : Number(item.unitPrice);
    const lineTotal = unitPrice * qty;

    // Deduct stock and log activity in a transaction
    await this.prisma.$transaction(async (tx) => {
      const prevQty = item.quantity;
      const newQty = prevQty - qty;

      await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          quantity: newQty,
          status: newQty === 0 ? 'OUT_OF_STOCK' : newQty <= item.minQuantity ? 'LOW_STOCK' : 'IN_STOCK',
        },
      });

      await tx.inventoryActivity.create({
        data: {
          tenantId,
          itemId: item.id,
          userId: actor.id,
          action: 'STOCK_ADJUSTED',
          quantityChanged: -qty,
          previousQuantity: prevQty,
          newQuantity: newQty,
          reason: `Used for Income Record #${record.id}`,
        },
      });

      await tx.incomeProductLine.create({
        data: {
          tenantId,
          incomeRecordId,
          inventoryItemId: item.id,
          productName: item.name,
          quantity: qty,
          unitPrice: new Prisma.Decimal(unitPrice.toFixed(2)),
          lineTotal: new Prisma.Decimal(lineTotal.toFixed(2)),
          paymentStatus: 'PENDING',
        },
      });
    });

    await this.recalculateTotals(incomeRecordId);

    await this.writeAudit(
      tenantId,
      incomeRecordId,
      actor.id,
      'PRODUCT_ADDED',
      'PRODUCT_LINE',
      item.id,
      null,
      { productName: item.name, quantity: qty, unitPrice, lineTotal },
      `Added product '${item.name}' (Qty: ${qty}, Stock deducted: ${qty})`,
    );

    return this.findOne(incomeRecordId, tenantId);
  }

  /**
   * Update a product line quantity (adjusts inventory stock dynamically)
   */
  async updateProductLine(
    incomeRecordId: string,
    lineId: string,
    dto: UpdateProductLineDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    await this.assertAppointmentNotEnded(incomeRecordId, tenantId);

    const line = await this.prisma.incomeProductLine.findFirst({
      where: { id: lineId, incomeRecordId, tenantId },
      include: { inventoryItem: true },
    });
    if (!line) throw new NotFoundException('Product line not found');

    if (line.paymentStatus === 'PAID') {
      throw new BadRequestException('Paid product lines cannot be modified.');
    }

    const item = line.inventoryItem;
    const oldQty = line.quantity;
    const newQty = dto.quantity;
    const delta = newQty - oldQty;

    const unitPrice = dto.unitPrice !== undefined ? Number(dto.unitPrice) : Number(line.unitPrice);
    const lineTotal = unitPrice * newQty;

    if (item && delta !== 0) {
      if (delta > 0 && item.quantity < delta) {
        throw new BadRequestException(
          `Insufficient inventory stock for '${item.name}'. Available: ${item.quantity}, Additional requested: ${delta}`,
        );
      }

      await this.prisma.$transaction(async (tx) => {
        const prevQty = item.quantity;
        const updatedItemQty = prevQty - delta;

        await tx.inventoryItem.update({
          where: { id: item.id },
          data: {
            quantity: updatedItemQty,
            status:
              updatedItemQty <= item.minQuantity
                ? updatedItemQty === 0
                  ? 'OUT_OF_STOCK'
                  : 'LOW_STOCK'
                : 'IN_STOCK',
          },
        });

        await tx.inventoryActivity.create({
          data: {
            tenantId,
            itemId: item.id,
            userId: actor.id,
            action: 'STOCK_ADJUSTED',
            quantityChanged: -delta,
            previousQuantity: prevQty,
            newQuantity: updatedItemQty,
            reason: `Adjusted quantity on Income Record #${incomeRecordId} line #${lineId} (${oldQty} -> ${newQty})`,
          },
        });

        await tx.incomeProductLine.update({
          where: { id: lineId },
          data: {
            quantity: newQty,
            unitPrice: new Prisma.Decimal(unitPrice.toFixed(2)),
            lineTotal: new Prisma.Decimal(lineTotal.toFixed(2)),
          },
        });
      });
    } else {
      await this.prisma.incomeProductLine.update({
        where: { id: lineId },
        data: {
          quantity: newQty,
          unitPrice: new Prisma.Decimal(unitPrice.toFixed(2)),
          lineTotal: new Prisma.Decimal(lineTotal.toFixed(2)),
        },
      });
    }

    await this.recalculateTotals(incomeRecordId);

    await this.writeAudit(
      tenantId,
      incomeRecordId,
      actor.id,
      'PRODUCT_UPDATED',
      'PRODUCT_LINE',
      line.id,
      { quantity: oldQty, unitPrice: line.unitPrice, lineTotal: line.lineTotal },
      { quantity: newQty, unitPrice, lineTotal },
      `Updated product '${line.productName}' quantity from ${oldQty} to ${newQty}`,
    );

    return this.findOne(incomeRecordId, tenantId);
  }

  /**
   * Delete a product line (restores inventory stock, disallowed if paid)
   */
  async removeProductLine(
    incomeRecordId: string,
    lineId: string,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    await this.assertAppointmentNotEnded(incomeRecordId, tenantId);

    const line = await this.prisma.incomeProductLine.findFirst({
      where: { id: lineId, incomeRecordId, tenantId },
      include: { inventoryItem: true },
    });
    if (!line) throw new NotFoundException('Product line not found');

    if (line.paymentStatus === 'PAID') {
      throw new BadRequestException('Paid product lines cannot be deleted.');
    }

    const item = line.inventoryItem;
    const qtyToRestore = line.quantity;

    await this.prisma.$transaction(async (tx) => {
      if (item) {
        const prevQty = item.quantity;
        const newQty = prevQty + qtyToRestore;

        await tx.inventoryItem.update({
          where: { id: item.id },
          data: {
            quantity: newQty,
            status: newQty <= item.minQuantity ? (newQty === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK') : 'IN_STOCK',
          },
        });

        await tx.inventoryActivity.create({
          data: {
            tenantId,
            itemId: item.id,
            userId: actor.id,
            action: 'STOCK_ADJUSTED',
            quantityChanged: qtyToRestore,
            previousQuantity: prevQty,
            newQuantity: newQty,
            reason: `Restored from deleted Income product line #${line.id}`,
          },
        });
      }

      await tx.incomeProductLine.delete({ where: { id: lineId } });
    });

    await this.recalculateTotals(incomeRecordId);

    await this.writeAudit(
      tenantId,
      incomeRecordId,
      actor.id,
      'PRODUCT_DELETED',
      'PRODUCT_LINE',
      line.id,
      { productName: line.productName, quantity: line.quantity, lineTotal: line.lineTotal },
      null,
      `Removed product '${line.productName}' and restored ${qtyToRestore} units to inventory stock`,
    );

    return this.findOne(incomeRecordId, tenantId);
  }

  /**
   * Record a payment
   */
  async addPayment(
    incomeRecordId: string,
    dto: AddIncomePaymentDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const record = await this.prisma.incomeRecord.findFirst({
      where: { id: incomeRecordId, tenantId },
      include: { patient: true },
    });
    if (!record) throw new NotFoundException('Income record not found');

    const method = await this.prisma.paymentMethod.findFirst({
      where: { id: dto.paymentMethodId, tenantId },
    });
    if (!method) throw new NotFoundException('Payment method not found');

    if (method.type !== 'INCOME' && method.type !== 'BOTH') {
      throw new BadRequestException('Selected payment method is not configured for Income');
    }

    const payAmount = Number(dto.amount);
    const advanceUsed = Number(dto.advanceUsed || 0);

    // Validate and deduct advance payment if requested
    if (advanceUsed > 0) {
      if (!dto.advancePaymentId) {
        throw new BadRequestException('Advance payment ID is required when applying an advance');
      }
      const adv = await this.prisma.patientAdvancePayment.findFirst({
        where: { id: dto.advancePaymentId, tenantId, patientId: record.patientId },
      });
      if (!adv) throw new NotFoundException('Advance payment not found for patient');

      const currentBalance = Number(adv.balanceRemaining);
      if (currentBalance < advanceUsed) {
        throw new BadRequestException(
          `Insufficient advance balance. Available: $${currentBalance}, Requested: $${advanceUsed}`,
        );
      }

      const newBalance = currentBalance - advanceUsed;
      const newStatus = newBalance === 0 ? 'CONSUMED' : 'PARTIALLY_USED';

      await this.prisma.patientAdvancePayment.update({
        where: { id: adv.id },
        data: {
          balanceRemaining: new Prisma.Decimal(newBalance.toFixed(2)),
          status: newStatus,
        },
      });
    }

    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate + 'T12:00:00Z') : new Date();

    const payment = await this.prisma.incomePayment.create({
      data: {
        tenantId,
        incomeRecordId,
        paymentDate,
        paymentMethodId: method.id,
        paymentMethodName: method.name,
        amount: new Prisma.Decimal(payAmount.toFixed(2)),
        advanceUsed: new Prisma.Decimal(advanceUsed.toFixed(2)),
        advancePaymentId: advanceUsed > 0 ? dto.advancePaymentId : null,
        allocation: dto.allocation || 'BOTH',
        notes: dto.notes,
        createdById: actor.id,
      },
    });

    await this.recalculateTotals(incomeRecordId);

    await this.writeAudit(
      tenantId,
      incomeRecordId,
      actor.id,
      'PAYMENT_ADDED',
      'PAYMENT',
      payment.id,
      null,
      { amount: payAmount, method: method.name, advanceUsed, allocation: dto.allocation },
      `Recorded payment of $${payAmount} via ${method.name}${advanceUsed > 0 ? ` (Advance used: $${advanceUsed})` : ''}`,
    );

    return this.findOne(incomeRecordId, tenantId);
  }

  /**
   * Get variance summary between expected and actual completed services
   */
  async getVariance(incomeRecordId: string, tenantId: string) {
    const record = await this.prisma.incomeRecord.findFirst({
      where: { id: incomeRecordId, tenantId },
      include: {
        appointment: {
          include: { appointmentServices: true },
        },
        serviceLines: true,
      },
    });
    if (!record) throw new NotFoundException('Income record not found');

    const expectedAmount = Number(record.appointment?.expectedAmount || 0);

    const completedLines = record.serviceLines.filter((l) => l.isCompleted);
    const pendingLines = record.serviceLines.filter((l) => !l.isCompleted);

    const actualCompletedTotal = completedLines.reduce((acc, l) => acc + Number(l.lineTotal), 0);
    const pendingTotal = pendingLines.reduce((acc, l) => acc + Number(l.lineTotal), 0);
    const difference = actualCompletedTotal - expectedAmount;

    const hasVariation = Math.abs(difference) > 0.01;

    // Breakdown details
    const expectedServiceIds = new Set(
      record.appointment?.appointmentServices.map((as) => as.serviceId) || [],
    );

    const addedServices = record.serviceLines.filter((l) => !l.isFromAppointment);
    const missingExpectedServices = (record.appointment?.appointmentServices || []).filter(
      (as) => !record.serviceLines.some((sl) => sl.serviceId === as.serviceId),
    );

    return {
      expectedAmount,
      actualCompletedTotal,
      pendingTotal,
      difference,
      hasVariation,
      variationType: difference > 0 ? 'HIGHER' : difference < 0 ? 'LOWER' : 'EQUAL',
      expectedServicesCount: record.appointment?.appointmentServices.length || 0,
      completedServicesCount: completedLines.length,
      pendingServicesCount: pendingLines.length,
      addedServicesCount: addedServices.length,
      missingExpectedCount: missingExpectedServices.length,
      addedServices: addedServices.map((s) => ({
        name: s.serviceName,
        lineTotal: Number(s.lineTotal),
        isCompleted: s.isCompleted,
      })),
      pendingServices: pendingLines.map((s) => ({
        name: s.serviceName,
        lineTotal: Number(s.lineTotal),
      })),
    };
  }

  /**
   * Get audit trail with pagination
   */
  async getAudit(
    incomeRecordId: string,
    tenantId: string,
    query?: { page?: number; limit?: number },
  ) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query?.limit) || 10));
    const skip = (page - 1) * limit;

    const where = { incomeRecordId, tenantId };

    const [total, records] = await Promise.all([
      this.prisma.incomeAudit.count({ where }),
      this.prisma.incomeAudit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return {
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Finalize income record
   */
  async finalize(incomeRecordId: string, tenantId: string, actor: AuthenticatedUser) {
    const record = await this.prisma.incomeRecord.findFirst({
      where: { id: incomeRecordId, tenantId },
    });
    if (!record) throw new NotFoundException('Income record not found');

    const updated = await this.prisma.incomeRecord.update({
      where: { id: incomeRecordId },
      data: { status: 'FINALIZED' },
    });

    await this.writeAudit(
      tenantId,
      incomeRecordId,
      actor.id,
      'STATUS_CHANGED',
      'INCOME_RECORD',
      incomeRecordId,
      { status: record.status },
      { status: 'FINALIZED' },
      'Finalized income record',
    );

    return updated;
  }
}
