import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { AuditService } from '../../../core/audit/audit.service';
import { NotificationsService } from '../../../core/notifications/notifications.service';
import { NotificationsGateway } from '../../../core/notifications/notifications.gateway';
import { AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';
import { CreateWorkOrderDto, InitiateReworkDto, QueryWorkOrdersDto, RecordWorkOrderPaymentDto, UpdateWorkOrderDto, VerificationEvaluateDto } from './dto';
import { generateFolioNumber } from './utils/folio.util';
import { parseCalendarDate, startOfDayInTz, endOfDayInTz, DEFAULT_TIMEZONE } from '../../../shared/common/utils/timezone.util';
import { DoctorType, ProcessStatus, ProcessType, UserStatus, WorkOrderStatus } from '@prisma/client';

@Injectable()
export class WorkOrdersService {
  private readonly logger = new Logger(WorkOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Check whether an authenticated actor is a Platform Super Admin or Tenant Admin
   */
  async isTenantAdminUser(actor: AuthenticatedUser, tenantId: string): Promise<boolean> {
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
        role: { slug: 'tenant-admin' },
      },
    });

    return Boolean(userAdminRole);
  }

  /**
   * Check whether an authenticated actor is a Lab Administrator
   */
  async isLabAdminUser(actor: AuthenticatedUser, tenantId: string): Promise<boolean> {
    const hasLabAdminRole = actor.roles?.some((r: string) => {
      const lower = r.toLowerCase();
      return lower === 'lab admin' || lower === 'lab-admin';
    });
    if (hasLabAdminRole) return true;

    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: { slug: 'lab-admin' },
      },
    });

    return Boolean(userRole);
  }

  /**
   * Check whether an authenticated actor is a Lab Technician
   */
  async isLabTechnicianUser(actor: AuthenticatedUser, tenantId: string): Promise<boolean> {
    const isTenantAdmin = await this.isTenantAdminUser(actor, tenantId);
    if (isTenantAdmin) return false;
    const isLabAdmin = await this.isLabAdminUser(actor, tenantId);
    if (isLabAdmin) return false;

    const hasTechRole = actor.roles?.some((r: string) => {
      const lower = r.toLowerCase();
      return (
        lower === 'lab technician' ||
        lower === 'technician' ||
        lower === 'lab-technician' ||
        lower.includes('technician')
      );
    });
    if (hasTechRole) return true;

    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: { slug: 'lab-technician' },
      },
    });

    return Boolean(userRole);
  }

  /**
   * Resolve active branch ID for Lab Admin
   */
  async resolveLabAdminBranch(actor: AuthenticatedUser, tenantId: string): Promise<string> {
    const labAdminRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: { slug: 'lab-admin' },
      },
    });

    if (labAdminRole?.branchId) {
      return labAdminRole.branchId;
    }

    const defaultUserBranch = await this.prisma.userBranch.findFirst({
      where: {
        userId: actor.id,
        branch: { tenantId },
      },
      orderBy: { isDefault: 'desc' },
      select: { branchId: true },
    });

    if (defaultUserBranch?.branchId) {
      return defaultUserBranch.branchId;
    }

    const firstBranch = await this.prisma.branch.findFirst({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true },
    });

    if (!firstBranch) {
      throw new BadRequestException('No active branch found in this organization.');
    }

    return firstBranch.id;
  }

  /**
   * Find the default Lab Admin for a branch.
   * Every branch must have a default admin.
   * If no admin is currently marked isDefault: true, self-heals by promoting the earliest active lab-admin of that branch.
   */
  async findBranchDefaultAdmin(tenantId: string, branchId: string) {
    // 1. Check for explicit isDefault: true lab-admin in this branch
    const defaultUserBranch = await this.prisma.userBranch.findFirst({
      where: {
        branchId,
        isDefault: true,
        user: {
          status: UserStatus.ACTIVE,
          memberships: { some: { tenantId } },
          userRoles: {
            some: {
              tenantId,
              role: { slug: 'lab-admin' },
            },
          },
        },
      },
      include: { user: true },
    });

    if (defaultUserBranch?.user) {
      return defaultUserBranch.user;
    }

    // 2. Self-Healing Fallback: If no admin is marked default yet, find the earliest active lab-admin in this branch
    const earliestBranchAdmin = await this.prisma.userBranch.findFirst({
      where: {
        branchId,
        user: {
          status: UserStatus.ACTIVE,
          memberships: { some: { tenantId } },
          userRoles: {
            some: {
              tenantId,
              role: { slug: 'lab-admin' },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
      include: { user: true },
    });

    if (earliestBranchAdmin?.user) {
      // Auto-set isDefault so future lookups are instantaneous
      try {
        await this.prisma.userBranch.update({
          where: { id: earliestBranchAdmin.id },
          data: { isDefault: true },
        });
      } catch (err) {
        this.logger.warn(`Failed to auto-set isDefault on userBranch ${earliestBranchAdmin.id}: ${(err as any).message}`);
      }
      return earliestBranchAdmin.user;
    }

    // 3. Fallback to any active tenant administrator
    const tenantAdmin = await this.prisma.user.findFirst({
      where: {
        status: UserStatus.ACTIVE,
        memberships: { some: { tenantId } },
        userRoles: {
          some: {
            tenantId,
            role: { slug: { in: ['tenant-admin', 'admin'] } },
          },
        },
      },
    });

    return tenantAdmin || null;
  }

  /**
   * Check if an actor is the default Lab Admin for a specific branch (or tenant owner/super admin)
   */
  async isBranchDefaultAdmin(actor: AuthenticatedUser, tenantId: string, branchId: string): Promise<boolean> {
    if (actor.isSuperAdmin) return true;

    // Tenant owner has organization-wide authority
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { userId: actor.id, tenantId, isOwner: true },
    });
    if (membership) return true;

    // Resolve the default admin for this branch
    const defaultAdmin = await this.findBranchDefaultAdmin(tenantId, branchId);
    if (!defaultAdmin) {
      return this.isTenantAdminUser(actor, tenantId);
    }

    return defaultAdmin.id === actor.id;
  }

  /**
   * Preview next sequential folio number for branch
   */
  async getNextFolioPreview(
    tenantId: string,
    actor: AuthenticatedUser,
    branchId?: string,
  ): Promise<{ folioNumber: string; branchId: string }> {
    const isLabAdmin = await this.isLabAdminUser(actor, tenantId);
    let targetBranchId = branchId;

    if (isLabAdmin) {
      targetBranchId = await this.resolveLabAdminBranch(actor, tenantId);
    } else {
      if (!targetBranchId) {
        const firstBranch = await this.prisma.branch.findFirst({
          where: { tenantId, status: 'ACTIVE' },
          select: { id: true },
        });
        if (!firstBranch) {
          throw new BadRequestException('No active branch found.');
        }
        targetBranchId = firstBranch.id;
      }
    }

    const candidate = await generateFolioNumber(this.prisma, tenantId, targetBranchId);
    return { folioNumber: candidate, branchId: targetBranchId };
  }

  /**
   * Create Work Order (Restricted strictly to Lab Administrators)
   */
  async create(tenantId: string, actor: AuthenticatedUser, dto: CreateWorkOrderDto) {
    const isLabAdmin = await this.isLabAdminUser(actor, tenantId);
    if (!isLabAdmin) {
      throw new ForbiddenException(
        'Permission denied: Only Lab Administrators can create Work Orders.',
      );
    }

    const branchId = await this.resolveLabAdminBranch(actor, tenantId);

    // Verify Doctor belongs to tenant
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: dto.doctorId, tenantId },
    });
    if (!doctor) {
      throw new NotFoundException(`Doctor with ID "${dto.doctorId}" not found.`);
    }

    // Verify ProsthesisType belongs to tenant
    const prosthesisType = await this.prisma.prosthesisType.findFirst({
      where: { id: dto.prosthesisTypeId, tenantId },
    });
    if (!prosthesisType) {
      throw new NotFoundException(`Prosthesis Type with ID "${dto.prosthesisTypeId}" not found.`);
    }

    // Generate unique folio number
    const folioNumber = await generateFolioNumber(this.prisma, tenantId, branchId);

    // Parse delivery date
    let deliveryDate: Date | null = null;
    if (dto.deliveryDate) {
      deliveryDate = parseCalendarDate(dto.deliveryDate);
    }

    const initialStatus =
      dto.action === 'createAndAssign' ? WorkOrderStatus.ASSIGNED : WorkOrderStatus.CREATED;

    // Database transaction: WorkOrder + initial Note + Processes
    const workOrder = await this.prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.create({
        data: {
          tenantId,
          branchId,
          moduleKey: 'LAB',
          folioNumber,
          fileNumber: dto.fileNumber?.trim() || null,
          boxNumber: dto.boxNumber?.trim() || null,
          patient: dto.patient?.trim() || null,
          doctorId: dto.doctorId,
          prosthesisTypeId: dto.prosthesisTypeId,
          specification: dto.specification.trim(),
          color: dto.color.trim(),
          notes: dto.notes?.trim() || null,
          deliveryDate,
          totalQuote: dto.totalQuote !== undefined ? dto.totalQuote : 0,
          initialPayment: dto.initialPayment !== undefined ? dto.initialPayment : 0,
          paymentReferenceNumbers: dto.paymentReferenceNumbers || [],
          status: initialStatus,
          createdById: actor.id,
        },
      });

      // Record initial note in WorkOrderNote history if provided
      if (dto.notes && dto.notes.trim().length > 0) {
        await tx.workOrderNote.create({
          data: {
            workOrderId: wo.id,
            userId: actor.id,
            note: dto.notes.trim(),
          },
        });
      }

      // Record initial payment in WorkOrderPayment history if provided
      if (dto.initialPayment && Number(dto.initialPayment) > 0) {
        await tx.workOrderPayment.create({
          data: {
            workOrderId: wo.id,
            amount: Number(dto.initialPayment),
            notes: 'Initial payment registered at order creation',
            status: 'SETTLED',
            recordedById: actor.id,
            reference: dto.paymentReferenceNumbers && dto.paymentReferenceNumbers.length > 0 ? dto.paymentReferenceNumbers[0] : null,
          },
        });
      }

      // Create process items
      if (Array.isArray(dto.processes) && dto.processes.length > 0) {
        const sortedProcesses = [...dto.processes].sort((a, b) => a.sequence - b.sequence);
        for (let i = 0; i < sortedProcesses.length; i++) {
          const p = sortedProcesses[i];
          const isExt = p.processType === ProcessType.EXTERNAL_VERIFICATION;
          await tx.workOrderProcess.create({
            data: {
              workOrderId: wo.id,
              processId: p.processId || null,
              processName: p.processName.trim(),
              processType: p.processType || ProcessType.PRODUCTION,
              technicianId: isExt ? null : (p.technicianId || null),
              doctorId: isExt ? (p.doctorId || dto.doctorId) : null,
              sequence: i,
              isVerification: Boolean(p.isVerification || isExt || p.processType === ProcessType.INTERNAL_VERIFICATION),
              status: ProcessStatus.NOT_STARTED,
            },
          });
        }
      }

      return wo;
    });

    // Collect all assigned technician IDs across processes
    const assignedTechIds = new Set<string>();
    if (Array.isArray(dto.processes)) {
      for (const p of dto.processes) {
        if (p.technicianId) {
          assignedTechIds.add(p.technicianId);
        }
      }
    }

    // If 'createAndAssign' or any step assigned, dispatch in-app notification to the technician assigned to Step 1
    if (Array.isArray(dto.processes) && dto.processes.length > 0) {
      const sortedProcesses = [...dto.processes].sort((a, b) => a.sequence - b.sequence);
      const firstProcess = sortedProcesses[0];
      if (firstProcess.technicianId && (dto.action === 'createAndAssign' || workOrder.status === WorkOrderStatus.ASSIGNED)) {
        try {
          await this.notificationsService.create({
            tenantId,
            userId: firstProcess.technicianId,
            moduleKey: 'LAB',
            type: 'WORK_ORDER',
            title: 'Work Order Assigned',
            body: `You have been assigned to process "${firstProcess.processName}" on Work Order "${folioNumber}".`,
            data: { workOrderId: workOrder.id, folioNumber },
          });
        } catch (err) {
          this.logger.warn(`Failed to dispatch assignment notification: ${(err as any).message}`);
        }
      }
    }

    // Real-time socket broadcast to tenant room
    try {
      this.notificationsGateway.sendToTenant(tenantId, 'work_order:created', {
        workOrderId: workOrder.id,
        folioNumber: workOrder.folioNumber,
        status: workOrder.status,
      });
    } catch (err) {
      this.logger.warn(`Failed to broadcast work_order:created: ${(err as any).message}`);
    }

    // Real-time socket broadcast to each assigned technician
    for (const techId of assignedTechIds) {
      try {
        this.notificationsGateway.sendToUser(techId, 'work_order:assigned', {
          workOrderId: workOrder.id,
          folioNumber: workOrder.folioNumber,
          status: workOrder.status,
        });
      } catch (err) {
        this.logger.warn(`Failed to send work_order:assigned to tech ${techId}: ${(err as any).message}`);
      }
    }

    // Audit log
    await this.auditService.log({
      tenantId,
      branchId,
      moduleKey: 'LAB',
      userId: actor.id,
      action: dto.action === 'createAndAssign' ? 'CREATE_AND_ASSIGN' : 'CREATE',
      resourceType: 'WORK_ORDER',
      resourceId: workOrder.id,
      newValues: {
        folioNumber: workOrder.folioNumber,
        patient: workOrder.patient,
        doctorId: workOrder.doctorId,
        prosthesisTypeId: workOrder.prosthesisTypeId,
        status: workOrder.status,
      },
    });

    this.logger.log(
      `Work Order ${workOrder.folioNumber} created by Lab Admin ${actor.id} for branch ${branchId}`,
    );

    return this.findOne(tenantId, actor, workOrder.id);
  }

  /**
   * List all Work Orders (scoped by role/branch, paginated, searchable)
   */
  async findAll(tenantId: string, actor: AuthenticatedUser, query: QueryWorkOrdersDto) {
    const isLabAdmin = await this.isLabAdminUser(actor, tenantId);
    const isTenantAdmin = await this.isTenantAdminUser(actor, tenantId);

    let branchFilter: string | undefined = query.branchId;
    if (isLabAdmin) {
      branchFilter = await this.resolveLabAdminBranch(actor, tenantId);
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      ...(branchFilter && { branchId: branchFilter }),
      ...(query.status && query.status !== 'ALL' && { status: query.status as WorkOrderStatus }),
      ...(query.doctorId && { doctorId: query.doctorId }),
    };

    if (query.search && query.search.trim().length > 0) {
      const q = query.search.trim();
      where.OR = [
        { folioNumber: { contains: q, mode: 'insensitive' } },
        { patient: { contains: q, mode: 'insensitive' } },
        { fileNumber: { contains: q, mode: 'insensitive' } },
        { boxNumber: { contains: q, mode: 'insensitive' } },
        { doctor: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.workOrder.count({ where }),
      this.prisma.workOrder.findMany({
        where,
        include: {
          doctor: { select: { id: true, name: true, clinicName: true, type: true } },
          prosthesisType: { select: { id: true, name: true, price: true } },
          branch: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          processes: {
            orderBy: { sequence: 'asc' },
            select: {
              id: true,
              processName: true,
              processType: true,
              technicianId: true,
              doctorId: true,
              sequence: true,
              isVerification: true,
              status: true,
              technician: { select: { id: true, name: true } },
              doctor: { select: { id: true, name: true, clinicName: true } },
            },
          },
          _count: { select: { notesHistory: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

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
   * Find single Work Order details with processes and note history
   */
  async findOne(tenantId: string, actor: AuthenticatedUser, id: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, tenantId },
      include: {
        doctor: { select: { id: true, name: true, clinicName: true, email: true, phone: true, type: true } },
        prosthesisType: { select: { id: true, name: true, price: true } },
        branch: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        processes: {
          orderBy: { sequence: 'asc' },
          include: {
            technician: { select: { id: true, name: true, email: true } },
            doctor: { select: { id: true, name: true, clinicName: true } },
            activityLogs: {
              orderBy: { timestamp: 'desc' },
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
        notesHistory: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: {
            recordedBy: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order with ID "${id}" not found.`);
    }

    // Payment redaction for Technicians
    const isTech = await this.isLabTechnicianUser(actor, tenantId);
    if (isTech) {
      workOrder.totalQuote = 0 as any;
      workOrder.initialPayment = 0 as any;
      workOrder.paymentReferenceNumbers = [];
      (workOrder as any).payments = [];
      if (workOrder.prosthesisType) {
        workOrder.prosthesisType.price = 0 as any;
      }
    } else {
      // Fallback synthesis if legacy work order has initialPayment > 0 and no payment rows yet
      if ((!workOrder.payments || workOrder.payments.length === 0) && Number(workOrder.initialPayment) > 0) {
        (workOrder as any).payments = [
          {
            id: 'initial-' + workOrder.id,
            workOrderId: workOrder.id,
            amount: Number(workOrder.initialPayment),
            notes: 'Initial payment registered at order creation',
            reference: workOrder.paymentReferenceNumbers?.[0] || null,
            status: 'SETTLED',
            recordedById: workOrder.createdById,
            recordedBy: workOrder.createdBy,
            createdAt: workOrder.createdAt,
          },
        ];
      }
    }

    return workOrder;
  }

  /**
   * Add a note to Work Order history (Admins and Technicians)
   */
  async addNote(tenantId: string, actor: AuthenticatedUser, workOrderId: string, noteText: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      select: { id: true, folioNumber: true },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order with ID "${workOrderId}" not found.`);
    }

    const noteRecord = await this.prisma.workOrderNote.create({
      data: {
        workOrderId,
        userId: actor.id,
        note: noteText.trim(),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await this.auditService.log({
      tenantId,
      userId: actor.id,
      moduleKey: 'LAB',
      action: 'ADD_NOTE',
      resourceType: 'WORK_ORDER',
      resourceId: workOrderId,
      newValues: { noteId: noteRecord.id },
    });

    return noteRecord;
  }

  /**
   * Update a note in Work Order history
   * - Admin can edit any note
   * - Technician can only edit notes they created
   */
  async updateNote(
    tenantId: string,
    actor: AuthenticatedUser,
    workOrderId: string,
    noteId: string,
    noteText: string,
  ) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      select: { id: true },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order with ID "${workOrderId}" not found.`);
    }

    const noteRecord = await this.prisma.workOrderNote.findFirst({
      where: { id: noteId, workOrderId },
    });

    if (!noteRecord) {
      throw new NotFoundException(`Note with ID "${noteId}" not found.`);
    }

    // Role check: Admins can edit any note; technicians can only edit their own
    const isAdmin =
      (await this.isTenantAdminUser(actor, tenantId)) ||
      (await this.isLabAdminUser(actor, tenantId));

    if (!isAdmin && noteRecord.userId !== actor.id) {
      throw new ForbiddenException('You can only edit notes created by yourself.');
    }

    const updated = await this.prisma.workOrderNote.update({
      where: { id: noteId },
      data: { note: noteText.trim() },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await this.auditService.log({
      tenantId,
      userId: actor.id,
      moduleKey: 'LAB',
      action: 'UPDATE_NOTE',
      resourceType: 'WORK_ORDER',
      resourceId: workOrderId,
      oldValues: { note: noteRecord.note },
      newValues: { note: updated.note },
    });

    return updated;
  }

  /**
   * Delete a note from Work Order history
   * - Admin can delete any note
   * - Technician can only delete notes they created
   */
  async deleteNote(
    tenantId: string,
    actor: AuthenticatedUser,
    workOrderId: string,
    noteId: string,
  ) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      select: { id: true },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order with ID "${workOrderId}" not found.`);
    }

    const noteRecord = await this.prisma.workOrderNote.findFirst({
      where: { id: noteId, workOrderId },
    });

    if (!noteRecord) {
      throw new NotFoundException(`Note with ID "${noteId}" not found.`);
    }

    // Role check: Admins can delete any note; technicians can only delete their own
    const isAdmin =
      (await this.isTenantAdminUser(actor, tenantId)) ||
      (await this.isLabAdminUser(actor, tenantId));

    if (!isAdmin && noteRecord.userId !== actor.id) {
      throw new ForbiddenException('You can only delete notes created by yourself.');
    }

    await this.prisma.workOrderNote.delete({
      where: { id: noteId },
    });

    await this.auditService.log({
      tenantId,
      userId: actor.id,
      moduleKey: 'LAB',
      action: 'DELETE_NOTE',
      resourceType: 'WORK_ORDER',
      resourceId: workOrderId,
      oldValues: { noteId, note: noteRecord.note },
    });

    return { success: true };
  }

  /**
   * Delete Work Order (Restricted strictly to Platform Super Admin and Tenant Admin)
   */
  async remove(tenantId: string, actor: AuthenticatedUser, id: string) {
    const isTenantAdmin = await this.isTenantAdminUser(actor, tenantId);
    if (!isTenantAdmin) {
      throw new ForbiddenException(
        'Permission denied: Only Platform Administrators and Tenant Administrators can delete Work Orders.',
      );
    }

    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, tenantId },
      select: { id: true, folioNumber: true, branchId: true },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order with ID "${id}" not found.`);
    }

    await this.prisma.workOrder.delete({
      where: { id },
    });

    await this.auditService.log({
      tenantId,
      branchId: workOrder.branchId,
      moduleKey: 'LAB',
      userId: actor.id,
      action: 'DELETE',
      resourceType: 'WORK_ORDER',
      resourceId: id,
      oldValues: { folioNumber: workOrder.folioNumber },
    });

    this.logger.log(`Work Order ${workOrder.folioNumber} deleted by Admin ${actor.id}`);
    return { success: true, message: `Work Order ${workOrder.folioNumber} has been deleted.` };
  }

  /**
   * Update Work Order (Restricted to Lab Administrators)
   */
  async update(tenantId: string, actor: AuthenticatedUser, id: string, dto: UpdateWorkOrderDto) {
    const isLabAdmin = await this.isLabAdminUser(actor, tenantId);
    if (!isLabAdmin) {
      throw new ForbiddenException('Only Lab Administrators can update Work Orders.');
    }

    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, tenantId },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order with ID "${id}" not found.`);
    }

    const updateData: any = {};
    if (dto.patient !== undefined) updateData.patient = dto.patient;
    if (dto.fileNumber !== undefined) updateData.fileNumber = dto.fileNumber;
    if (dto.boxNumber !== undefined) updateData.boxNumber = dto.boxNumber;
    if (dto.specification !== undefined) updateData.specification = dto.specification;
    if (dto.color !== undefined) updateData.color = dto.color;
    if (dto.deliveryDate !== undefined) {
      updateData.deliveryDate = dto.deliveryDate ? parseCalendarDate(dto.deliveryDate) : null;
    }
    if (dto.totalQuote !== undefined) updateData.totalQuote = dto.totalQuote;
    if (dto.initialPayment !== undefined) updateData.initialPayment = dto.initialPayment;
    if (dto.paymentReferenceNumbers !== undefined) {
      updateData.paymentReferenceNumbers = dto.paymentReferenceNumbers;
    }
    if (dto.doctorId !== undefined) updateData.doctorId = dto.doctorId;
    if (dto.prosthesisTypeId !== undefined) updateData.prosthesisTypeId = dto.prosthesisTypeId;

    const isSaveAndAssign = dto.action === 'saveAndAssign';
    if (isSaveAndAssign && workOrder.status === WorkOrderStatus.CREATED) {
      updateData.status = WorkOrderStatus.ASSIGNED;
    }

    await this.prisma.$transaction(async (tx) => {
      // Record new note if provided
      if (dto.notes && dto.notes.trim().length > 0) {
        await tx.workOrderNote.create({
          data: {
            workOrderId: id,
            userId: actor.id,
            note: dto.notes.trim(),
          },
        });
      }

      // Handle processes updates and lifecycle enforcement
      if (Array.isArray(dto.processes)) {
        const existingProcs = await tx.workOrderProcess.findMany({
          where: { workOrderId: id },
          orderBy: { sequence: 'asc' },
        });

        const existingMap = new Map(existingProcs.map((p) => [p.id, p]));
        const incomingIds = new Set(
          dto.processes.map((p) => p.id).filter(Boolean) as string[],
        );

        // 1. Deletion check: Any existing process removed in the payload
        for (const existing of existingProcs) {
          if (!incomingIds.has(existing.id)) {
            if (existing.status !== ProcessStatus.NOT_STARTED) {
              throw new BadRequestException(
                `Cannot delete process step "${existing.processName}" because it has already started (status: ${existing.status}).`,
              );
            }
            await tx.workOrderProcess.delete({ where: { id: existing.id } });
          }
        }

        // 2. Update existing & create newly added processes
        for (let i = 0; i < dto.processes.length; i++) {
          const p = dto.processes[i];
          const isExt = p.processType === ProcessType.EXTERNAL_VERIFICATION;
          const targetTechId = isExt ? null : p.technicianId || null;
          const targetDocId = isExt ? p.doctorId || dto.doctorId || workOrder.doctorId : null;

          if (p.id && existingMap.has(p.id)) {
            const existing = existingMap.get(p.id)!;
            // Locking rule: once started, technician cannot be changed
            if (existing.status !== ProcessStatus.NOT_STARTED) {
              if (existing.technicianId !== targetTechId) {
                throw new BadRequestException(
                  `Cannot change assigned technician for process "${existing.processName}" because it has already started.`,
                );
              }
            }

            await tx.workOrderProcess.update({
              where: { id: p.id },
              data: {
                sequence: i,
                technicianId: targetTechId,
                doctorId: targetDocId,
                processName: p.processName.trim(),
              },
            });
          } else {
            // New process step added
            await tx.workOrderProcess.create({
              data: {
                workOrderId: id,
                processId: p.processId || null,
                processName: p.processName.trim(),
                processType: p.processType || ProcessType.PRODUCTION,
                technicianId: targetTechId,
                doctorId: targetDocId,
                sequence: i,
                isVerification: Boolean(
                  p.isVerification ||
                    isExt ||
                    p.processType === ProcessType.INTERNAL_VERIFICATION,
                ),
                status: ProcessStatus.NOT_STARTED,
              },
            });
          }
        }
      }

      // Update work order fields
      await tx.workOrder.update({
        where: { id },
        data: updateData,
      });
    });

    // If 'saveAndAssign', dispatch assignment notification to step 1 technician
    if (isSaveAndAssign) {
      const procs = await this.prisma.workOrderProcess.findMany({
        where: { workOrderId: id },
        orderBy: { sequence: 'asc' },
      });
      if (procs.length > 0 && procs[0].technicianId) {
        try {
          await this.notificationsService.create({
            tenantId,
            userId: procs[0].technicianId,
            moduleKey: 'LAB',
            type: 'WORK_ORDER',
            title: 'Work Order Assigned',
            body: `You have been assigned to process "${procs[0].processName}" on Work Order "${workOrder.folioNumber}".`,
            data: { workOrderId: workOrder.id, folioNumber: workOrder.folioNumber },
          });
        } catch (err) {
          this.logger.warn(`Failed to dispatch assignment notification: ${(err as any).message}`);
        }
      }
    }

    // Real-time socket broadcast to tenant room
    try {
      this.notificationsGateway.sendToTenant(tenantId, 'work_order:updated', {
        workOrderId: id,
        folioNumber: workOrder.folioNumber,
        status: updateData.status || workOrder.status,
      });
    } catch (err) {
      this.logger.warn(`Failed to broadcast work_order:updated: ${(err as any).message}`);
    }

    if (dto.processes) {
      for (const p of dto.processes) {
        if (p.technicianId) {
          try {
            this.notificationsGateway.sendToUser(p.technicianId, 'work_order:assigned', {
              workOrderId: id,
              folioNumber: workOrder.folioNumber,
            });
          } catch (err) {
            this.logger.warn(`Failed to send work_order:assigned to tech ${p.technicianId}: ${(err as any).message}`);
          }
        }
      }
    }

    // Audit log
    await this.auditService.log({
      tenantId,
      branchId: workOrder.branchId,
      moduleKey: 'LAB',
      userId: actor.id,
      action: isSaveAndAssign ? 'UPDATE_AND_ASSIGN' : 'UPDATE',
      resourceType: 'WORK_ORDER',
      resourceId: id,
      newValues: {
        ...updateData,
        processCount: dto.processes ? dto.processes.length : undefined,
      },
      oldValues: {
        patient: workOrder.patient,
        color: workOrder.color,
        totalQuote: workOrder.totalQuote,
        status: workOrder.status,
      },
    });

    return this.findOne(tenantId, actor, id);
  }

  /**
   * Technician Dashboard Stats & Active Queue
   */
  async getTechnicianDashboard(tenantId: string, actor: AuthenticatedUser) {
    const assignedProcesses = await this.prisma.workOrderProcess.findMany({
      where: {
        technicianId: actor.id,
        workOrder: {
          tenantId,
          status: {
            notIn: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED],
          },
        },
      },
      include: {
        workOrder: {
          select: {
            id: true,
            folioNumber: true,
            boxNumber: true,
            patient: true,
            specification: true,
            color: true,
            notes: true,
            status: true,
            deliveryDate: true,
            createdAt: true,
            prosthesisType: { select: { id: true, name: true } },
            doctor: { select: { id: true, name: true, clinicName: true } },
            processes: {
              orderBy: { sequence: 'asc' },
              select: {
                id: true,
                sequence: true,
                processName: true,
                status: true,
                technicianId: true,
                totalActiveDuration: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const pendingSteps = assignedProcesses.filter(
      (p) => p.status === ProcessStatus.NOT_STARTED,
    ).length;
    const activeSteps = assignedProcesses.filter(
      (p) => p.status === ProcessStatus.IN_PROGRESS,
    ).length;
    const pausedSteps = assignedProcesses.filter(
      (p) => p.status === ProcessStatus.PAUSED,
    ).length;
    const completedToday = assignedProcesses.filter(
      (p) =>
        p.status === ProcessStatus.COMPLETED &&
        p.endedAt &&
        new Date(p.endedAt) >= todayStart,
    ).length;

    // Queue of active work orders (NOT_STARTED, IN_PROGRESS, PAUSED)
    const workOrderMap = new Map<string, any>();

    for (const ap of assignedProcesses) {
      if (ap.status === ProcessStatus.COMPLETED) continue;
      if (!workOrderMap.has(ap.workOrderId)) {
        const wo = ap.workOrder;
        // Check readiness: is this step ready to start?
        const priorIncomplete = wo.processes.find(
          (p) => p.sequence < ap.sequence && p.status !== ProcessStatus.COMPLETED,
        );
        const isReadyToStart = !priorIncomplete;

        workOrderMap.set(ap.workOrderId, {
          workOrderId: wo.id,
          folioNumber: wo.folioNumber,
          patient: wo.patient,
          prosthesisTypeName: wo.prosthesisType?.name || '',
          boxNumber: wo.boxNumber,
          specification: wo.specification,
          color: wo.color,
          notes: wo.notes,
          workOrderStatus: wo.status,
          deliveryDate: wo.deliveryDate,
          currentProcessId: ap.id,
          currentStepSequence: ap.sequence + 1,
          currentStepName: ap.processName,
          currentStepStatus: ap.status,
          isReadyToStart,
          reworkActive: Boolean(ap.reworkActive),
          reworkCount: ap.reworkCount || 0,
          doctorName: wo.doctor?.name,
          clinicName: wo.doctor?.clinicName,
          createdAt: wo.createdAt,
        });
      }
    }

    return {
      stats: {
        pendingSteps,
        activeSteps,
        pausedSteps,
        completedToday,
      },
      queue: Array.from(workOrderMap.values()),
    };
  }

  /**
   * Find Work Orders assigned to authenticated technician
   */
  async findTechnicianWorkOrders(
    tenantId: string,
    actor: AuthenticatedUser,
    query: { search?: string; status?: string; page?: number | string; limit?: number | string },
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      processes: {
        some: {
          technicianId: actor.id,
          ...(query.status === 'NOT_STARTED' && { status: ProcessStatus.NOT_STARTED }),
          ...(query.status === 'IN_PROGRESS_PAUSED' && {
            status: { in: [ProcessStatus.IN_PROGRESS, ProcessStatus.PAUSED] },
          }),
          ...(query.status === 'COMPLETED' && { status: ProcessStatus.COMPLETED }),
        },
      },
    };

    if (query.search && query.search.trim().length > 0) {
      const q = query.search.trim();
      where.OR = [
        { folioNumber: { contains: q, mode: 'insensitive' } },
        { patient: { contains: q, mode: 'insensitive' } },
        { boxNumber: { contains: q, mode: 'insensitive' } },
        { doctor: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, orders] = await Promise.all([
      this.prisma.workOrder.count({ where }),
      this.prisma.workOrder.findMany({
        where,
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          moduleKey: true,
          folioNumber: true,
          fileNumber: true,
          boxNumber: true,
          patient: true,
          specification: true,
          color: true,
          notes: true,
          deliveryDate: true,
          status: true,
          qrToken: true,
          createdAt: true,
          updatedAt: true,
          doctor: { select: { id: true, name: true, clinicName: true, email: true, phone: true } },
          prosthesisType: { select: { id: true, name: true } }, // Strict payment redaction
          processes: {
            orderBy: { sequence: 'asc' },
            select: {
              id: true,
              processName: true,
              processType: true,
              technicianId: true,
              doctorId: true,
              sequence: true,
              isVerification: true,
              status: true,
              startedAt: true,
              endedAt: true,
              totalActiveDuration: true,
              technician: { select: { id: true, name: true } },
              doctor: { select: { id: true, name: true, clinicName: true } },
            },
          },
          _count: { select: { notesHistory: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const data = orders.map((wo) => {
      const myProcess = wo.processes.find((p) => p.technicianId === actor.id);
      return {
        ...wo,
        totalQuote: 0,
        initialPayment: 0,
        paymentReferenceNumbers: [],
        myProcess: myProcess || null,
      };
    });

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
   * Start a work order process step
   */
  async startProcess(
    tenantId: string,
    actor: AuthenticatedUser,
    workOrderId: string,
    processId: string,
  ) {
    const isAdmin =
      (await this.isTenantAdminUser(actor, tenantId)) ||
      (await this.isLabAdminUser(actor, tenantId));

    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      include: {
        processes: { orderBy: { sequence: 'asc' } },
      },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order with ID "${workOrderId}" not found.`);
    }

    const currentProcess = workOrder.processes.find((p) => p.id === processId);
    if (!currentProcess) {
      throw new NotFoundException(`Process with ID "${processId}" not found in this Work Order.`);
    }

    if (!isAdmin && currentProcess.technicianId !== actor.id) {
      throw new ForbiddenException('You are not assigned to this process step.');
    }

    if (currentProcess.status === ProcessStatus.IN_PROGRESS) {
      return this.findOne(tenantId, actor, workOrderId);
    }

    if (currentProcess.status === ProcessStatus.COMPLETED) {
      throw new BadRequestException('This process step has already been completed.');
    }

    // Sequential rule: all prior processes must be COMPLETED
    const priorIncomplete = workOrder.processes.find(
      (p) => p.sequence < currentProcess.sequence && p.status !== ProcessStatus.COMPLETED,
    );
    if (priorIncomplete) {
      throw new BadRequestException(
        `Cannot start this step. Prior step "${priorIncomplete.processName}" must be completed first.`,
      );
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.workOrderProcess.update({
        where: { id: processId },
        data: {
          status: ProcessStatus.IN_PROGRESS,
          startedAt: currentProcess.startedAt || now,
          lastPausedAt: null,
        },
      });

      // Determine correct Work Order status based on process type
      const isVerificationStep =
        currentProcess.isVerification ||
        currentProcess.processType === ProcessType.INTERNAL_VERIFICATION ||
        currentProcess.processType === ProcessType.EXTERNAL_VERIFICATION;

      if (isVerificationStep) {
        // Verification step: set WO status to INTERNAL_VERIFICATION or EXTERNAL_VERIFICATION
        const verificationStatus =
          currentProcess.processType === ProcessType.EXTERNAL_VERIFICATION
            ? WorkOrderStatus.EXTERNAL_VERIFICATION
            : WorkOrderStatus.INTERNAL_VERIFICATION;
        await tx.workOrder.update({
          where: { id: workOrderId },
          data: { status: verificationStatus },
        });
      } else if (
        workOrder.status === WorkOrderStatus.CREATED ||
        workOrder.status === WorkOrderStatus.ASSIGNED
      ) {
        await tx.workOrder.update({
          where: { id: workOrderId },
          data: { status: WorkOrderStatus.IN_PROGRESS },
        });
      }

      await tx.processActivityLog.create({
        data: {
          workOrderProcessId: processId,
          userId: actor.id,
          action: 'START',
          notes: isVerificationStep ? 'Verification started by admin' : 'Process started by technician',
          timestamp: now,
        },
      });
    });

    await this.auditService.log({
      tenantId,
      branchId: workOrder.branchId,
      moduleKey: 'LAB',
      userId: actor.id,
      action: 'PROCESS_START',
      resourceType: 'WORK_ORDER_PROCESS',
      resourceId: processId,
      newValues: {
        workOrderId,
        processName: currentProcess.processName,
        status: ProcessStatus.IN_PROGRESS,
      },
    });

    return this.findOne(tenantId, actor, workOrderId);
  }

  /**
   * Pause an in-progress process step
   */
  async pauseProcess(
    tenantId: string,
    actor: AuthenticatedUser,
    workOrderId: string,
    processId: string,
  ) {
    const isAdmin =
      (await this.isTenantAdminUser(actor, tenantId)) ||
      (await this.isLabAdminUser(actor, tenantId));

    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      include: {
        processes: { orderBy: { sequence: 'asc' } },
      },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order with ID "${workOrderId}" not found.`);
    }

    const currentProcess = workOrder.processes.find((p) => p.id === processId);
    if (!currentProcess) {
      throw new NotFoundException(`Process with ID "${processId}" not found.`);
    }

    if (!isAdmin && currentProcess.technicianId !== actor.id) {
      throw new ForbiddenException('You are not assigned to this process step.');
    }

    if (currentProcess.status !== ProcessStatus.IN_PROGRESS) {
      throw new BadRequestException('Process is not currently in progress.');
    }

    const now = new Date();
    const lastActivityTime = currentProcess.lastPausedAt
      ? currentProcess.updatedAt
      : currentProcess.startedAt || now;
    const elapsedSeconds = Math.max(
      0,
      Math.floor((now.getTime() - new Date(lastActivityTime).getTime()) / 1000),
    );
    const newTotalActive = currentProcess.totalActiveDuration + elapsedSeconds;

    await this.prisma.$transaction(async (tx) => {
      await tx.workOrderProcess.update({
        where: { id: processId },
        data: {
          status: ProcessStatus.PAUSED,
          lastPausedAt: now,
          pauseCount: currentProcess.pauseCount + 1,
          totalActiveDuration: newTotalActive,
        },
      });

      await tx.processActivityLog.create({
        data: {
          workOrderProcessId: processId,
          userId: actor.id,
          action: 'PAUSE',
          notes: 'Process paused',
          timestamp: now,
        },
      });
    });

    await this.auditService.log({
      tenantId,
      branchId: workOrder.branchId,
      moduleKey: 'LAB',
      userId: actor.id,
      action: 'PROCESS_PAUSE',
      resourceType: 'WORK_ORDER_PROCESS',
      resourceId: processId,
      newValues: {
        workOrderId,
        status: ProcessStatus.PAUSED,
        totalActiveDuration: newTotalActive,
      },
    });

    return this.findOne(tenantId, actor, workOrderId);
  }

  /**
   * Resume a paused process step
   */
  async resumeProcess(
    tenantId: string,
    actor: AuthenticatedUser,
    workOrderId: string,
    processId: string,
  ) {
    const isAdmin =
      (await this.isTenantAdminUser(actor, tenantId)) ||
      (await this.isLabAdminUser(actor, tenantId));

    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      include: {
        processes: { orderBy: { sequence: 'asc' } },
      },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order with ID "${workOrderId}" not found.`);
    }

    const currentProcess = workOrder.processes.find((p) => p.id === processId);
    if (!currentProcess) {
      throw new NotFoundException(`Process with ID "${processId}" not found.`);
    }

    if (!isAdmin && currentProcess.technicianId !== actor.id) {
      throw new ForbiddenException('You are not assigned to this process step.');
    }

    if (currentProcess.status !== ProcessStatus.PAUSED) {
      throw new BadRequestException('Process is not currently paused.');
    }

    const now = new Date();
    const pausedAt = currentProcess.lastPausedAt || currentProcess.updatedAt || now;
    const pauseDurationSeconds = Math.max(
      0,
      Math.floor((now.getTime() - new Date(pausedAt).getTime()) / 1000),
    );
    const newTotalPause = currentProcess.totalPauseDuration + pauseDurationSeconds;

    await this.prisma.$transaction(async (tx) => {
      await tx.workOrderProcess.update({
        where: { id: processId },
        data: {
          status: ProcessStatus.IN_PROGRESS,
          lastPausedAt: null,
          totalPauseDuration: newTotalPause,
        },
      });

      await tx.processActivityLog.create({
        data: {
          workOrderProcessId: processId,
          userId: actor.id,
          action: 'RESUME',
          notes: 'Process resumed by technician',
          timestamp: now,
        },
      });
    });

    await this.auditService.log({
      tenantId,
      branchId: workOrder.branchId,
      moduleKey: 'LAB',
      userId: actor.id,
      action: 'PROCESS_RESUME',
      resourceType: 'WORK_ORDER_PROCESS',
      resourceId: processId,
      newValues: {
        workOrderId,
        status: ProcessStatus.IN_PROGRESS,
        totalPauseDuration: newTotalPause,
      },
    });

    return this.findOne(tenantId, actor, workOrderId);
  }

  /**
   * Complete a process step and notify subsequent technician
   */
  async completeProcess(
    tenantId: string,
    actor: AuthenticatedUser,
    workOrderId: string,
    processId: string,
  ) {
    const isAdmin =
      (await this.isTenantAdminUser(actor, tenantId)) ||
      (await this.isLabAdminUser(actor, tenantId));

    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      include: {
        processes: { orderBy: { sequence: 'asc' } },
      },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order with ID "${workOrderId}" not found.`);
    }

    const currentProcess = workOrder.processes.find((p) => p.id === processId);
    if (!currentProcess) {
      throw new NotFoundException(`Process with ID "${processId}" not found.`);
    }

    if (!isAdmin && currentProcess.technicianId !== actor.id) {
      throw new ForbiddenException('You are not assigned to this process step.');
    }

    if (currentProcess.status === ProcessStatus.COMPLETED) {
      return this.findOne(tenantId, actor, workOrderId);
    }

    const now = new Date();
    let finalActiveDuration = currentProcess.totalActiveDuration;

    if (currentProcess.status === ProcessStatus.IN_PROGRESS) {
      const lastActivityTime = currentProcess.lastPausedAt
        ? currentProcess.updatedAt
        : currentProcess.startedAt || now;
      const elapsedSeconds = Math.max(
        0,
        Math.floor((now.getTime() - new Date(lastActivityTime).getTime()) / 1000),
      );
      finalActiveDuration += elapsedSeconds;
    }

    const mins = Math.floor(finalActiveDuration / 60);
    const secs = finalActiveDuration % 60;
    const durationStr =
      mins > 0
        ? `${mins} minute${mins > 1 ? 's' : ''}${secs > 0 ? ` ${secs}s` : ''}`
        : `${secs}s`;

    let autoStartedExtVerif: {
      processId: string;
      processName: string;
      doctorName: string;
    } | null = null;

    await this.prisma.$transaction(async (tx) => {
      await tx.workOrderProcess.update({
        where: { id: processId },
        data: {
          status: ProcessStatus.COMPLETED,
          endedAt: now,
          lastPausedAt: null,
          totalActiveDuration: finalActiveDuration,
          reworkActive: false,
        },
      });

      await tx.processActivityLog.create({
        data: {
          workOrderProcessId: processId,
          userId: actor.id,
          action: 'COMPLETE',
          notes: `Process completed. Active time: ${durationStr}.`,
          timestamp: now,
        },
      });

      const remainingIncomplete = workOrder.processes.filter(
        (p) => p.id !== processId && p.status !== ProcessStatus.COMPLETED,
      );

      if (remainingIncomplete.length === 0) {
        await tx.workOrder.update({
          where: { id: workOrderId },
          data: { status: WorkOrderStatus.COMPLETED },
        });
      } else {
        // Find the next incomplete step in sequence
        const sortedProcs = [...workOrder.processes].sort((a, b) => a.sequence - b.sequence);
        const nextIncomplete = sortedProcs.find(
          (p) => p.sequence > currentProcess.sequence && p.id !== processId && p.status !== ProcessStatus.COMPLETED,
        );

        if (nextIncomplete) {
          const isNextVerification =
            nextIncomplete.isVerification ||
            nextIncomplete.processType === ProcessType.INTERNAL_VERIFICATION ||
            nextIncomplete.processType === ProcessType.EXTERNAL_VERIFICATION;

          if (isNextVerification) {
            // Set WO status to verification status (Work Order status remains EXTERNAL_VERIFICATION or INTERNAL_VERIFICATION)
            const verificationStatus =
              nextIncomplete.processType === ProcessType.EXTERNAL_VERIFICATION
                ? WorkOrderStatus.EXTERNAL_VERIFICATION
                : WorkOrderStatus.INTERNAL_VERIFICATION;
            await tx.workOrder.update({
              where: { id: workOrderId },
              data: { status: verificationStatus },
            });

            // Special handling for EXTERNAL_VERIFICATION: Local Doctor auto-start vs Integrated Doctor
            if (nextIncomplete.processType === ProcessType.EXTERNAL_VERIFICATION) {
              const assignedDocId = nextIncomplete.doctorId || workOrder.doctorId;
              const doctorRecord = assignedDocId
                ? await tx.doctor.findFirst({ where: { id: assignedDocId, tenantId } })
                : null;

              if (doctorRecord?.type === DoctorType.LOCAL || !doctorRecord?.type) {
                // Local Doctor: Process step status changes to IN_PROGRESS automatically; time audit recorded
                await tx.workOrderProcess.update({
                  where: { id: nextIncomplete.id },
                  data: {
                    status: ProcessStatus.IN_PROGRESS,
                    startedAt: now,
                    lastPausedAt: null,
                    totalActiveDuration: 0,
                  },
                });

                await tx.processActivityLog.create({
                  data: {
                    workOrderProcessId: nextIncomplete.id,
                    userId: actor.id,
                    action: 'START',
                    notes: `External verification auto-started for local doctor: ${doctorRecord?.name || 'Assigned Doctor'}.`,
                    timestamp: now,
                  },
                });

                autoStartedExtVerif = {
                  processId: nextIncomplete.id,
                  processName: nextIncomplete.processName,
                  doctorName: doctorRecord?.name || 'Assigned Doctor',
                };
              } else if (doctorRecord?.type === DoctorType.INTEGRATED) {
                // [INTEGRATED DOCTOR WORKFLOW - FUTURE PHASE 4 CLINIC INTEGRATION]
                // For integrated doctors, verification remains NOT_STARTED awaiting confirmation/signal from Clinic module.
                this.logger.log(
                  `External verification step ${nextIncomplete.id} on WO ${workOrder.folioNumber} assigned to integrated doctor ${doctorRecord.name} (${doctorRecord.id}). Awaiting clinic synchronization.`,
                );
              }
            }
          } else if (
            workOrder.status !== WorkOrderStatus.IN_PROGRESS
          ) {
            await tx.workOrder.update({
              where: { id: workOrderId },
              data: { status: WorkOrderStatus.IN_PROGRESS },
            });
          }
        }
      }
    });

    // Auto-start audit and notification for local doctor external verification
    if (autoStartedExtVerif) {
      await this.auditService.log({
        tenantId,
        branchId: workOrder.branchId,
        moduleKey: 'LAB',
        userId: actor.id,
        action: 'PROCESS_AUTO_START',
        resourceType: 'WORK_ORDER_PROCESS',
        resourceId: autoStartedExtVerif.processId,
        newValues: {
          workOrderId,
          status: ProcessStatus.IN_PROGRESS,
          doctorName: autoStartedExtVerif.doctorName,
          doctorType: 'LOCAL',
        },
      });

      const defaultAdmin = await this.findBranchDefaultAdmin(tenantId, workOrder.branchId);
      if (defaultAdmin) {
        try {
          await this.notificationsService.create({
            tenantId,
            userId: defaultAdmin.id,
            moduleKey: 'LAB',
            type: 'WORK_ORDER',
            title: 'External Verification Auto-Started',
            body: `Work Order "${workOrder.folioNumber}" has automatically started external verification for local Dr. "${autoStartedExtVerif.doctorName}". Timer is running.`,
            data: {
              workOrderId: workOrder.id,
              folioNumber: workOrder.folioNumber,
              processId: autoStartedExtVerif.processId,
            },
          });
        } catch (err) {
          this.logger.warn(`Failed to dispatch auto-start notification to default admin: ${(err as any).message}`);
        }
      }
    }

    // Notify subsequent technician/evaluator if exists
    const sortedProcs = [...workOrder.processes].sort((a, b) => a.sequence - b.sequence);
    const nextProcess = sortedProcs.find(
      (p) => p.sequence > currentProcess.sequence && p.id !== processId && p.status !== ProcessStatus.COMPLETED,
    );

    if (nextProcess && nextProcess.technicianId) {
      const isNextVerification =
        nextProcess.isVerification ||
        nextProcess.processType === ProcessType.INTERNAL_VERIFICATION ||
        nextProcess.processType === ProcessType.EXTERNAL_VERIFICATION;

      try {
        await this.notificationsService.create({
          tenantId,
          userId: nextProcess.technicianId,
          moduleKey: 'LAB',
          type: 'WORK_ORDER',
          title: isNextVerification ? 'Verification Ready' : 'Process Ready to Start',
          body: isNextVerification
            ? `Previous step "${currentProcess.processName}" completed. Verification "${nextProcess.processName}" is now ready on Work Order "${workOrder.folioNumber}".`
            : `Previous step "${currentProcess.processName}" completed. You can now start "${nextProcess.processName}" on Work Order "${workOrder.folioNumber}".`,
          data: {
            workOrderId: workOrder.id,
            folioNumber: workOrder.folioNumber,
            processId: nextProcess.id,
          },
        });
      } catch (err) {
        this.logger.warn(
          `Failed to dispatch next process notification to technician ${nextProcess.technicianId}: ${(err as any).message}`,
        );
      }
    }

    await this.auditService.log({
      tenantId,
      branchId: workOrder.branchId,
      moduleKey: 'LAB',
      userId: actor.id,
      action: 'PROCESS_COMPLETE',
      resourceType: 'WORK_ORDER_PROCESS',
      resourceId: processId,
      newValues: {
        workOrderId,
        status: ProcessStatus.COMPLETED,
        totalActiveDuration: finalActiveDuration,
      },
    });

    return this.findOne(tenantId, actor, workOrderId);
  }

  // ─── Lab Admin Dashboard ───────────────────────────────────

  /**
   * Get Lab Admin Dashboard: KPIs, Pending Verification Alerts, In-Progress Orders, Verification Orders
   */
  async getLabAdminDashboard(tenantId: string, actor: AuthenticatedUser) {
    const isAdmin =
      (await this.isTenantAdminUser(actor, tenantId)) ||
      (await this.isLabAdminUser(actor, tenantId));

    if (!isAdmin) {
      throw new ForbiddenException('Only Lab Administrators can access this dashboard.');
    }

    const branchId = await this.resolveLabAdminBranch(actor, tenantId).catch(() => undefined);
    const isDefaultAdmin = branchId ? await this.isBranchDefaultAdmin(actor, tenantId, branchId) : true;

    const baseWhere: any = {
      tenantId,
      status: { notIn: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED] },
    };
    if (branchId) baseWhere.branchId = branchId;

    // Fetch all active work orders with processes
    const activeOrders = await this.prisma.workOrder.findMany({
      where: baseWhere,
      include: {
        doctor: { select: { id: true, name: true, type: true, clinicName: true } },
        prosthesisType: { select: { id: true, name: true } },
        processes: {
          orderBy: { sequence: 'asc' },
          include: {
            technician: { select: { id: true, name: true } },
            doctor: { select: { id: true, name: true, type: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Completed today (tenant timezone)
    const todayStart = startOfDayInTz(new Date(), DEFAULT_TIMEZONE);
    const todayEnd = endOfDayInTz(new Date(), DEFAULT_TIMEZONE);
    const completedToday = await this.prisma.workOrder.count({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        status: WorkOrderStatus.COMPLETED,
        updatedAt: { gte: todayStart, lte: todayEnd },
      },
    });

    // Categorize
    const pendingVerificationAlerts: any[] = [];
    const inProgressOrders: any[] = [];
    const verificationOrders: any[] = [];
    let pendingVerificationsCount = 0;
    let pendingTechSteps = 0;

    for (const wo of activeOrders) {
      const sortedProcs = [...wo.processes].sort((a, b) => a.sequence - b.sequence);

      // Count pending tech steps (production NOT_STARTED)
      for (const p of sortedProcs) {
        if (
          p.status === ProcessStatus.NOT_STARTED &&
          p.processType === ProcessType.PRODUCTION &&
          !p.isVerification
        ) {
          pendingTechSteps++;
        }
      }

      // Find the current active/ready step (first non-COMPLETED)
      const currentStep = sortedProcs.find((p) => p.status !== ProcessStatus.COMPLETED);
      if (!currentStep) continue;

      const isCurrentVerification =
        currentStep.isVerification ||
        currentStep.processType === ProcessType.INTERNAL_VERIFICATION ||
        currentStep.processType === ProcessType.EXTERNAL_VERIFICATION;

      // Check if all prior steps are completed
      const priorAllCompleted = sortedProcs
        .filter((p) => p.sequence < currentStep.sequence)
        .every((p) => p.status === ProcessStatus.COMPLETED);

      if (isCurrentVerification && priorAllCompleted) {
        pendingVerificationsCount++;

        const isExtVerif = currentStep.processType === ProcessType.EXTERNAL_VERIFICATION;
        const assignedDoc = currentStep.doctor || wo.doctor;
        const docType = assignedDoc?.type || 'LOCAL';

        // Alert banner: verification is NOT_STARTED OR (EXTERNAL_VERIFICATION and IN_PROGRESS awaiting conclusion)
        if (
          currentStep.status === ProcessStatus.NOT_STARTED ||
          (isExtVerif && currentStep.status === ProcessStatus.IN_PROGRESS)
        ) {
          pendingVerificationAlerts.push({
            workOrderId: wo.id,
            folioNumber: wo.folioNumber,
            patient: wo.patient,
            processId: currentStep.id,
            processName: currentStep.processName,
            processType: currentStep.processType,
            isVerification: currentStep.isVerification,
            evaluatorId: isExtVerif ? (assignedDoc?.id || null) : currentStep.technicianId,
            evaluatorName: isExtVerif
              ? (assignedDoc?.name || 'Assigned Doctor')
              : (currentStep.technician?.name || null),
            doctorName: wo.doctor?.name || null,
            doctorType: docType,
            prosthesisName: wo.prosthesisType?.name || null,
            status: currentStep.status,
            startedAt: currentStep.startedAt,
            totalActiveDuration: currentStep.totalActiveDuration,
          });
        }

        // Verification orders: any verification in NOT_STARTED or IN_PROGRESS
        if (
          currentStep.status === ProcessStatus.NOT_STARTED ||
          currentStep.status === ProcessStatus.IN_PROGRESS
        ) {
          verificationOrders.push({
            workOrderId: wo.id,
            folioNumber: wo.folioNumber,
            patient: wo.patient,
            processId: currentStep.id,
            processName: currentStep.processName,
            processType: currentStep.processType,
            isVerification: currentStep.isVerification,
            stepStatus: currentStep.status,
            evaluatorId: isExtVerif ? (assignedDoc?.id || null) : currentStep.technicianId,
            evaluatorName: isExtVerif
              ? (assignedDoc?.name || 'Assigned Doctor')
              : (currentStep.technician?.name || null),
            doctorName: wo.doctor?.name || null,
            doctorType: docType,
            prosthesisName: wo.prosthesisType?.name || null,
            startedAt: currentStep.startedAt,
            totalActiveDuration: currentStep.totalActiveDuration,
          });
        }
      } else if (!isCurrentVerification) {
        // In-progress work orders (non-verification active step)
        if (
          wo.status === WorkOrderStatus.IN_PROGRESS ||
          wo.status === WorkOrderStatus.ASSIGNED ||
          wo.status === WorkOrderStatus.CREATED
        ) {
          // Find which step is actively in progress / ready
          const activeStep = sortedProcs.find(
            (p) => p.status === ProcessStatus.IN_PROGRESS || p.status === ProcessStatus.PAUSED,
          );
          const readyStep = activeStep || currentStep;

          inProgressOrders.push({
            workOrderId: wo.id,
            folioNumber: wo.folioNumber,
            patient: wo.patient,
            doctorName: wo.doctor?.name || null,
            prosthesisName: wo.prosthesisType?.name || null,
            currentStepId: readyStep.id,
            currentStepName: readyStep.processName,
            currentStepStatus: readyStep.status,
            currentStepSequence: readyStep.sequence + 1,
            technicianName: readyStep.technician?.name || null,
          });
        }
      }
    }

    return {
      stats: {
        activeOrders: activeOrders.length,
        pendingVerifications: pendingVerificationsCount,
        pendingTechSteps,
        completedToday,
      },
      isDefaultAdmin,
      pendingVerificationAlerts,
      inProgressOrders,
      verificationOrders,
    };
  }

  /**
   * Evaluate a verification process step: SUCCESS, REPETITION, or REWORK
   */
  async evaluateVerification(
    tenantId: string,
    actor: AuthenticatedUser,
    workOrderId: string,
    processId: string,
    dto: VerificationEvaluateDto,
  ) {
    const isAdmin =
      (await this.isTenantAdminUser(actor, tenantId)) ||
      (await this.isLabAdminUser(actor, tenantId));

    if (!isAdmin) {
      throw new ForbiddenException('Only Lab Administrators can evaluate verifications.');
    }

    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      include: {
        processes: {
          orderBy: { sequence: 'asc' },
          include: { technician: { select: { id: true, name: true } } },
        },
      },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order with ID "${workOrderId}" not found.`);
    }

    const verificationProcess = workOrder.processes.find((p) => p.id === processId);
    if (!verificationProcess) {
      throw new NotFoundException(`Process with ID "${processId}" not found.`);
    }

    const isVerificationStep =
      verificationProcess.isVerification ||
      verificationProcess.processType === ProcessType.INTERNAL_VERIFICATION ||
      verificationProcess.processType === ProcessType.EXTERNAL_VERIFICATION;

    if (!isVerificationStep) {
      throw new BadRequestException('This process step is not a verification step.');
    }

    // For EXTERNAL_VERIFICATION with LOCAL doctor, only the branch default administrator can conclude it
    if (verificationProcess.processType === ProcessType.EXTERNAL_VERIFICATION) {
      const assignedDocId = verificationProcess.doctorId || workOrder.doctorId;
      const doctorRecord = assignedDocId
        ? await this.prisma.doctor.findFirst({ where: { id: assignedDocId, tenantId } })
        : null;

      if (doctorRecord?.type === DoctorType.LOCAL || !doctorRecord?.type) {
        const isDefaultAdmin = await this.isBranchDefaultAdmin(actor, tenantId, workOrder.branchId);
        if (!isDefaultAdmin) {
          throw new ForbiddenException(
            'Only the default administrator of this branch can end external verification for local doctors.',
          );
        }
      }
    }

    const now = new Date();
    const sortedProcs = [...workOrder.processes].sort((a, b) => a.sequence - b.sequence);

    if (dto.outcome === 'SUCCESS') {
      // Calculate final active duration
      let finalActiveDuration = verificationProcess.totalActiveDuration;
      if (verificationProcess.status === ProcessStatus.IN_PROGRESS) {
        const lastActivityTime = verificationProcess.startedAt || now;
        const elapsedSeconds = Math.max(
          0,
          Math.floor((now.getTime() - new Date(lastActivityTime).getTime()) / 1000),
        );
        finalActiveDuration += elapsedSeconds;
      }

      await this.prisma.$transaction(async (tx) => {
        // Mark verification as completed
        await tx.workOrderProcess.update({
          where: { id: processId },
          data: {
            status: ProcessStatus.COMPLETED,
            endedAt: now,
            lastPausedAt: null,
            totalActiveDuration: finalActiveDuration,
          },
        });

        await tx.processActivityLog.create({
          data: {
            workOrderProcessId: processId,
            userId: actor.id,
            action: 'VERIFICATION_APPROVED',
            notes: dto.notes || `Verification approved by ${actor.name || 'Admin'}.`,
            timestamp: now,
          },
        });

        // Find next incomplete step
        const nextIncomplete = sortedProcs.find(
          (p) => p.sequence > verificationProcess.sequence && p.status !== ProcessStatus.COMPLETED,
        );

        if (!nextIncomplete) {
          // Check if ALL steps are now completed
          const stillIncomplete = workOrder.processes.filter(
            (p) => p.id !== processId && p.status !== ProcessStatus.COMPLETED,
          );
          if (stillIncomplete.length === 0) {
            await tx.workOrder.update({
              where: { id: workOrderId },
              data: { status: WorkOrderStatus.COMPLETED },
            });
          }
        } else {
          const isNextVerification =
            nextIncomplete.isVerification ||
            nextIncomplete.processType === ProcessType.INTERNAL_VERIFICATION ||
            nextIncomplete.processType === ProcessType.EXTERNAL_VERIFICATION;

          await tx.workOrder.update({
            where: { id: workOrderId },
            data: {
              status: isNextVerification
                ? (nextIncomplete.processType === ProcessType.EXTERNAL_VERIFICATION
                    ? WorkOrderStatus.EXTERNAL_VERIFICATION
                    : WorkOrderStatus.INTERNAL_VERIFICATION)
                : WorkOrderStatus.IN_PROGRESS,
            },
          });
        }
      });

      // Notify next technician
      const nextProcess = sortedProcs.find(
        (p) => p.sequence > verificationProcess.sequence && p.status !== ProcessStatus.COMPLETED,
      );
      if (nextProcess?.technicianId) {
        try {
          await this.notificationsService.create({
            tenantId,
            userId: nextProcess.technicianId,
            moduleKey: 'LAB',
            type: 'WORK_ORDER',
            title: 'Process Ready to Start',
            body: `Verification "${verificationProcess.processName}" approved. You can now start "${nextProcess.processName}" on Work Order "${workOrder.folioNumber}".`,
            data: { workOrderId: workOrder.id, folioNumber: workOrder.folioNumber, processId: nextProcess.id },
          });
        } catch (err) {
          this.logger.warn(`Failed to dispatch next process notification: ${(err as any).message}`);
        }
      }
    } else if (dto.outcome === 'REPETITION') {
      // Reset ALL processes to NOT_STARTED, restart from Step 1
      await this.prisma.$transaction(async (tx) => {
        for (const proc of sortedProcs) {
          await tx.workOrderProcess.update({
            where: { id: proc.id },
            data: {
              status: ProcessStatus.NOT_STARTED,
              startedAt: null,
              endedAt: null,
              lastPausedAt: null,
              totalActiveDuration: 0,
              totalPauseDuration: 0,
              pauseCount: 0,
              reworkActive: false,
            },
          });

          await tx.processActivityLog.create({
            data: {
              workOrderProcessId: proc.id,
              userId: actor.id,
              action: 'REPETITION_RESET',
              notes: `Repetition initiated by ${actor.name || 'Admin'} from verification stage: ${verificationProcess.processName}.`,
              timestamp: now,
            },
          });
        }

        await tx.workOrder.update({
          where: { id: workOrderId },
          data: { status: WorkOrderStatus.IN_PROGRESS },
        });
      });

      // Notify Step 1 technician
      const step1 = sortedProcs[0];
      if (step1?.technicianId) {
        try {
          await this.notificationsService.create({
            tenantId,
            userId: step1.technicianId,
            moduleKey: 'LAB',
            type: 'WORK_ORDER',
            title: 'Work Order Restarted (Repetition)',
            body: `Work Order "${workOrder.folioNumber}" has been flagged for full repetition by ${actor.name || 'Admin'}. Please restart from Step 1: "${step1.processName}".`,
            data: { workOrderId: workOrder.id, folioNumber: workOrder.folioNumber, processId: step1.id },
          });
        } catch (err) {
          this.logger.warn(`Failed to dispatch repetition notification: ${(err as any).message}`);
        }
      }
    }
    // REWORK outcome is handled separately via initiateRework endpoint

    await this.auditService.log({
      tenantId,
      branchId: workOrder.branchId,
      moduleKey: 'LAB',
      userId: actor.id,
      action: `VERIFICATION_${dto.outcome}`,
      resourceType: 'WORK_ORDER_PROCESS',
      resourceId: processId,
      newValues: {
        workOrderId,
        outcome: dto.outcome,
        notes: dto.notes,
      },
    });

    return this.findOne(tenantId, actor, workOrderId);
  }

  /**
   * Initiate Rework: Reset selected completed production steps to NOT_STARTED
   */
  async initiateRework(
    tenantId: string,
    actor: AuthenticatedUser,
    workOrderId: string,
    dto: InitiateReworkDto,
  ) {
    const isAdmin =
      (await this.isTenantAdminUser(actor, tenantId)) ||
      (await this.isLabAdminUser(actor, tenantId));

    if (!isAdmin) {
      throw new ForbiddenException('Only Lab Administrators can initiate rework.');
    }

    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      include: {
        processes: {
          orderBy: { sequence: 'asc' },
          include: { technician: { select: { id: true, name: true } } },
        },
      },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order with ID "${workOrderId}" not found.`);
    }

    // Validate processIds: must belong to this WO and be COMPLETED production steps
    const processMap = new Map(workOrder.processes.map((p) => [p.id, p]));
    for (const pid of dto.processIds) {
      const proc = processMap.get(pid);
      if (!proc) {
        throw new BadRequestException(`Process "${pid}" not found in this Work Order.`);
      }
      if (proc.status !== ProcessStatus.COMPLETED) {
        throw new BadRequestException(`Process "${proc.processName}" is not completed — cannot rework.`);
      }
      if (
        proc.isVerification ||
        proc.processType === ProcessType.INTERNAL_VERIFICATION ||
        proc.processType === ProcessType.EXTERNAL_VERIFICATION
      ) {
        throw new BadRequestException(`Cannot rework a verification step "${proc.processName}".`);
      }
    }

    // Find the verification step that triggered this rework (current active verification)
    const sortedProcs = [...workOrder.processes].sort((a, b) => a.sequence - b.sequence);
    const verificationStep = sortedProcs.find(
      (p) =>
        (p.isVerification ||
          p.processType === ProcessType.INTERNAL_VERIFICATION ||
          p.processType === ProcessType.EXTERNAL_VERIFICATION) &&
        (p.status === ProcessStatus.IN_PROGRESS || p.status === ProcessStatus.NOT_STARTED),
    );

    const verificationStageName = verificationStep?.processName || 'Verification';
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Reset selected processes
      for (const pid of dto.processIds) {
        const proc = processMap.get(pid)!;
        const newReworkCount = proc.reworkCount + 1;

        await tx.workOrderProcess.update({
          where: { id: pid },
          data: {
            status: ProcessStatus.NOT_STARTED,
            reworkActive: true,
            reworkCount: newReworkCount,
            startedAt: null,
            endedAt: null,
            lastPausedAt: null,
            totalActiveDuration: 0,
            totalPauseDuration: 0,
            pauseCount: 0,
          },
        });

        await tx.processActivityLog.create({
          data: {
            workOrderProcessId: pid,
            userId: actor.id,
            action: 'REWORK_ASSIGNED',
            notes: `Rework cycle #${newReworkCount} initiated by ${actor.name || 'Admin'} in stage: ${verificationStageName}.${dto.notes ? ' Note: ' + dto.notes : ''}`,
            timestamp: now,
          },
        });

        // Notify assigned technician
        if (proc.technicianId) {
          try {
            await this.notificationsService.create({
              tenantId,
              userId: proc.technicianId,
              moduleKey: 'LAB',
              type: 'WORK_ORDER',
              title: 'Rework Required',
              body: `Step "${proc.processName}" on Work Order "${workOrder.folioNumber}" has been flagged for rework by ${actor.name || 'Admin'}.`,
              data: {
                workOrderId: workOrder.id,
                folioNumber: workOrder.folioNumber,
                processId: pid,
              },
            });
          } catch (err) {
            this.logger.warn(`Failed to dispatch rework notification to technician ${proc.technicianId}: ${(err as any).message}`);
          }
        }
      }

      // Reset verification step to NOT_STARTED (it waits for rework to finish)
      if (verificationStep) {
        await tx.workOrderProcess.update({
          where: { id: verificationStep.id },
          data: {
            status: ProcessStatus.NOT_STARTED,
            startedAt: null,
            endedAt: null,
            lastPausedAt: null,
            totalActiveDuration: 0,
            totalPauseDuration: 0,
            pauseCount: 0,
          },
        });
      }

      // Set WO status to IN_PROGRESS
      await tx.workOrder.update({
        where: { id: workOrderId },
        data: { status: WorkOrderStatus.IN_PROGRESS },
      });
    });

    await this.auditService.log({
      tenantId,
      branchId: workOrder.branchId,
      moduleKey: 'LAB',
      userId: actor.id,
      action: 'REWORK_INITIATED',
      resourceType: 'WORK_ORDER',
      resourceId: workOrderId,
      newValues: {
        processIds: dto.processIds,
        notes: dto.notes,
        verificationStage: verificationStageName,
      },
    });

    return this.findOne(tenantId, actor, workOrderId);
  }

  /**
   * Record a payment transaction for a Work Order (Restricted to Lab Admins)
   */
  async recordPayment(
    tenantId: string,
    actor: AuthenticatedUser,
    workOrderId: string,
    dto: RecordWorkOrderPaymentDto,
  ) {
    const isTech = await this.isLabTechnicianUser(actor, tenantId);
    if (isTech) {
      throw new ForbiddenException('Technicians are not authorized to record payments.');
    }

    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      select: { id: true, folioNumber: true, initialPayment: true, paymentReferenceNumbers: true, branchId: true },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order with ID "${workOrderId}" not found.`);
    }

    const paymentAmount = Number(dto.amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new BadRequestException('Payment amount must be a positive number.');
    }

    await this.prisma.workOrderPayment.create({
      data: {
        workOrderId,
        amount: paymentAmount,
        notes: dto.notes?.trim() || null,
        reference: dto.reference?.trim() || null,
        status: 'SETTLED',
        recordedById: actor.id,
        createdAt: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
      },
    });

    // Update total received on workOrder
    const newTotalPaid = Number(workOrder.initialPayment || 0) + paymentAmount;
    const updateData: any = { initialPayment: newTotalPaid };
    if (dto.reference?.trim() && !workOrder.paymentReferenceNumbers.includes(dto.reference.trim())) {
      updateData.paymentReferenceNumbers = [...workOrder.paymentReferenceNumbers, dto.reference.trim()];
    }

    await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: updateData,
    });

    await this.auditService.log({
      tenantId,
      branchId: workOrder.branchId,
      moduleKey: 'LAB',
      userId: actor.id,
      action: 'PAYMENT_RECORDED',
      resourceType: 'WORK_ORDER',
      resourceId: workOrderId,
      newValues: {
        amount: paymentAmount,
        notes: dto.notes,
        reference: dto.reference,
        totalPaid: newTotalPaid,
      },
    });

    return this.findOne(tenantId, actor, workOrderId);
  }
}
