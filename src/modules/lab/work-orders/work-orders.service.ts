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
import { AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';
import { CreateWorkOrderDto, QueryWorkOrdersDto, UpdateWorkOrderDto } from './dto';
import { generateFolioNumber } from './utils/folio.util';
import { parseCalendarDate } from '../../../shared/common/utils/timezone.util';
import { ProcessStatus, ProcessType, WorkOrderStatus } from '@prisma/client';

@Injectable()
export class WorkOrdersService {
  private readonly logger = new Logger(WorkOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
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

    // If 'createAndAssign', dispatch in-app notification to the technician assigned to Step 1
    if (dto.action === 'createAndAssign' && Array.isArray(dto.processes) && dto.processes.length > 0) {
      const sortedProcesses = [...dto.processes].sort((a, b) => a.sequence - b.sequence);
      const firstProcess = sortedProcesses[0];
      if (firstProcess.technicianId) {
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
          },
        },
        notesHistory: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order with ID "${id}" not found.`);
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
}
