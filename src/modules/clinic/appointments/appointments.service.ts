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
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { QueryAppointmentDto } from './dto/query-appointment.dto';
import {
  UpdateClinicWorkingHoursDto,
  UpdateDoctorWorkingHoursDto,
} from './dto/working-hours.dto';
import { Prisma } from '@prisma/client';
import { IncomeService } from '../income/income.service';
import { NotificationsGateway } from '../../../core/notifications/notifications.gateway';

const VALID_STATUSES = [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];
const VALID_TYPES = [
  'CONSULTATION',
  'CHECKUP',
  'CLEANING',
  'PROCEDURE',
  'EMERGENCY',
  'FOLLOW_UP',
  'OTHER',
];

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly incomeService: IncomeService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  private async logTreatmentPlanAudit(params: {
    tenantId: string;
    branchId?: string | null;
    patientId: string;
    odontogramId: string;
    treatmentPlanGroupId: string;
    treatmentPlanName?: string | null;
    userId?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    oldValues?: any;
    newValues?: any;
    description?: string | null;
  }) {
    try {
      await this.prisma.treatmentPlanAudit.create({
        data: {
          tenantId: params.tenantId,
          branchId: params.branchId || null,
          patientId: params.patientId,
          odontogramId: params.odontogramId,
          treatmentPlanGroupId: params.treatmentPlanGroupId,
          treatmentPlanName: params.treatmentPlanName || null,
          userId: params.userId || null,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId || null,
          oldValues: params.oldValues !== undefined ? (params.oldValues as any) : undefined,
          newValues: params.newValues !== undefined ? (params.newValues as any) : undefined,
          description: params.description || null,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to write treatment plan audit from appointments: ${err.message}`);
    }
  }

  private async syncTreatmentPlanStatusFromAppointments(
    tenantId: string,
    patientOdontogramId: string,
    treatmentPlanGroupId: string,
    actorId: string,
    appointmentNumber: string,
  ) {
    try {
      const odontogram = await this.prisma.patientOdontogram.findFirst({
        where: { id: patientOdontogramId, tenantId },
      });
      if (!odontogram) return;

      const proposedPlan: any = (odontogram as any).proposedPlan;
      if (!proposedPlan || !Array.isArray(proposedPlan.groups)) return;

      const groupIdx = proposedPlan.groups.findIndex((g: any) => g.id === treatmentPlanGroupId);
      if (groupIdx === -1) return;

      const group = proposedPlan.groups[groupIdx];
      const currentStatus: string = group.status || (group.confirmed ? 'ACCEPTED' : 'CREATED');

      const groupApts = await this.prisma.appointment.findMany({
        where: {
          tenantId,
          patientOdontogramId,
          treatmentPlanGroupId,
        },
        select: {
          id: true,
          status: true,
          treatmentPlanItemIds: true,
        },
      });

      const activeApts = groupApts.filter((a) => a.status !== 'CANCELLED');
      let targetStatus: string | null = null;

      if (activeApts.some((a) => a.status === 'IN_PROGRESS')) {
        if (currentStatus === 'ACCEPTED') {
          targetStatus = 'IN_PROGRESS';
        }
      } else if (activeApts.length > 0 && activeApts.every((a) => a.status === 'COMPLETED')) {
        const coveredIds = new Set<string>();
        for (const a of activeApts) {
          const ids = Array.isArray(a.treatmentPlanItemIds)
            ? (a.treatmentPlanItemIds as string[])
            : [];
          ids.forEach((id) => coveredIds.add(String(id)));
        }
        const groupItems = Array.isArray(group.items) ? group.items : [];
        const allItemsCovered =
          groupItems.length > 0 &&
          groupItems.every((it: any) => coveredIds.has(String(it.id)));

        if (allItemsCovered && currentStatus !== 'COMPLETED') {
          targetStatus = 'COMPLETED';
        }
      } else if (activeApts.length === 0 && currentStatus === 'IN_PROGRESS') {
        targetStatus = 'ACCEPTED';
      }

      if (targetStatus && targetStatus !== currentStatus) {
        const nextGroups = [...proposedPlan.groups];
        nextGroups[groupIdx] = {
          ...group,
          status: targetStatus,
          confirmed: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(targetStatus),
        };
        const nextPlan = { ...proposedPlan, groups: nextGroups };

        await this.prisma.patientOdontogram.update({
          where: { id: odontogram.id },
          data: { proposedPlan: nextPlan as any },
        });

        await this.logTreatmentPlanAudit({
          tenantId,
          branchId: odontogram.branchId,
          patientId: odontogram.patientId,
          odontogramId: odontogram.id,
          treatmentPlanGroupId,
          treatmentPlanName: group.name || null,
          userId: actorId,
          action: 'STATUS_CHANGED',
          resourceType: 'TREATMENT_PLAN',
          resourceId: treatmentPlanGroupId,
          oldValues: { status: currentStatus },
          newValues: { status: targetStatus },
          description: `Status updated automatically from ${currentStatus} to ${targetStatus} via appointment ${appointmentNumber}`,
        });
      }
    } catch (err: any) {
      this.logger.error(`Failed to sync treatment plan status: ${err.message}`);
    }
  }

  // ============================================================================
  // ROLE HELPERS
  // ============================================================================

  /**
   * Returns true if actor is a Tenant Admin or super admin.
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

    const membership = await this.prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId: actor.id, tenantId } },
    });
    if (membership?.isOwner) return true;

    const adminRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: { slug: { in: ['tenant-admin', 'admin', 'administrator'] } },
      },
    });
    return !!adminRole;
  }

  /**
   * Returns the branch ID if the actor is a Clinic Admin, otherwise throws.
   */
  private async assertClinicAdmin(actor: AuthenticatedUser, tenantId: string): Promise<string> {
    const clinicAdminRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: { slug: 'clinic-admin' },
      },
    });
    if (!clinicAdminRole || !clinicAdminRole.branchId) {
      throw new ForbiddenException('Only Clinic Administrators can perform this action.');
    }
    return clinicAdminRole.branchId;
  }

  /**
   * Returns the branch ID for clinic admin, null for tenant admin.
   * Throws if neither.
   */
  private async getActorBranchScope(
    actor: AuthenticatedUser,
    tenantId: string,
  ): Promise<{ isAdmin: boolean; isClinicAdmin: boolean; branchId: string | null }> {
    const isAdmin = await this.isTenantAdmin(actor, tenantId);
    if (isAdmin) {
      return { isAdmin: true, isClinicAdmin: false, branchId: null };
    }

    // Check clinic admin
    const clinicAdminRole = await this.prisma.userRole.findFirst({
      where: { userId: actor.id, tenantId, role: { slug: 'clinic-admin' } },
    });
    if (clinicAdminRole?.branchId) {
      return { isAdmin: false, isClinicAdmin: true, branchId: clinicAdminRole.branchId };
    }

    // Check clinic staff or doctor — read-only
    const clinicRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: { slug: { in: ['clinic-staff', 'clinic-doctor'] } },
      },
    });
    if (clinicRole) {
      return { isAdmin: false, isClinicAdmin: false, branchId: clinicRole.branchId || null };
    }

    throw new ForbiddenException('No permission to access appointment data.');
  }

  // ============================================================================
  // APPOINTMENT NUMBER GENERATION
  // ============================================================================

  private async generateAppointmentNumber(tenantId: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `APT-${currentYear}-`;

    const last = await this.prisma.appointment.findFirst({
      where: {
        tenantId,
        appointmentNumber: { startsWith: prefix },
      },
      orderBy: { appointmentNumber: 'desc' },
      select: { appointmentNumber: true },
    });

    let nextSeq = 1;
    if (last?.appointmentNumber) {
      const parts = last.appointmentNumber.split('-');
      const numPart = parseInt(parts[2], 10);
      if (!isNaN(numPart)) {
        nextSeq = numPart + 1;
      }
    }

    return `${prefix}${nextSeq.toString().padStart(4, '0')}`;
  }

  // ============================================================================
  // TIME HELPERS
  // ============================================================================

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private minutesToTime(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  /**
   * Calculate the endTime given a startTime (HH:mm) and durationMinutes.
   */
  private calculateEndTime(startTime: string, durationMinutes: number): string {
    return this.minutesToTime(this.timeToMinutes(startTime) + durationMinutes);
  }

  // ============================================================================
  // APPOINTMENTS CRUD
  // ============================================================================

  /**
   * KPI stats for the appointments dashboard.
   */
  async getStats(tenantId: string, branchId?: string, doctorId?: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const baseWhere: Prisma.AppointmentWhereInput = {
      tenantId,
      date: { gte: todayStart, lt: todayEnd },
    };
    if (branchId) baseWhere.branchId = branchId;
    if (doctorId) baseWhere.doctorId = doctorId;

    const allWhere: Prisma.AppointmentWhereInput = { tenantId };
    if (branchId) allWhere.branchId = branchId;
    if (doctorId) allWhere.doctorId = doctorId;

    const [totalAppointments, scheduled, inProgress, completed, cancelled] =
      await Promise.all([
        this.prisma.appointment.count({ where: allWhere }),
        this.prisma.appointment.count({ where: { ...allWhere, status: 'SCHEDULED' } }),
        this.prisma.appointment.count({ where: { ...allWhere, status: 'IN_PROGRESS' } }),
        this.prisma.appointment.count({ where: { ...allWhere, status: 'COMPLETED' } }),
        this.prisma.appointment.count({ where: { ...allWhere, status: 'CANCELLED' } }),
      ]);

    return { total: totalAppointments, todayTotal: totalAppointments, scheduled, inProgress, completed, cancelled };
  }

  /**
   * List appointments with filters and pagination.
   */
  async findAll(tenantId: string, query: QueryAppointmentDto, actor: AuthenticatedUser) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const scope = await this.getActorBranchScope(actor, tenantId);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AppointmentWhereInput = { tenantId };

    // Branch scoping
    if (query.branchId) {
      where.branchId = query.branchId;
    } else if (scope.branchId) {
      where.branchId = scope.branchId;
    }

    // Doctor scoping for clinic-doctor role
    if (!scope.isAdmin && !scope.isClinicAdmin && query.doctorId) {
      where.doctorId = query.doctorId;
    } else if (query.doctorId) {
      where.doctorId = query.doctorId;
    }

    // Date range
    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) {
        (where.date as any).gte = new Date(query.startDate + 'T00:00:00Z');
      }
      if (query.endDate) {
        (where.date as any).lte = new Date(query.endDate + 'T23:59:59Z');
      }
    }

    // Status filter
    if (query.status && query.status !== 'ALL') {
      where.status = query.status;
    }

    // Type filter
    if (query.type && query.type !== 'ALL') {
      where.type = query.type;
    }

    // Search
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { appointmentNumber: { contains: q, mode: 'insensitive' } },
        { reason: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        { patient: { firstName: { contains: q, mode: 'insensitive' } } },
        { patient: { fatherLastName: { contains: q, mode: 'insensitive' } } },
        { patient: { recordNumber: { contains: q, mode: 'insensitive' } } },
        { doctor: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    // Recent appointments listed first by default (createdAt: 'desc')
    let orderBy: Prisma.AppointmentOrderByWithRelationInput[] = [{ createdAt: 'desc' }];
    if (query.sortBy === 'date') {
      const dir = query.sortOrder === 'asc' ? 'asc' : 'desc';
      orderBy = [{ date: dir }, { startTime: dir }, { createdAt: 'desc' }];
    } else if (query.sortBy === 'createdAt') {
      const dir = query.sortOrder === 'asc' ? 'asc' : 'desc';
      orderBy = [{ createdAt: dir }];
    } else if (query.sortBy) {
      const dir = query.sortOrder === 'asc' ? 'asc' : 'desc';
      orderBy = [{ [query.sortBy]: dir } as any];
    }

    const [total, appointments] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          patient: {
            select: {
              id: true,
              recordNumber: true,
              firstName: true,
              fatherLastName: true,
              motherLastName: true,
              phoneCountryCode: true,
              phoneNumber: true,
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
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
          startedBy: {
            select: {
              id: true,
              name: true,
            },
          },
          endedBy: {
            select: {
              id: true,
              name: true,
            },
          },
          incomeRecord: {
            select: {
              id: true,
              status: true,
              grandTotal: true,
              totalPaid: true,
              balanceDue: true,
              totalServices: true,
              totalProducts: true,
              serviceLines: {
                select: { id: true, isCompleted: true },
              },
              productLines: {
                select: { id: true },
              },
            },
          },
          appointmentServices: {
            select: {
              id: true,
              serviceId: true,
              serviceName: true,
              unitPrice: true,
              quantity: true,
            },
          },
        },
      }),
    ]);

    return {
      appointments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Get single appointment by ID.
   */
  async findOne(id: string, tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: {
        patient: {
          select: {
            id: true,
            recordNumber: true,
            firstName: true,
            fatherLastName: true,
            motherLastName: true,
            phoneCountryCode: true,
            phoneNumber: true,
            email: true,
            gender: true,
            dateOfBirth: true,
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
        branch: {
          select: { id: true, name: true, code: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
        startedBy: {
          select: { id: true, name: true, email: true },
        },
        endedBy: {
          select: { id: true, name: true, email: true },
        },
        incomeRecord: {
          select: {
            id: true,
            status: true,
            grandTotal: true,
            totalPaid: true,
            balanceDue: true,
            totalServices: true,
            totalProducts: true,
            serviceLines: {
              select: { id: true, isCompleted: true },
            },
            productLines: {
              select: { id: true },
            },
          },
        },
        appointmentServices: {
          select: {
            id: true,
            serviceId: true,
            serviceName: true,
            unitPrice: true,
            quantity: true,
          },
        },
        patientOdontogram: {
          select: {
            id: true,
            patientId: true,
            proposedPlan: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID '${id}' not found`);
    }

    let siblingPlanAppointments: any[] = [];
    if (appointment.treatmentPlanGroupId && appointment.patientOdontogramId) {
      siblingPlanAppointments = await this.prisma.appointment.findMany({
        where: {
          tenantId,
          patientOdontogramId: appointment.patientOdontogramId,
          treatmentPlanGroupId: appointment.treatmentPlanGroupId,
          status: { not: 'CANCELLED' },
        },
        select: {
          id: true,
          appointmentNumber: true,
          doctorId: true,
          date: true,
          startTime: true,
          endTime: true,
          durationMinutes: true,
          status: true,
          treatmentPlanItemIds: true,
          treatmentPlanScope: true,
          doctor: {
            select: {
              id: true,
              name: true,
              email: true,
              colorCode: true,
            },
          },
          appointmentServices: {
            select: {
              id: true,
              serviceId: true,
              serviceName: true,
              unitPrice: true,
              quantity: true,
            },
          },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      });
    }

    return {
      ...appointment,
      siblingPlanAppointments,
    };
  }

  /**
   * Create a new appointment — CLINIC ADMIN ONLY.
   */
  async create(dto: CreateAppointmentDto, tenantId: string, actor: AuthenticatedUser) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    // RBAC: Only Clinic Admin
    const adminBranchId = await this.assertClinicAdmin(actor, tenantId);
    const effectiveBranchId = dto.branchId || adminBranchId;

    // Validate patient exists
    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, tenantId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient with ID '${dto.patientId}' not found`);
    }

    // Validate doctor exists (user with clinic-doctor role)
    const doctorUser = await this.prisma.user.findFirst({
      where: { id: dto.doctorId },
    });
    if (!doctorUser) {
      throw new NotFoundException(`Doctor with ID '${dto.doctorId}' not found`);
    }

    // Treatment plan gating & completeness validation when linked to a treatment plan
    let resolvedOdontogramId: string | null = dto.patientOdontogramId || null;
    let resolvedGroupName: string | null = dto.treatmentPlanGroupName || null;

    if (dto.treatmentPlanGroupId) {
      const odontogram = resolvedOdontogramId
        ? await this.prisma.patientOdontogram.findFirst({
            where: { id: resolvedOdontogramId, tenantId, patientId: dto.patientId },
          })
        : await this.prisma.patientOdontogram.findUnique({
            where: { patientId: dto.patientId },
          });

      if (!odontogram) {
        throw new BadRequestException(
          'Patient odontogram and treatment plan must be saved before creating an appointment.',
        );
      }

      resolvedOdontogramId = odontogram.id;
      const proposedPlan: any = (odontogram as any).proposedPlan;
      const groups: any[] = Array.isArray(proposedPlan?.groups) ? proposedPlan.groups : [];
      const group = groups.find((g) => g.id === dto.treatmentPlanGroupId);

      if (!group) {
        throw new BadRequestException('Referenced treatment plan was not found.');
      }

      resolvedGroupName = resolvedGroupName || group.name || null;

      const planStatus = group.status || (group.confirmed ? 'ACCEPTED' : 'CREATED');
      if (planStatus !== 'ACCEPTED') {
        throw new BadRequestException(
          `Appointments can only be created when the treatment plan status is Accepted (current status: ${planStatus}).`,
        );
      }

      const groupItems: any[] = Array.isArray(group.items) ? group.items : [];
      if (groupItems.length === 0) {
        throw new BadRequestException(
          'This treatment plan has no services. Please add and complete at least one service row before creating an appointment.',
        );
      }

      const requestedItemIds = Array.isArray(dto.treatmentPlanItemIds)
        ? dto.treatmentPlanItemIds.map(String)
        : [];
      const itemsToValidate =
        dto.treatmentPlanScope === 'ITEM' && requestedItemIds.length > 0
          ? groupItems.filter((it) => requestedItemIds.includes(String(it.id)))
          : groupItems;

      if (itemsToValidate.length === 0) {
        throw new BadRequestException('Selected treatment plan service was not found.');
      }

      for (let i = 0; i < itemsToValidate.length; i++) {
        const it = itemsToValidate[i];
        const missing: string[] = [];
        if (!String(it?.treatmentName || '').trim()) missing.push('Treatment');
        if (!String(it?.doctorId || '').trim()) missing.push('Doctor');
        if (!String(it?.serviceId || '').trim()) missing.push('Service');
        if (!it?.quantity || Number(it.quantity) < 1) missing.push('Quantity');
        if (it?.unitPrice === undefined || it?.unitPrice === null || Number(it.unitPrice) <= 0) {
          missing.push('Price');
        }
        if (missing.length > 0) {
          throw new BadRequestException(
            `Service row #${i + 1} is incomplete. Missing fields: ${missing.join(', ')}.`,
          );
        }
      }

      if (requestedItemIds.length > 0) {
        const existingGroupApts = await this.prisma.appointment.findMany({
          where: {
            tenantId,
            patientOdontogramId: odontogram.id,
            treatmentPlanGroupId: dto.treatmentPlanGroupId,
            status: { not: 'CANCELLED' },
          },
          select: { appointmentNumber: true, treatmentPlanItemIds: true },
        });
        const bookedIds = new Set<string>();
        for (const apt of existingGroupApts) {
          const ids = Array.isArray(apt.treatmentPlanItemIds)
            ? (apt.treatmentPlanItemIds as string[])
            : [];
          ids.forEach((itemId) => bookedIds.add(String(itemId)));
        }
        if (requestedItemIds.some((reqId) => bookedIds.has(reqId))) {
          throw new ConflictException(
            'One or more selected treatment plan services already have an active appointment.',
          );
        }
      }
    }

    // Calculate end time and duration
    let endTime = dto.endTime;
    let duration = dto.durationMinutes || 30;
    if (dto.startTime && dto.endTime) {
      const sMins = this.timeToMinutes(dto.startTime);
      const eMins = this.timeToMinutes(dto.endTime);
      if (eMins <= sMins) {
        throw new BadRequestException('End time must be after start time');
      }
      duration = eMins - sMins;
    } else {
      endTime = this.calculateEndTime(dto.startTime, duration);
    }

    // Date normalization
    const appointmentDate = new Date(dto.date + 'T12:00:00Z');

    // Conflict check: overlapping appointment for same doctor on same date
    const startMins = this.timeToMinutes(dto.startTime);
    const endMins = this.timeToMinutes(endTime);

    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        doctorId: dto.doctorId,
        date: appointmentDate,
        status: { not: 'CANCELLED' },
      },
      select: { startTime: true, endTime: true, appointmentNumber: true },
    });

    for (const existing of existingAppointments) {
      const exStart = this.timeToMinutes(existing.startTime);
      const exEnd = this.timeToMinutes(existing.endTime);
      if (startMins < exEnd && endMins > exStart) {
        throw new ConflictException(
          `Time slot conflicts with existing appointment ${existing.appointmentNumber} (${existing.startTime}–${existing.endTime}).`,
        );
      }
    }

    // Validate type
    const appointmentType = dto.type || 'CONSULTATION';
    if (!VALID_TYPES.includes(appointmentType)) {
      throw new BadRequestException(`Invalid appointment type: ${appointmentType}`);
    }

    const appointmentNumber = await this.generateAppointmentNumber(tenantId);

    // Resolve services and calculate expected amount if serviceIds provided
    let expectedAmount: number | null = null;
    const resolvedServices: { serviceId: string; serviceName: string; unitPrice: number; quantity: number }[] = [];

    if (dto.serviceIds && dto.serviceIds.length > 0) {
      let sum = 0;
      for (const sId of dto.serviceIds) {
        const s = await this.prisma.service.findFirst({
          where: { id: sId, tenantId },
        });
        if (s) {
          const ds = await this.prisma.doctorService.findFirst({
            where: { tenantId, doctorId: dto.doctorId, serviceId: sId },
          });
          const unitPrice = ds ? Number(ds.customPrice) : Number(s.price);
          sum += unitPrice;
          const existingIdx = resolvedServices.findIndex((rs) => rs.serviceId === s.id);
          if (existingIdx >= 0) {
            resolvedServices[existingIdx].quantity += 1;
          } else {
            resolvedServices.push({
              serviceId: s.id,
              serviceName: s.name,
              unitPrice,
              quantity: 1,
            });
          }
        }
      }
      expectedAmount = dto.expectedAmount !== undefined && dto.expectedAmount !== null
        ? Number(dto.expectedAmount)
        : sum;
    } else if (dto.expectedAmount !== undefined && dto.expectedAmount !== null) {
      expectedAmount = Number(dto.expectedAmount);
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        tenantId,
        branchId: effectiveBranchId,
        appointmentNumber,
        patientId: dto.patientId,
        doctorId: dto.doctorId,
        date: appointmentDate,
        startTime: dto.startTime,
        endTime,
        durationMinutes: duration,
        actualStartTime: dto.actualStartTime ? new Date(dto.actualStartTime) : null,
        actualEndTime: dto.actualEndTime ? new Date(dto.actualEndTime) : null,
        type: appointmentType,
        status: 'SCHEDULED',
        reason: dto.reason || null,
        notes: dto.notes || null,
        expectedAmount: expectedAmount !== null ? new Prisma.Decimal(expectedAmount.toFixed(2)) : null,
        patientOdontogramId: resolvedOdontogramId,
        treatmentPlanGroupId: dto.treatmentPlanGroupId || null,
        treatmentPlanGroupName: resolvedGroupName,
        treatmentPlanItemIds: dto.treatmentPlanItemIds
          ? (dto.treatmentPlanItemIds as any)
          : undefined,
        treatmentPlanScope: dto.treatmentPlanScope || null,
        createdById: actor.id,
        appointmentServices: {
          create: resolvedServices.map((rs) => ({
            tenantId,
            serviceId: rs.serviceId,
            serviceName: rs.serviceName,
            unitPrice: new Prisma.Decimal(rs.unitPrice.toFixed(2)),
            quantity: rs.quantity,
          })),
        },
      },
      include: {
        patient: {
          select: {
            id: true,
            recordNumber: true,
            firstName: true,
            fatherLastName: true,
          },
        },
        doctor: {
          select: { id: true, name: true, email: true },
        },
        branch: {
          select: { id: true, name: true },
        },
        appointmentServices: true,
      },
    });

    // Auto-create associated IncomeRecord in DRAFT status so it appears immediately in the Income listing
    try {
      await this.incomeService.getOrCreateByAppointment(appointment.id, tenantId, actor);
    } catch (err: any) {
      this.logger.error(`Failed to auto-create IncomeRecord for ${appointmentNumber}: ${err.message}`);
    }

    if (resolvedOdontogramId && dto.treatmentPlanGroupId) {
      await this.logTreatmentPlanAudit({
        tenantId,
        branchId: effectiveBranchId,
        patientId: dto.patientId,
        odontogramId: resolvedOdontogramId,
        treatmentPlanGroupId: dto.treatmentPlanGroupId,
        treatmentPlanName: resolvedGroupName,
        userId: actor.id,
        action: 'APPOINTMENT_CREATED',
        resourceType: 'APPOINTMENT',
        resourceId: appointment.id,
        newValues: {
          appointmentNumber,
          doctorName: doctorUser.name,
          date: dto.date,
          startTime: dto.startTime,
          endTime,
          scope: dto.treatmentPlanScope || 'GROUP',
          servicesCount: resolvedServices.length,
        },
        description: `Created appointment ${appointmentNumber} for Dr. ${doctorUser.name} (${dto.date} ${dto.startTime}–${endTime})`,
      });

      this.notificationsGateway.sendToTenant(tenantId, 'treatment_plan:updated', {
        patientId: dto.patientId,
        groupId: dto.treatmentPlanGroupId,
      });
    }

    this.logger.log(
      `📅 Appointment ${appointmentNumber} created by ${actor.id} for patient ${dto.patientId} with Dr. ${doctorUser.name}`,
    );

    return appointment;
  }

  private assertStatusTransition(
    currentStatus: string,
    targetStatus: string,
    context: 'update' | 'status' = 'status',
  ) {
    if (!VALID_STATUSES.includes(targetStatus)) {
      throw new BadRequestException(`Invalid appointment status: ${targetStatus}`);
    }
    if (currentStatus === 'COMPLETED') {
      throw new BadRequestException(
        'Completed appointments cannot be modified or reopened. Only remaining balance payment collection is permitted.',
      );
    }
    if (targetStatus === 'COMPLETED' && currentStatus !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'Only appointments that are currently In Progress can be ended.',
      );
    }
    if (targetStatus === 'CANCELLED' && currentStatus === 'IN_PROGRESS') {
      throw new BadRequestException(
        'Cannot cancel an appointment that is already in progress.',
      );
    }
    if (currentStatus === 'CANCELLED' && targetStatus !== 'SCHEDULED') {
      throw new BadRequestException(
        context === 'status'
          ? 'Cancelled appointments must be reopened to Scheduled before starting.'
          : 'Cancelled appointments must be reopened to Scheduled before editing.',
      );
    }
  }

  /**
   * Update appointment — CLINIC ADMIN ONLY.
   */
  async update(id: string, dto: UpdateAppointmentDto, tenantId: string, actor: AuthenticatedUser) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    // RBAC: Only Clinic Admin
    await this.assertClinicAdmin(actor, tenantId);

    const existing = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: {
        doctor: { select: { id: true, name: true } },
        appointmentServices: {
          select: { serviceId: true, serviceName: true },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Appointment with ID '${id}' not found`);
    }

    if (existing.status === 'COMPLETED') {
      throw new BadRequestException(
        'Completed appointments are locked and cannot be edited. Only remaining balance payment collection is permitted.',
      );
    }

    if (dto.status && dto.status !== existing.status) {
      this.assertStatusTransition(existing.status, dto.status, 'update');
    }

    const oldDateStr = existing.date ? existing.date.toISOString().substring(0, 10) : '';
    const oldServiceNames = (existing.appointmentServices || []).map((s) => s.serviceName);

    const updateData: any = {};

    if (dto.patientId) updateData.patientId = dto.patientId;
    if (dto.doctorId) updateData.doctorId = dto.doctorId;
    if (dto.branchId) updateData.branchId = dto.branchId;
    if (dto.reason !== undefined) updateData.reason = dto.reason;
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.expectedAmount !== undefined && dto.expectedAmount !== null) {
      updateData.expectedAmount = new Prisma.Decimal(Number(dto.expectedAmount).toFixed(2));
    }
    if (dto.actualStartTime !== undefined) {
      updateData.actualStartTime = dto.actualStartTime ? new Date(dto.actualStartTime) : null;
    }
    if (dto.actualEndTime !== undefined) {
      updateData.actualEndTime = dto.actualEndTime ? new Date(dto.actualEndTime) : null;
    }
    if (dto.type) {
      if (!VALID_TYPES.includes(dto.type)) {
        throw new BadRequestException(`Invalid appointment type: ${dto.type}`);
      }
      updateData.type = dto.type;
    }
    if (dto.status) {
      if (!VALID_STATUSES.includes(dto.status)) {
        throw new BadRequestException(`Invalid appointment status: ${dto.status}`);
      }
      updateData.status = dto.status;
      if (dto.status === 'CANCELLED' && dto.cancellationReason) {
        updateData.cancellationReason = dto.cancellationReason;
      }
      if (dto.status === 'IN_PROGRESS') {
        if (!existing.actualStartTime && !updateData.actualStartTime) {
          updateData.actualStartTime = new Date();
        }
        if (!existing.startedById) {
          updateData.startedById = actor.id;
        }
      }
      if (dto.status === 'COMPLETED') {
        if (!existing.actualStartTime && !updateData.actualStartTime) {
          updateData.actualStartTime = new Date();
        }
        if (!existing.actualEndTime && !updateData.actualEndTime) {
          updateData.actualEndTime = new Date();
        }
        if (!existing.startedById) {
          updateData.startedById = actor.id;
        }
        updateData.endedById = actor.id;
      }
    }

    // If rescheduling date or time
    if (dto.date || dto.startTime || dto.endTime || dto.durationMinutes) {
      if (existing.status === 'IN_PROGRESS' || existing.status === 'COMPLETED') {
        throw new BadRequestException(
          'Time slot cannot be changed once an appointment has started or is completed.',
        );
      }
      const newDate = dto.date
        ? new Date(dto.date + 'T12:00:00Z')
        : existing.date;
      const newStart = dto.startTime || existing.startTime;
      let newEnd = dto.endTime;
      let newDuration = dto.durationMinutes || existing.durationMinutes;

      if (newStart && newEnd) {
        const sMins = this.timeToMinutes(newStart);
        const eMins = this.timeToMinutes(newEnd);
        if (eMins <= sMins) {
          throw new BadRequestException('End time must be after start time');
        }
        newDuration = eMins - sMins;
      } else if (!newEnd) {
        newEnd = this.calculateEndTime(newStart, newDuration);
      }

      // Conflict check (excluding current appointment)
      const startMins = this.timeToMinutes(newStart);
      const endMins = this.timeToMinutes(newEnd);
      const doctorId = dto.doctorId || existing.doctorId;

      const conflicts = await this.prisma.appointment.findMany({
        where: {
          tenantId,
          doctorId,
          date: newDate,
          id: { not: id },
          status: { not: 'CANCELLED' },
        },
        select: { startTime: true, endTime: true, appointmentNumber: true },
      });

      for (const c of conflicts) {
        const cStart = this.timeToMinutes(c.startTime);
        const cEnd = this.timeToMinutes(c.endTime);
        if (startMins < cEnd && endMins > cStart) {
          throw new ConflictException(
            `Time slot conflicts with appointment ${c.appointmentNumber} (${c.startTime}–${c.endTime}).`,
          );
        }
      }

      updateData.date = newDate;
      updateData.startTime = newStart;
      updateData.endTime = newEnd;
      updateData.durationMinutes = newDuration;
    }

    if (dto.serviceIds !== undefined) {
      await this.prisma.appointmentService.deleteMany({
        where: { appointmentId: id },
      });

      let sum = 0;
      const targetDoctorId = dto.doctorId || existing.doctorId;
      const resolvedServices: { serviceId: string; serviceName: string; unitPrice: number; quantity: number }[] = [];

      for (const sId of dto.serviceIds) {
        const s = await this.prisma.service.findFirst({
          where: { id: sId, tenantId },
        });
        if (s) {
          const ds = await this.prisma.doctorService.findFirst({
            where: { tenantId, doctorId: targetDoctorId, serviceId: sId },
          });
          const unitPrice = ds ? Number(ds.customPrice) : Number(s.price);
          sum += unitPrice;
          const existingIdx = resolvedServices.findIndex((rs) => rs.serviceId === s.id);
          if (existingIdx >= 0) {
            resolvedServices[existingIdx].quantity += 1;
          } else {
            resolvedServices.push({
              serviceId: s.id,
              serviceName: s.name,
              unitPrice,
              quantity: 1,
            });
          }
        }
      }

      if (resolvedServices.length > 0) {
        await this.prisma.appointmentService.createMany({
          data: resolvedServices.map((rs) => ({
            tenantId,
            appointmentId: id,
            serviceId: rs.serviceId,
            serviceName: rs.serviceName,
            unitPrice: new Prisma.Decimal(rs.unitPrice.toFixed(2)),
            quantity: rs.quantity,
          })),
        });
        updateData.expectedAmount =
          dto.expectedAmount !== undefined && dto.expectedAmount !== null
            ? new Prisma.Decimal(Number(dto.expectedAmount).toFixed(2))
            : new Prisma.Decimal(sum.toFixed(2));
      } else {
        updateData.expectedAmount = null;
      }
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        patient: {
          select: {
            id: true,
            recordNumber: true,
            firstName: true,
            fatherLastName: true,
          },
        },
        doctor: {
          select: { id: true, name: true },
        },
        branch: {
          select: { id: true, name: true },
        },
        startedBy: {
          select: { id: true, name: true },
        },
        endedBy: {
          select: { id: true, name: true },
        },
        appointmentServices: true,
      },
    });

    if (existing.treatmentPlanGroupId && existing.patientOdontogramId) {
      // Sync doctor reassignment back to proposedPlan item(s) if doctorId changed
      if (dto.doctorId && dto.doctorId !== existing.doctorId) {
        const linkedItemIds = Array.isArray(existing.treatmentPlanItemIds)
          ? (existing.treatmentPlanItemIds as string[]).map(String)
          : [];
        if (linkedItemIds.length > 0) {
          const odontogram = await this.prisma.patientOdontogram.findFirst({
            where: { id: existing.patientOdontogramId, tenantId },
          });
          const proposedPlan: any = (odontogram as any)?.proposedPlan;
          if (odontogram && proposedPlan && Array.isArray(proposedPlan.groups)) {
            const gIdx = proposedPlan.groups.findIndex(
              (g: any) => g.id === existing.treatmentPlanGroupId,
            );
            if (gIdx >= 0 && Array.isArray(proposedPlan.groups[gIdx].items)) {
              const nextGroups = [...proposedPlan.groups];
              nextGroups[gIdx] = {
                ...nextGroups[gIdx],
                items: nextGroups[gIdx].items.map((it: any) =>
                  linkedItemIds.includes(String(it.id))
                    ? { ...it, doctorId: dto.doctorId }
                    : it,
                ),
              };
              await this.prisma.patientOdontogram.update({
                where: { id: odontogram.id },
                data: { proposedPlan: { ...proposedPlan, groups: nextGroups } as any },
              });
            }
          }
        }
      }

      const newDateStr = updated.date ? updated.date.toISOString().substring(0, 10) : '';
      const newServiceNames = (updated.appointmentServices || []).map((s) => s.serviceName);
      const oldDiff: Record<string, any> = {};
      const newDiff: Record<string, any> = {};

      if (oldDateStr !== newDateStr) {
        oldDiff.date = oldDateStr;
        newDiff.date = newDateStr;
      }
      if (existing.startTime !== updated.startTime || existing.endTime !== updated.endTime) {
        oldDiff.time = `${existing.startTime}–${existing.endTime}`;
        newDiff.time = `${updated.startTime}–${updated.endTime}`;
      }
      if (existing.durationMinutes !== updated.durationMinutes) {
        oldDiff.durationMinutes = existing.durationMinutes;
        newDiff.durationMinutes = updated.durationMinutes;
      }
      if (existing.doctorId !== updated.doctorId) {
        oldDiff.doctorName = existing.doctor?.name || existing.doctorId;
        newDiff.doctorName = updated.doctor?.name || updated.doctorId;
      }
      if (existing.type !== updated.type) {
        oldDiff.type = existing.type;
        newDiff.type = updated.type;
      }
      if ((existing.notes || '') !== (updated.notes || '')) {
        oldDiff.notes = existing.notes || '';
        newDiff.notes = updated.notes || '';
      }
      if (
        dto.serviceIds !== undefined &&
        JSON.stringify(oldServiceNames) !== JSON.stringify(newServiceNames)
      ) {
        oldDiff.services = oldServiceNames.join(', ');
        newDiff.services = newServiceNames.join(', ');
      }

      if (Object.keys(newDiff).length > 0) {
        await this.logTreatmentPlanAudit({
          tenantId,
          branchId: updated.branchId,
          patientId: existing.patientId,
          odontogramId: existing.patientOdontogramId,
          treatmentPlanGroupId: existing.treatmentPlanGroupId,
          treatmentPlanName: existing.treatmentPlanGroupName,
          userId: actor.id,
          action: 'APPOINTMENT_UPDATED',
          resourceType: 'APPOINTMENT',
          resourceId: existing.id,
          oldValues: { appointmentNumber: existing.appointmentNumber, ...oldDiff },
          newValues: { appointmentNumber: existing.appointmentNumber, ...newDiff },
          description: `Updated appointment ${existing.appointmentNumber}`,
        });
      }

      if (dto.status && dto.status !== existing.status) {
        await this.logTreatmentPlanAudit({
          tenantId,
          branchId: updated.branchId,
          patientId: existing.patientId,
          odontogramId: existing.patientOdontogramId,
          treatmentPlanGroupId: existing.treatmentPlanGroupId,
          treatmentPlanName: existing.treatmentPlanGroupName,
          userId: actor.id,
          action: 'APPOINTMENT_STATUS_CHANGED',
          resourceType: 'APPOINTMENT',
          resourceId: existing.id,
          oldValues: { appointmentNumber: existing.appointmentNumber, status: existing.status },
          newValues: { appointmentNumber: existing.appointmentNumber, status: updated.status },
          description: `Appointment ${existing.appointmentNumber} status changed from ${existing.status} to ${updated.status}`,
        });

        await this.syncTreatmentPlanStatusFromAppointments(
          tenantId,
          existing.patientOdontogramId,
          existing.treatmentPlanGroupId,
          actor.id,
          existing.appointmentNumber,
        );
      }

      this.notificationsGateway.sendToTenant(tenantId, 'treatment_plan:updated', {
        patientId: existing.patientId,
        groupId: existing.treatmentPlanGroupId,
      });
    }

    this.logger.log(`📝 Appointment ${existing.appointmentNumber} updated by ${actor.id}`);
    return updated;
  }

  /**
   * Update appointment status — CLINIC ADMIN ONLY.
   */
  async updateStatus(
    id: string,
    status: string,
    tenantId: string,
    actor: AuthenticatedUser,
    cancellationReason?: string,
    actualStartTime?: string | Date,
    actualEndTime?: string | Date,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    // RBAC: Only Clinic Admin
    await this.assertClinicAdmin(actor, tenantId);

    if (!VALID_STATUSES.includes(status)) {
      throw new BadRequestException(`Invalid appointment status: ${status}`);
    }

    const existing = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Appointment with ID '${id}' not found`);
    }

    this.assertStatusTransition(existing.status, status, 'status');

    const updateData: any = { status };
    if (status === 'CANCELLED' && cancellationReason) {
      updateData.cancellationReason = cancellationReason;
    }

    if (actualStartTime !== undefined) {
      updateData.actualStartTime = actualStartTime ? new Date(actualStartTime) : null;
    }
    if (actualEndTime !== undefined) {
      updateData.actualEndTime = actualEndTime ? new Date(actualEndTime) : null;
    }

    // Auto-capture actual timestamps and actors on status transitions
    if (status === 'IN_PROGRESS') {
      if (!existing.actualStartTime && !updateData.actualStartTime) {
        updateData.actualStartTime = new Date();
      }
      if (!existing.startedById) {
        updateData.startedById = actor.id;
      }
    }
    if (status === 'COMPLETED') {
      if (!existing.actualStartTime && !updateData.actualStartTime) {
        updateData.actualStartTime = new Date();
      }
      if (!existing.actualEndTime && !updateData.actualEndTime) {
        updateData.actualEndTime = new Date();
      }
      if (!existing.startedById) {
        updateData.startedById = actor.id;
      }
      updateData.endedById = actor.id;
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        patient: {
          select: {
            id: true,
            recordNumber: true,
            firstName: true,
            fatherLastName: true,
            motherLastName: true,
            phoneNumber: true,
            phoneCountryCode: true,
          },
        },
        doctor: {
          select: { id: true, name: true, email: true },
        },
        branch: {
          select: { id: true, name: true },
        },
        startedBy: {
          select: { id: true, name: true },
        },
        endedBy: {
          select: { id: true, name: true },
        },
      },
    });

    let incomeRecordId: string | null = null;
    if (status === 'IN_PROGRESS' || status === 'COMPLETED') {
      try {
        const inc = await this.incomeService.getOrCreateByAppointment(id, tenantId, actor);
        incomeRecordId = inc.id;
      } catch (err: any) {
        this.logger.error(`Failed to ensure income record for appointment ${id}: ${err.message}`);
      }
    }

    if (existing.treatmentPlanGroupId && existing.patientOdontogramId && existing.status !== status) {
      await this.logTreatmentPlanAudit({
        tenantId,
        branchId: existing.branchId,
        patientId: existing.patientId,
        odontogramId: existing.patientOdontogramId,
        treatmentPlanGroupId: existing.treatmentPlanGroupId,
        treatmentPlanName: existing.treatmentPlanGroupName,
        userId: actor.id,
        action: 'APPOINTMENT_STATUS_CHANGED',
        resourceType: 'APPOINTMENT',
        resourceId: existing.id,
        oldValues: { appointmentNumber: existing.appointmentNumber, status: existing.status },
        newValues: {
          appointmentNumber: existing.appointmentNumber,
          status,
          ...(cancellationReason ? { cancellationReason } : {}),
        },
        description: `Appointment ${existing.appointmentNumber} status changed from ${existing.status} to ${status}`,
      });

      await this.syncTreatmentPlanStatusFromAppointments(
        tenantId,
        existing.patientOdontogramId,
        existing.treatmentPlanGroupId,
        actor.id,
        existing.appointmentNumber,
      );

      this.notificationsGateway.sendToTenant(tenantId, 'treatment_plan:updated', {
        patientId: existing.patientId,
        groupId: existing.treatmentPlanGroupId,
      });
    }

    this.logger.log(`🔄 Appointment ${existing.appointmentNumber} status → ${status} by ${actor.id}`);
    return { ...updated, incomeRecordId };
  }

  /**
   * Delete appointment — TENANT ADMIN ONLY.
   */
  async remove(id: string, tenantId: string, actor: AuthenticatedUser) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    // RBAC: STRICTLY Tenant Admin only
    const isAdmin = await this.isTenantAdmin(actor, tenantId);
    if (!isAdmin) {
      throw new ForbiddenException('Only Tenant Administrators can delete appointments.');
    }

    const existing = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Appointment with ID '${id}' not found`);
    }

    await this.prisma.appointment.delete({ where: { id } });

    if (existing.treatmentPlanGroupId && existing.patientOdontogramId) {
      await this.logTreatmentPlanAudit({
        tenantId,
        branchId: existing.branchId,
        patientId: existing.patientId,
        odontogramId: existing.patientOdontogramId,
        treatmentPlanGroupId: existing.treatmentPlanGroupId,
        treatmentPlanName: existing.treatmentPlanGroupName,
        userId: actor.id,
        action: 'APPOINTMENT_DELETED',
        resourceType: 'APPOINTMENT',
        resourceId: existing.id,
        oldValues: {
          appointmentNumber: existing.appointmentNumber,
          status: existing.status,
          startTime: existing.startTime,
          endTime: existing.endTime,
        },
        description: `Deleted appointment ${existing.appointmentNumber}`,
      });

      await this.syncTreatmentPlanStatusFromAppointments(
        tenantId,
        existing.patientOdontogramId,
        existing.treatmentPlanGroupId,
        actor.id,
        existing.appointmentNumber,
      );

      this.notificationsGateway.sendToTenant(tenantId, 'treatment_plan:updated', {
        patientId: existing.patientId,
        groupId: existing.treatmentPlanGroupId,
      });
    }

    this.logger.log(`🗑️ Appointment ${existing.appointmentNumber} deleted by Tenant Admin ${actor.id}`);

    return { message: 'Appointment deleted successfully', appointmentNumber: existing.appointmentNumber };
  }

  // ============================================================================
  // WORKING HOURS — CLINIC
  // ============================================================================

  /**
   * Get clinic working hours for a branch. Returns defaults if not yet configured.
   */
  async getClinicWorkingHours(tenantId: string, branchId?: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const existing = await this.prisma.clinicWorkingHour.findMany({
      where: { tenantId, branchId: branchId || null },
      orderBy: { dayOfWeek: 'asc' },
    });

    if (existing.length > 0) {
      return existing;
    }

    // Return default schedule (Mon-Fri open, Sat-Sun closed)
    const defaults = [];
    for (let day = 1; day <= 7; day++) {
      defaults.push({
        id: null,
        tenantId,
        branchId: branchId || null,
        dayOfWeek: day,
        isOpen: day <= 5,
        startTime: '09:00',
        endTime: '18:00',
        hasLunchBreak: true,
        lunchStartTime: '13:00',
        lunchEndTime: '14:00',
        slotDurationMinutes: 30,
      });
    }
    return defaults;
  }

  /**
   * Save/update clinic working hours — CLINIC ADMIN ONLY.
   */
  async updateClinicWorkingHours(
    dto: UpdateClinicWorkingHoursDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    // RBAC: Only Clinic Admin
    const adminBranchId = await this.assertClinicAdmin(actor, tenantId);
    const effectiveBranchId = dto.branchId || adminBranchId;

    const upsertOps = dto.schedule.map((day) =>
      this.prisma.clinicWorkingHour.upsert({
        where: {
          tenantId_branchId_dayOfWeek: {
            tenantId,
            branchId: effectiveBranchId,
            dayOfWeek: day.dayOfWeek,
          },
        },
        update: {
          isOpen: day.isOpen,
          startTime: day.startTime,
          endTime: day.endTime,
          hasLunchBreak: day.hasLunchBreak,
          lunchStartTime: day.lunchStartTime || null,
          lunchEndTime: day.lunchEndTime || null,
          slotDurationMinutes: day.slotDurationMinutes || 30,
        },
        create: {
          tenantId,
          branchId: effectiveBranchId,
          dayOfWeek: day.dayOfWeek,
          isOpen: day.isOpen,
          startTime: day.startTime,
          endTime: day.endTime,
          hasLunchBreak: day.hasLunchBreak,
          lunchStartTime: day.lunchStartTime || null,
          lunchEndTime: day.lunchEndTime || null,
          slotDurationMinutes: day.slotDurationMinutes || 30,
        },
      }),
    );

    await this.prisma.$transaction(upsertOps);

    this.logger.log(`⏰ Clinic working hours updated for branch ${effectiveBranchId} by ${actor.id}`);

    return this.getClinicWorkingHours(tenantId, effectiveBranchId);
  }

  // ============================================================================
  // WORKING HOURS — DOCTOR
  // ============================================================================

  /**
   * List clinic doctors with their schedule summary.
   */
  async getDoctorsWithSchedule(tenantId: string, branchId?: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const whereClause: any = {
      memberships: {
        some: { tenantId },
      },
      userRoles: {
        some: {
          tenantId,
          role: { slug: { in: ['clinic-doctor', 'doctor', 'clinic_doctor', 'dentist'] } },
        },
      },
    };

    if (branchId && branchId !== 'all') {
      whereClause.OR = [
        { userBranches: { some: { branchId } } },
        { userRoles: { some: { tenantId, branchId } } },
      ];
    }

    const doctors = await this.prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        colorCode: true,
        userRoles: {
          where: { tenantId },
          include: { role: true },
        },
        doctorWorkingHours: {
          where: { tenantId },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const mapped = doctors.map((doc) => ({
      id: doc.id,
      name: doc.name,
      email: doc.email,
      avatarUrl: doc.avatarUrl,
      colorCode: doc.colorCode,
      roleName: doc.userRoles?.[0]?.role?.name || 'Clinic Doctor',
      daysConfigured: doc.doctorWorkingHours?.filter((h) => h.isWorking).length || 0,
      doctorWorkingHours: doc.doctorWorkingHours,
    }));

    return { doctors: mapped };
  }

  /**
   * Get an individual doctor's 7-day schedule.
   * Falls back to clinic hours if not yet configured.
   */
  async getDoctorWorkingHours(tenantId: string, doctorId: string, branchId?: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');
    if (!doctorId) throw new BadRequestException('Doctor ID is required');

    const existing = await this.prisma.doctorWorkingHour.findMany({
      where: { tenantId, doctorId, branchId: branchId || undefined },
      orderBy: { dayOfWeek: 'asc' },
    });

    if (existing.length > 0) {
      return existing;
    }

    // Fallback: return clinic hours as default for this doctor
    const clinicHours = await this.getClinicWorkingHours(tenantId, branchId);
    return clinicHours.map((ch) => ({
      id: null,
      tenantId,
      branchId: branchId || null,
      doctorId,
      dayOfWeek: ch.dayOfWeek,
      isWorking: ch.isOpen,
      startTime: ch.startTime,
      endTime: ch.endTime,
      hasLunchBreak: ch.hasLunchBreak,
      lunchStartTime: ch.lunchStartTime,
      lunchEndTime: ch.lunchEndTime,
    }));
  }

  /**
   * Save/update doctor working hours — CLINIC ADMIN ONLY.
   */
  async updateDoctorWorkingHours(
    doctorId: string,
    dto: UpdateDoctorWorkingHoursDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');
    if (!doctorId) throw new BadRequestException('Doctor ID is required');

    // RBAC: Only Clinic Admin
    const adminBranchId = await this.assertClinicAdmin(actor, tenantId);
    const effectiveBranchId = dto.branchId || adminBranchId;

    // Verify doctor exists
    const doctorUser = await this.prisma.user.findFirst({
      where: { id: doctorId },
    });
    if (!doctorUser) {
      throw new NotFoundException(`Doctor with ID '${doctorId}' not found`);
    }

    const upsertOps = dto.schedule.map((day) =>
      this.prisma.doctorWorkingHour.upsert({
        where: {
          tenantId_doctorId_dayOfWeek_branchId: {
            tenantId,
            doctorId,
            dayOfWeek: day.dayOfWeek,
            branchId: effectiveBranchId,
          },
        },
        update: {
          isWorking: day.isWorking,
          startTime: day.startTime,
          endTime: day.endTime,
          hasLunchBreak: day.hasLunchBreak,
          lunchStartTime: day.lunchStartTime || null,
          lunchEndTime: day.lunchEndTime || null,
        },
        create: {
          tenantId,
          branchId: effectiveBranchId,
          doctorId,
          dayOfWeek: day.dayOfWeek,
          isWorking: day.isWorking,
          startTime: day.startTime,
          endTime: day.endTime,
          hasLunchBreak: day.hasLunchBreak,
          lunchStartTime: day.lunchStartTime || null,
          lunchEndTime: day.lunchEndTime || null,
        },
      }),
    );

    await this.prisma.$transaction(upsertOps);

    this.logger.log(
      `⏰ Doctor ${doctorUser.name} working hours updated for branch ${effectiveBranchId} by ${actor.id}`,
    );

    return this.getDoctorWorkingHours(tenantId, doctorId, effectiveBranchId);
  }

  // ============================================================================
  // AVAILABLE SLOTS
  // ============================================================================

  /**
   * Get available appointment time slots for a given doctor, date, and duration.
   */
  async getAvailableSlots(
    tenantId: string,
    doctorId: string,
    date: string,
    durationMinutes: number = 30,
    branchId?: string,
    excludeAppointmentId?: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');
    if (!doctorId) throw new BadRequestException('Doctor ID is required');
    if (!date) throw new BadRequestException('Date is required');

    // Get day of week (1=Monday ... 7=Sunday)
    const dateObj = new Date(date + 'T12:00:00Z');
    let dayOfWeek = dateObj.getUTCDay(); // 0=Sun 1=Mon...6=Sat
    dayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert to 1=Mon...7=Sun

    // Get doctor's schedule for this day
    const doctorSchedule = await this.prisma.doctorWorkingHour.findFirst({
      where: branchId
        ? { tenantId, doctorId, dayOfWeek, branchId }
        : { tenantId, doctorId, dayOfWeek },
    });

    let scheduleForDay;
    if (doctorSchedule) {
      if (!doctorSchedule.isWorking) {
        return { slots: [], availableSlots: [], message: 'Doctor is not working on this day' };
      }
      scheduleForDay = doctorSchedule;
    } else {
      // Fallback to clinic hours
      const clinicSchedule = await this.prisma.clinicWorkingHour.findFirst({
        where: branchId
          ? { tenantId, branchId, dayOfWeek }
          : { tenantId, dayOfWeek },
        orderBy: { updatedAt: 'desc' },
      });
      if (clinicSchedule) {
        if (!clinicSchedule.isOpen) {
          return { slots: [], availableSlots: [], message: 'Clinic is closed on this day' };
        }
        scheduleForDay = {
          startTime: clinicSchedule.startTime,
          endTime: clinicSchedule.endTime,
          hasLunchBreak: clinicSchedule.hasLunchBreak,
          lunchStartTime: clinicSchedule.lunchStartTime,
          lunchEndTime: clinicSchedule.lunchEndTime,
        };
      } else {
        // Use defaults
        scheduleForDay = {
          startTime: '09:00',
          endTime: '18:00',
          hasLunchBreak: true,
          lunchStartTime: '13:00',
          lunchEndTime: '14:00',
        };
        if (dayOfWeek > 5) {
          return { slots: [], availableSlots: [], message: 'Clinic is closed on weekends (default)' };
        }
      }
    }

    // Get existing appointments for this doctor on this date
    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        doctorId,
        date: dateObj,
        status: { not: 'CANCELLED' },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
      select: { startTime: true, endTime: true },
    });

    // Generate slots
    const workStart = this.timeToMinutes(scheduleForDay.startTime);
    const workEnd = this.timeToMinutes(scheduleForDay.endTime);
    const lunchStart = scheduleForDay.hasLunchBreak && scheduleForDay.lunchStartTime
      ? this.timeToMinutes(scheduleForDay.lunchStartTime)
      : null;
    const lunchEnd = scheduleForDay.hasLunchBreak && scheduleForDay.lunchEndTime
      ? this.timeToMinutes(scheduleForDay.lunchEndTime)
      : null;

    const bookedSlots = existingAppointments.map((a) => ({
      start: this.timeToMinutes(a.startTime),
      end: this.timeToMinutes(a.endTime),
    }));

    // Fixed 15-min display interval — each slot checks if full durationMinutes fits
    const displayInterval = 15;
    const effectiveDuration = durationMinutes > 0 ? durationMinutes : 30;
    const slots: { startTime: string; endTime: string; available: boolean }[] = [];

    for (let slotStart = workStart; slotStart + effectiveDuration <= workEnd; slotStart += displayInterval) {
      const slotEnd = slotStart + effectiveDuration;

      // Skip slots that overlap with lunch break
      if (lunchStart !== null && lunchEnd !== null) {
        if (slotStart < lunchEnd && slotEnd > lunchStart) {
          continue;
        }
      }

      // Check booking conflicts — slot is unavailable if the full duration block
      // overlaps with any existing (non-cancelled) appointment
      const hasConflict = bookedSlots.some(
        (b) => slotStart < b.end && slotEnd > b.start,
      );

      slots.push({
        startTime: this.minutesToTime(slotStart),
        endTime: this.minutesToTime(slotEnd),
        available: !hasConflict,
      });
    }

    return {
      slots,
      availableSlots: slots.filter((s) => s.available).map((s) => s.startTime),
    };
  }
}
