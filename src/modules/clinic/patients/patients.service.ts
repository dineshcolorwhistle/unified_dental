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
import { PatientStatus, Prisma } from '@prisma/client';

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
   * Create a new patient
   */
  async create(dto: CreatePatientDto, tenantId: string, actor: AuthenticatedUser) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

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
}
