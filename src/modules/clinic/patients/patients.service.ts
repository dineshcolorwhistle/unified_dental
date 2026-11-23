import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { QueryPatientDto } from './dto/query-patient.dto';
import { CreatePatientNoteDto } from './dto/create-patient-note.dto';
import { QueryPatientNoteDto } from './dto/query-patient-note.dto';
import { CreatePatientAdvancePaymentDto } from './dto/create-patient-advance-payment.dto';
import { QueryPatientAdvancePaymentDto } from './dto/query-patient-advance-payment.dto';
import { PatientStatus, Prisma, AdvancePaymentStatus } from '@prisma/client';

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate an automated clinical record number (e.g. PAT-2026-0001)
   */
  private async generateRecordNumber(tenantId: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `PAT-${currentYear}-`;

    const lastPatient = await this.prisma.patient.findFirst({
      where: {
        tenantId,
        recordNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        recordNumber: 'desc',
      },
      select: {
        recordNumber: true,
      },
    });

    let nextSeq = 1;
    if (lastPatient && lastPatient.recordNumber) {
      const parts = lastPatient.recordNumber.split('-');
      const numPart = parseInt(parts[2], 10);
      if (!isNaN(numPart)) {
        nextSeq = numPart + 1;
      }
    }

    return `${prefix}${nextSeq.toString().padStart(4, '0')}`;
  }

  /**
   * Get KPI statistics for the clinic patient module
   */
  async getStats(tenantId: string, branchId?: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const baseWhere: Prisma.PatientWhereInput = { tenantId };
    if (branchId) {
      baseWhere.branchId = branchId;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, active, newThisMonth, withAlerts] = await Promise.all([
      this.prisma.patient.count({ where: baseWhere }),
      this.prisma.patient.count({
        where: { ...baseWhere, status: PatientStatus.ACTIVE },
      }),
      this.prisma.patient.count({
        where: {
          ...baseWhere,
          createdAt: { gte: startOfMonth },
        },
      }),
      this.prisma.patient.count({
        where: {
          ...baseWhere,
          allergies: {
            not: null,
            gt: '',
          },
        },
      }),
    ]);

    return {
      total,
      active,
      newThisMonth,
      withAlerts,
    };
  }

  /**
   * List patients with search, filters, and pagination
   */
  async findAll(tenantId: string, query: QueryPatientDto, actor: AuthenticatedUser) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.PatientWhereInput = {
      tenantId,
    };

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.status && query.status !== 'ALL') {
      where.status = query.status as PatientStatus;
    }

    if (query.gender && query.gender !== 'ALL') {
      where.gender = { equals: query.gender, mode: 'insensitive' };
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { fatherLastName: { contains: q, mode: 'insensitive' } },
        { motherLastName: { contains: q, mode: 'insensitive' } },
        { recordNumber: { contains: q, mode: 'insensitive' } },
        { phoneNumber: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, patients] = await Promise.all([
      this.prisma.patient.count({ where }),
      this.prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
    ]);

    return {
      patients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Get single patient record by ID
   */
  async findOne(id: string, tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const patient = await this.prisma.patient.findFirst({
      where: { id, tenantId },
      include: {
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
            email: true,
          },
        },
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID '${id}' not found`);
    }

    return patient;
  }

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
   * Helper to verify if actor has Clinic operational privileges (Clinic Admin, Doctor, Staff)
   */
  async isClinicOperational(actor: AuthenticatedUser, tenantId: string): Promise<boolean> {
    const hasRole = actor.roles?.some((r: string) => {
      const lower = r.toLowerCase();
      return (
        lower.includes('clinic-admin') ||
        lower.includes('clinic admin') ||
        lower.includes('clinic doctor') ||
        lower.includes('clinic-doctor') ||
        lower.includes('clinic staff') ||
        lower.includes('clinic-staff') ||
        lower === 'doctor'
      );
    });
    if (hasRole) return true;

    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: {
          slug: { in: ['clinic-admin', 'clinic-doctor', 'clinic-staff', 'doctor', 'staff'] },
        },
      },
    });

    return Boolean(userRole);
  }

  /**
   * Create a new patient
   */
  async create(dto: CreatePatientDto, tenantId: string, actor: AuthenticatedUser) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isOperational = await this.isClinicOperational(actor, tenantId);
    if (isTenantAdminUser && !isOperational && !actor.isSuperAdmin) {
      throw new ForbiddenException(
        'Tenant Administrators do not have permission to register new patients. Patient registration is reserved for Clinic staff and administrators.',
      );
    }

    const recordNumber = await this.generateRecordNumber(tenantId);

    let parsedDob: Date | null = null;
    if (dto.dateOfBirth) {
      const d = new Date(dto.dateOfBirth);
      if (!isNaN(d.getTime())) {
        parsedDob = d;
      }
    }

    const patient = await this.prisma.patient.create({
      data: {
        tenantId,
        branchId: dto.branchId || null,
        recordNumber,
        firstName: dto.firstName.trim(),
        fatherLastName: dto.fatherLastName?.trim() || null,
        motherLastName: dto.motherLastName?.trim() || null,
        gender: dto.gender || null,
        dateOfBirth: parsedDob,
        height: dto.height !== undefined && dto.height !== null ? Number(dto.height) : null,
        weight: dto.weight !== undefined && dto.weight !== null ? Number(dto.weight) : null,
        email: dto.email?.trim().toLowerCase() || null,
        phoneCountryCode: dto.phoneCountryCode || '+52',
        phoneNumber: dto.phoneNumber?.trim() || null,
        address: dto.address?.trim() || null,
        emergencyContactName: dto.emergencyContactName?.trim() || null,
        emergencyContactRelation: dto.emergencyContactRelation?.trim() || null,
        emergencyContactCountryCode: dto.emergencyContactCountryCode || '+52',
        emergencyContactPhone: dto.emergencyContactPhone?.trim() || null,
        medications: dto.medications?.trim() || null,
        allergies: dto.allergies?.trim() || null,
        referralSource: dto.referralSource || null,
        status: dto.status || PatientStatus.ACTIVE,
        notes: dto.notes?.trim() || null,
        createdById: actor.id,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return patient;
  }

  /**
   * Update an existing patient
   */
  async update(id: string, dto: UpdatePatientDto, tenantId: string, actor: AuthenticatedUser) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isOperational = await this.isClinicOperational(actor, tenantId);
    if (isTenantAdminUser && !isOperational && !actor.isSuperAdmin) {
      throw new ForbiddenException(
        'Tenant Administrators do not have permission to edit patient details. Editing is reserved for Clinic staff and administrators.',
      );
    }

    const existing = await this.prisma.patient.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Patient with ID '${id}' not found`);
    }

    const updateData: Prisma.PatientUpdateInput = {};

    if (dto.firstName !== undefined) updateData.firstName = dto.firstName.trim();
    if (dto.fatherLastName !== undefined) updateData.fatherLastName = dto.fatherLastName?.trim() || null;
    if (dto.motherLastName !== undefined) updateData.motherLastName = dto.motherLastName?.trim() || null;
    if (dto.gender !== undefined) updateData.gender = dto.gender || null;
    if (dto.height !== undefined) updateData.height = dto.height !== null ? Number(dto.height) : null;
    if (dto.weight !== undefined) updateData.weight = dto.weight !== null ? Number(dto.weight) : null;
    if (dto.email !== undefined) updateData.email = dto.email?.trim().toLowerCase() || null;
    if (dto.phoneCountryCode !== undefined) updateData.phoneCountryCode = dto.phoneCountryCode || '+52';
    if (dto.phoneNumber !== undefined) updateData.phoneNumber = dto.phoneNumber?.trim() || null;
    if (dto.address !== undefined) updateData.address = dto.address?.trim() || null;
    if (dto.emergencyContactName !== undefined) updateData.emergencyContactName = dto.emergencyContactName?.trim() || null;
    if (dto.emergencyContactRelation !== undefined) updateData.emergencyContactRelation = dto.emergencyContactRelation?.trim() || null;
    if (dto.emergencyContactCountryCode !== undefined) updateData.emergencyContactCountryCode = dto.emergencyContactCountryCode || '+52';
    if (dto.emergencyContactPhone !== undefined) updateData.emergencyContactPhone = dto.emergencyContactPhone?.trim() || null;
    if (dto.medications !== undefined) updateData.medications = dto.medications?.trim() || null;
    if (dto.allergies !== undefined) updateData.allergies = dto.allergies?.trim() || null;
    if (dto.referralSource !== undefined) updateData.referralSource = dto.referralSource || null;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.notes !== undefined) updateData.notes = dto.notes?.trim() || null;

    if (dto.dateOfBirth !== undefined) {
      if (dto.dateOfBirth) {
        const d = new Date(dto.dateOfBirth);
        updateData.dateOfBirth = !isNaN(d.getTime()) ? d : null;
      } else {
        updateData.dateOfBirth = null;
      }
    }

    if (dto.branchId !== undefined) {
      updateData.branch = dto.branchId ? { connect: { id: dto.branchId } } : { disconnect: true };
    }

    const updated = await this.prisma.patient.update({
      where: { id },
      data: updateData,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Verify that the actor has Tenant Administrator or Super Admin privileges
   */
  private async assertTenantAdmin(actor: AuthenticatedUser, tenantId: string): Promise<void> {
    if (actor.isSuperAdmin) {
      return;
    }

    const isOwnerMem = (actor as any).memberships?.some(
      (m: any) => m.tenantId === tenantId && m.isOwner,
    );
    const hasAdminRole = actor.roles?.some((r: string) => {
      const lower = r.toLowerCase();
      return (
        lower === 'tenant-admin' ||
        lower.includes('tenant administrator') ||
        lower.includes('tenant admin')
      );
    });

    if (isOwnerMem || hasAdminRole) {
      return;
    }

    throw new ForbiddenException(
      'Only Tenant Administrators have permission to delete patient records',
    );
  }

  /**
   * Delete a patient record (Strictly restricted to Tenant Admin)
   */
  async remove(id: string, tenantId: string, actor: AuthenticatedUser) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    // Strict Tenant Admin authorization check
    await this.assertTenantAdmin(actor, tenantId);

    const existing = await this.prisma.patient.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Patient with ID '${id}' not found`);
    }

    await this.prisma.patient.delete({
      where: { id },
    });

    return { success: true, message: 'Patient removed successfully' };
  }

  /**
   * Create a new clinical note for a patient
   */
  async createNote(
    tenantId: string,
    actor: AuthenticatedUser,
    dto: CreatePatientNoteDto,
    patientIdParam?: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isOperational = await this.isClinicOperational(actor, tenantId);
    if (isTenantAdminUser && !isOperational && !actor.isSuperAdmin) {
      throw new ForbiddenException(
        'Tenant Administrators do not have permission to create clinical notes.',
      );
    }

    const patientId = patientIdParam || dto.patientId;
    if (!patientId) {
      throw new BadRequestException('Patient ID is required');
    }

    // Verify patient exists and belongs to current tenant
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID '${patientId}' not found`);
    }

    const noteDate = dto.noteDate ? new Date(dto.noteDate) : new Date();
    if (isNaN(noteDate.getTime())) {
      throw new BadRequestException('Invalid note date format');
    }

    const createdNote = await this.prisma.patientNote.create({
      data: {
        tenantId,
        patientId,
        createdById: actor.id,
        noteDate,
        topic: dto.topic ? dto.topic.trim() : null,
        note: dto.note.trim(),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Optional audit log recording
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId: actor.id,
          action: 'CREATE',
          resourceType: 'PATIENT_NOTE',
          resourceId: createdNote.id,
          newValues: {
            patientId,
            topic: createdNote.topic,
            noteDate: createdNote.noteDate,
          },
        },
      });
    } catch (auditErr) {
      // Non-blocking
    }

    return createdNote;
  }

  /**
   * List clinical history notes for a patient with search and pagination
   */
  async findPatientNotes(
    tenantId: string,
    patientId: string,
    query?: QueryPatientNoteDto,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');
    if (!patientId) throw new BadRequestException('Patient ID is required');

    // Verify patient exists in tenant and fetch header info
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID '${patientId}' not found`);
    }

    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query?.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.PatientNoteWhereInput = {
      tenantId,
      patientId,
    };

    if (query?.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { topic: { contains: q, mode: 'insensitive' } },
        { note: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, notes] = await Promise.all([
      this.prisma.patientNote.count({ where }),
      this.prisma.patientNote.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { noteDate: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return {
      notes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      patient: {
        id: patient.id,
        recordNumber: patient.recordNumber,
        firstName: patient.firstName,
        fatherLastName: patient.fatherLastName,
        motherLastName: patient.motherLastName,
        phoneCountryCode: patient.phoneCountryCode,
        phoneNumber: patient.phoneNumber,
        email: patient.email,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        branch: patient.branch,
      },
    };
  }

  /**
   * Delete a clinical note (Author or Tenant Admin)
   */
  async deletePatientNote(
    tenantId: string,
    patientId: string,
    noteId: string,
    actor: AuthenticatedUser,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const note = await this.prisma.patientNote.findFirst({
      where: { id: noteId, patientId, tenantId },
    });

    if (!note) {
      throw new NotFoundException(`Patient note not found`);
    }

    // Check if actor is author or tenant admin
    const isAuthor = note.createdById === actor.id;
    let isAdmin = false;
    try {
      await this.assertTenantAdmin(actor, tenantId);
      isAdmin = true;
    } catch {
      isAdmin = false;
    }

    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to delete this clinical note',
      );
    }

    await this.prisma.patientNote.delete({
      where: { id: noteId },
    });

    return { success: true, message: 'Clinical note deleted successfully' };
  }

  /**
   * Generate an automated advance payment receipt number (e.g. ADV-2026-0001)
   */
  private async generateAdvancePaymentReceiptNumber(tenantId: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `ADV-${currentYear}-`;

    const lastPayment = await this.prisma.patientAdvancePayment.findFirst({
      where: {
        tenantId,
        receiptNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        receiptNumber: 'desc',
      },
      select: {
        receiptNumber: true,
      },
    });

    let sequence = 1;
    if (lastPayment?.receiptNumber) {
      const match = lastPayment.receiptNumber.match(/ADV-\d{4}-(\d+)/);
      if (match && match[1]) {
        sequence = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Resolve treatment plan doctor context for a patient
   */
  async getTreatmentPlanDoctorContext(tenantId: string, patientId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const [odontogram, patient] = await Promise.all([
      this.prisma.patientOdontogram.findUnique({
        where: { patientId },
        select: {
          id: true,
          proposedPlan: true,
        },
      }),
      this.prisma.patient.findFirst({
        where: { id: patientId, tenantId },
        select: { id: true, branchId: true },
      }),
    ]);

    const proposedPlan = odontogram?.proposedPlan as any;
    const groups = Array.isArray(proposedPlan?.groups) ? proposedPlan.groups : [];

    const doctorIdsSet = new Set<string>();
    groups.forEach((g: any) => {
      if (Array.isArray(g.items)) {
        g.items.forEach((it: any) => {
          if (it.doctorId && typeof it.doctorId === 'string' && it.doctorId !== 'unassigned') {
            doctorIdsSet.add(it.doctorId);
          }
        });
      }
    });

    const doctorIds = Array.from(doctorIdsSet);
    let doctors: Array<{ id: string; name: string; specialization?: string; email?: string }> = [];

    if (doctorIds.length > 0) {
      const dbDoctors = await this.prisma.user.findMany({
        where: {
          id: { in: doctorIds },
          memberships: {
            some: { tenantId },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          userRoles: {
            where: { tenantId },
            select: {
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      doctors = dbDoctors.map((doc) => ({
        id: doc.id,
        name: doc.name,
        email: doc.email,
        specialization: doc.userRoles?.map((ur) => ur.role?.name).filter(Boolean).join(', ') || undefined,
      }));
    }

    const hasTreatmentPlan = groups.length > 0;

    return {
      hasTreatmentPlan,
      treatmentPlanCount: groups.length,
      doctors,
      branchId: patient?.branchId || null,
    };
  }

  /**
   * Create an advance payment record with audit tracking
   */
  async createAdvancePayment(
    tenantId: string,
    actor: AuthenticatedUser,
    dto: CreatePatientAdvancePaymentDto,
    patientIdParam?: string,
    reqMetadata?: { ip?: string; userAgent?: string },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const patientId = patientIdParam || dto.patientId;
    if (!patientId) {
      throw new BadRequestException('Patient ID is required');
    }

    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
      include: { branch: true },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${patientId} not found`);
    }

    const amountNum = Number(dto.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new BadRequestException('Advance payment amount must be greater than zero');
    }

    // Doctor validation (optional: only if doctorId is provided)
    let doctorId: string | null = null;
    let doctorName: string | null = null;
    if (dto.doctorId && dto.doctorId.trim()) {
      const doc = await this.prisma.user.findFirst({
        where: {
          id: dto.doctorId.trim(),
          memberships: { some: { tenantId } },
        },
        select: { id: true, name: true },
      });
      if (!doc) {
        throw new BadRequestException('Selected doctor does not exist or belong to this tenant');
      }
      doctorId = doc.id;
      doctorName = doc.name;
    }

    const receiptNumber = await this.generateAdvancePaymentReceiptNumber(tenantId);
    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();

    const advancePayment = await this.prisma.patientAdvancePayment.create({
      data: {
        tenantId,
        branchId: actor.activeBranchId || patient.branchId,
        patientId: patient.id,
        doctorId,
        receiptNumber,
        amount: new Prisma.Decimal(amountNum),
        balanceRemaining: new Prisma.Decimal(amountNum),
        paymentMethod: dto.paymentMethod?.trim() || 'CASH',
        paymentDate,
        status: AdvancePaymentStatus.AVAILABLE,
        notes: dto.notes?.trim() || null,
        createdById: actor.id,
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Audit Tracking (Requirement 5)
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          branchId: advancePayment.branchId,
          moduleKey: 'CLINIC',
          userId: actor.id,
          action: 'CREATE_ADVANCE_PAYMENT',
          resourceType: 'PATIENT_ADVANCE_PAYMENT',
          resourceId: advancePayment.id,
          newValues: {
            receiptNumber,
            patientId: patient.id,
            patientName: `${patient.firstName} ${patient.fatherLastName || ''}`.trim(),
            doctorId,
            doctorName,
            amount: amountNum,
            balanceRemaining: amountNum,
            paymentMethod: advancePayment.paymentMethod,
            paymentDate: advancePayment.paymentDate,
            status: advancePayment.status,
            notes: advancePayment.notes,
            createdByName: actor.name,
            createdByEmail: actor.email,
          },
          ipAddress: reqMetadata?.ip || null,
          userAgent: reqMetadata?.userAgent || null,
        },
      });
    } catch (auditErr) {
      this.logger.warn('Failed to record audit log for advance payment creation', auditErr);
    }

    return advancePayment;
  }

  /**
   * List advance payments for a patient with pagination and search
   */
  async findPatientAdvancePayments(
    tenantId: string,
    patientId: string,
    query?: QueryPatientAdvancePaymentDto,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
      select: {
        id: true,
        recordNumber: true,
        firstName: true,
        fatherLastName: true,
        motherLastName: true,
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${patientId} not found`);
    }

    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query?.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.PatientAdvancePaymentWhereInput = {
      tenantId,
      patientId,
    };

    if (query?.doctorId) {
      where.doctorId = query.doctorId;
    }

    if (query?.status) {
      where.status = query.status as any;
    }

    if (query?.search && query.search.trim()) {
      const keyword = query.search.trim();
      where.OR = [
        { receiptNumber: { contains: keyword, mode: 'insensitive' } },
        { notes: { contains: keyword, mode: 'insensitive' } },
        { paymentMethod: { contains: keyword, mode: 'insensitive' } },
        { doctor: { name: { contains: keyword, mode: 'insensitive' } } },
      ];
    }

    const [total, payments, totalsAggregate] = await Promise.all([
      this.prisma.patientAdvancePayment.count({ where }),
      this.prisma.patientAdvancePayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { paymentDate: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          doctor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.patientAdvancePayment.aggregate({
        where: { tenantId, patientId },
        _sum: {
          amount: true,
          balanceRemaining: true,
        },
      }),
    ]);

    return {
      payments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      totalAdvancesAmount: Number(totalsAggregate._sum.amount || 0),
      totalAvailableBalance: Number(totalsAggregate._sum.balanceRemaining || 0),
      patient,
    };
  }
}
