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
import { TeethModel, OdontogramTreatmentStatus, Prisma } from '@prisma/client';
import { NotificationsGateway } from '../../../core/notifications/notifications.gateway';
import {
  UpdateOdontogramConfigDto,
  CreateOdontogramTreatmentDto,
  UpdateOdontogramTreatmentDto,
  CreateOdontogramDiagnosticDto,
  UpdateOdontogramDiagnosticDto,
  UpdatePatientOdontogramDto,
  AddPatientDiagnosticDto,
  UpdatePatientDiagnosticDto,
  AddPatientTreatmentDto,
  UpdatePatientTreatmentDto,
  SavePatientOdontogramDto,
  UpdateTreatmentPlanStatusDto,
  QueryTreatmentPlanAuditDto,
} from './dto';

@Injectable()
export class ClinicOdontogramService {
  private readonly logger = new Logger(ClinicOdontogramService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

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
   * Resolve clinic branch for non-tenant-admin users or validate requested branch for clinic module.
   */
  async resolveClinicBranch(
    actor: AuthenticatedUser,
    tenantId: string,
    requestedBranchId?: string,
  ): Promise<string | null> {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);

    if (isTenantAdminUser) {
      if (!requestedBranchId || requestedBranchId === 'ALL' || requestedBranchId === 'all') {
        return null;
      }
      const branch = await this.prisma.branch.findFirst({
        where: { id: requestedBranchId, tenantId, moduleKey: 'CLINIC' },
      });
      if (!branch) {
        throw new BadRequestException('Specified clinic branch is invalid or does not belong to the Clinic module.');
      }
      return branch.id;
    }

    // Clinic admin: resolve from assigned role/branch
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

  // ─── Config / Default Teeth Model ────────────────────────

  async getConfig(
    tenantId: string,
    actor: AuthenticatedUser,
    branchIdFilter?: string,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    let targetBranchId: string | null = null;

    if (!isTenantAdminUser) {
      targetBranchId = await this.resolveClinicBranch(actor, tenantId);
    } else if (branchIdFilter && branchIdFilter !== 'ALL' && branchIdFilter !== 'all') {
      targetBranchId = await this.resolveClinicBranch(actor, tenantId, branchIdFilter);
    }

    if (targetBranchId) {
      const branchConfig = await this.prisma.clinicOdontogramConfig.findFirst({
        where: { tenantId, branchId: targetBranchId },
      });
      if (branchConfig) return branchConfig;
    }

    // Fallback to tenant-level config
    const tenantConfig = await this.prisma.clinicOdontogramConfig.findFirst({
      where: { tenantId, branchId: null },
    });

    if (tenantConfig) return tenantConfig;

    // Default structure if not configured yet
    return {
      tenantId,
      branchId: targetBranchId,
      defaultTeethModel: TeethModel.ADULT,
    };
  }

  async updateConfig(
    tenantId: string,
    actor: AuthenticatedUser,
    dto: UpdateOdontogramConfigDto,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (isTenantAdminUser && !actor.isSuperAdmin) {
      throw new ForbiddenException(
        'Tenant Administrators do not have permission to modify odontogram configuration defaults. Configuration is reserved for Clinic Administrators.',
      );
    }
    let targetBranchId: string | null = null;

    if (!isTenantAdminUser) {
      targetBranchId = await this.resolveClinicBranch(actor, tenantId);
      if (!targetBranchId) {
        throw new BadRequestException('Branch context is required for Clinic Admin.');
      }
    } else {
      if (dto.branchId && dto.branchId !== 'ALL' && dto.branchId !== 'all') {
        const branch = await this.prisma.branch.findFirst({
          where: { id: dto.branchId, tenantId, moduleKey: 'CLINIC' },
        });
        if (!branch) {
          throw new NotFoundException(`Clinic branch with ID "${dto.branchId}" does not exist in your organization.`);
        }
        targetBranchId = branch.id;
      }
    }

    const existing = await this.prisma.clinicOdontogramConfig.findFirst({
      where: {
        tenantId,
        branchId: targetBranchId,
      },
    });

    if (existing) {
      return this.prisma.clinicOdontogramConfig.update({
        where: { id: existing.id },
        data: {
          defaultTeethModel: dto.defaultTeethModel,
        },
      });
    }

    return this.prisma.clinicOdontogramConfig.create({
      data: {
        tenantId,
        branchId: targetBranchId,
        defaultTeethModel: dto.defaultTeethModel,
      },
    });
  }

  // ─── Treatments ──────────────────────────────────────────

  async findAllTreatments(
    tenantId: string,
    actor: AuthenticatedUser,
    branchIdFilter?: string,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    let branchCondition: any = undefined;

    if (!isTenantAdminUser) {
      const clinicBranchId = await this.resolveClinicBranch(actor, tenantId);
      if (clinicBranchId) {
        branchCondition = clinicBranchId;
      }
    } else if (branchIdFilter && branchIdFilter !== 'ALL' && branchIdFilter !== 'all') {
      branchCondition = branchIdFilter;
    }

    return this.prisma.clinicOdontogramTreatment.findMany({
      where: {
        tenantId,
        ...(branchCondition
          ? { branchId: branchCondition }
          : {
              OR: [
                { branchId: null },
                { branch: { moduleKey: 'CLINIC' } },
              ],
            }),
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createTreatment(
    tenantId: string,
    actor: AuthenticatedUser,
    dto: CreateOdontogramTreatmentDto,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (isTenantAdminUser && !actor.isSuperAdmin) {
      throw new ForbiddenException(
        'Tenant Administrators do not have permission to create treatments. Creation is reserved for Clinic Administrators.',
      );
    }
    let finalBranchId: string | null = null;

    if (!isTenantAdminUser) {
      finalBranchId = await this.resolveClinicBranch(actor, tenantId);
      if (!finalBranchId) {
        throw new BadRequestException('Branch context is required for Clinic Admin.');
      }
    } else {
      if (dto.branchId && dto.branchId !== 'ALL' && dto.branchId !== 'all') {
        finalBranchId = dto.branchId;
      } else {
        // Fallback to first active clinic branch if none provided
        const firstClinicBranch = await this.prisma.branch.findFirst({
          where: { tenantId, moduleKey: 'CLINIC', status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
        });
        finalBranchId = firstClinicBranch?.id || null;
      }
    }

    if (!finalBranchId) {
      throw new BadRequestException('A valid clinic branch is required to create a branch-scoped treatment.');
    }

    // Verify branch belongs to tenant and is a CLINIC branch
    const branch = await this.prisma.branch.findFirst({
      where: { id: finalBranchId, tenantId, moduleKey: 'CLINIC' },
    });
    if (!branch) {
      throw new NotFoundException(`Clinic branch with ID "${finalBranchId}" does not exist in your organization.`);
    }

    // Check duplicate name within the branch
    const existing = await this.prisma.clinicOdontogramTreatment.findFirst({
      where: {
        tenantId,
        branchId: finalBranchId,
        name: { equals: dto.name.trim(), mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(`A treatment named "${dto.name}" already exists for this clinic branch.`);
    }

    return this.prisma.clinicOdontogramTreatment.create({
      data: {
        tenantId,
        branchId: finalBranchId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        color: dto.color,
        appliesToWholeTooth: dto.appliesToWholeTooth ?? false,
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async updateTreatment(
    id: string,
    tenantId: string,
    actor: AuthenticatedUser,
    dto: UpdateOdontogramTreatmentDto,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (isTenantAdminUser && !actor.isSuperAdmin) {
      throw new ForbiddenException(
        'Tenant Administrators do not have permission to update treatments. Updates are reserved for Clinic Administrators.',
      );
    }

    const treatment = await this.prisma.clinicOdontogramTreatment.findFirst({
      where: { id, tenantId },
    });

    if (!treatment) {
      throw new NotFoundException(`Treatment with ID "${id}" was not found.`);
    }

    if (!isTenantAdminUser) {
      const clinicBranchId = await this.resolveClinicBranch(actor, tenantId);
      if (treatment.branchId !== clinicBranchId) {
        throw new ForbiddenException('You do not have permission to modify a treatment outside your assigned branch.');
      }
    }

    // If name is changing, verify no duplicate exists in the same branch
    if (dto.name && dto.name.trim() !== treatment.name) {
      const duplicate = await this.prisma.clinicOdontogramTreatment.findFirst({
        where: {
          tenantId,
          branchId: treatment.branchId,
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new ConflictException(`A treatment named "${dto.name}" already exists for this clinic branch.`);
      }
    }

    return this.prisma.clinicOdontogramTreatment.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.appliesToWholeTooth !== undefined && { appliesToWholeTooth: dto.appliesToWholeTooth }),
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async removeTreatment(
    id: string,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (!isTenantAdminUser) {
      throw new ForbiddenException('Only Tenant Administrators or Super Admins can delete odontogram treatments.');
    }

    const treatment = await this.prisma.clinicOdontogramTreatment.findFirst({
      where: { id, tenantId },
    });

    if (!treatment) {
      throw new NotFoundException(`Treatment with ID "${id}" was not found.`);
    }

    await this.prisma.clinicOdontogramTreatment.delete({
      where: { id },
    });

    return { success: true, message: 'Treatment deleted successfully' };
  }

  // ─── Diagnostics ─────────────────────────────────────────

  async findAllDiagnostics(
    tenantId: string,
    actor: AuthenticatedUser,
    branchIdFilter?: string,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    let branchCondition: any = undefined;

    if (!isTenantAdminUser) {
      const clinicBranchId = await this.resolveClinicBranch(actor, tenantId);
      if (clinicBranchId) {
        branchCondition = clinicBranchId;
      }
    } else if (branchIdFilter && branchIdFilter !== 'ALL' && branchIdFilter !== 'all') {
      branchCondition = branchIdFilter;
    }

    return this.prisma.clinicOdontogramDiagnostic.findMany({
      where: {
        tenantId,
        ...(branchCondition
          ? { branchId: branchCondition }
          : {
              OR: [
                { branchId: null },
                { branch: { moduleKey: 'CLINIC' } },
              ],
            }),
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createDiagnostic(
    tenantId: string,
    actor: AuthenticatedUser,
    dto: CreateOdontogramDiagnosticDto,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (isTenantAdminUser && !actor.isSuperAdmin) {
      throw new ForbiddenException(
        'Tenant Administrators do not have permission to create diagnostics. Creation is reserved for Clinic Administrators.',
      );
    }
    let finalBranchId: string | null = null;

    if (!isTenantAdminUser) {
      finalBranchId = await this.resolveClinicBranch(actor, tenantId);
      if (!finalBranchId) {
        throw new BadRequestException('Branch context is required for Clinic Admin.');
      }
    } else {
      if (dto.branchId && dto.branchId !== 'ALL' && dto.branchId !== 'all') {
        finalBranchId = dto.branchId;
      } else {
        const firstClinicBranch = await this.prisma.branch.findFirst({
          where: { tenantId, moduleKey: 'CLINIC', status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
        });
        finalBranchId = firstClinicBranch?.id || null;
      }
    }

    if (!finalBranchId) {
      throw new BadRequestException('A valid clinic branch is required to create a branch-scoped diagnostic.');
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: finalBranchId, tenantId, moduleKey: 'CLINIC' },
    });
    if (!branch) {
      throw new NotFoundException(`Clinic branch with ID "${finalBranchId}" does not exist in your organization.`);
    }

    const existing = await this.prisma.clinicOdontogramDiagnostic.findFirst({
      where: {
        tenantId,
        branchId: finalBranchId,
        name: { equals: dto.name.trim(), mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(`A diagnostic entry named "${dto.name}" already exists for this clinic branch.`);
    }

    return this.prisma.clinicOdontogramDiagnostic.create({
      data: {
        tenantId,
        branchId: finalBranchId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        color: dto.color,
        appliesToWholeTooth: dto.appliesToWholeTooth ?? false,
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async updateDiagnostic(
    id: string,
    tenantId: string,
    actor: AuthenticatedUser,
    dto: UpdateOdontogramDiagnosticDto,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (isTenantAdminUser && !actor.isSuperAdmin) {
      throw new ForbiddenException(
        'Tenant Administrators do not have permission to update diagnostics. Updates are reserved for Clinic Administrators.',
      );
    }

    const diagnostic = await this.prisma.clinicOdontogramDiagnostic.findFirst({
      where: { id, tenantId },
    });

    if (!diagnostic) {
      throw new NotFoundException(`Diagnostic with ID "${id}" was not found.`);
    }

    if (!isTenantAdminUser) {
      const clinicBranchId = await this.resolveClinicBranch(actor, tenantId);
      if (diagnostic.branchId !== clinicBranchId) {
        throw new ForbiddenException('You do not have permission to modify a diagnostic outside your assigned branch.');
      }
    }

    if (dto.name && dto.name.trim() !== diagnostic.name) {
      const duplicate = await this.prisma.clinicOdontogramDiagnostic.findFirst({
        where: {
          tenantId,
          branchId: diagnostic.branchId,
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new ConflictException(`A diagnostic entry named "${dto.name}" already exists for this clinic branch.`);
      }
    }

    return this.prisma.clinicOdontogramDiagnostic.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.appliesToWholeTooth !== undefined && { appliesToWholeTooth: dto.appliesToWholeTooth }),
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async removeDiagnostic(
    id: string,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (!isTenantAdminUser) {
      throw new ForbiddenException('Only Tenant Administrators or Super Admins can delete odontogram diagnostics.');
    }

    const diagnostic = await this.prisma.clinicOdontogramDiagnostic.findFirst({
      where: { id, tenantId },
    });

    if (!diagnostic) {
      throw new NotFoundException(`Diagnostic with ID "${id}" was not found.`);
    }

    await this.prisma.clinicOdontogramDiagnostic.delete({
      where: { id },
    });

    return { success: true, message: 'Diagnostic deleted successfully' };
  }

  // ─── Patient Odontogram Operations ──────────────────────

  /**
   * Helper to verify patient access and fetch patient record
   */
  async getVerifiedPatient(tenantId: string, patientId: string, actor: AuthenticatedUser) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID "${patientId}" was not found.`);
    }

    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (!isTenantAdminUser) {
      const userBranchId = await this.resolveClinicBranch(actor, tenantId);
      if (userBranchId && patient.branchId && patient.branchId !== userBranchId) {
        throw new ForbiddenException('You do not have permission to view or manage patients outside your assigned branch.');
      }
    }

    return patient;
  }

  /**
   * Get or initialize a patient's odontogram with all active diagnostics and treatments
   */
  async getPatientOdontogram(
    tenantId: string,
    patientId: string,
    actor: AuthenticatedUser,
  ) {
    const patient = await this.getVerifiedPatient(tenantId, patientId, actor);

    // Get active config to know default model
    const config = await this.getConfig(tenantId, actor, patient.branchId || undefined);

    let odontogram = await this.prisma.patientOdontogram.findUnique({
      where: { patientId },
      include: {
        diagnostics: {
          include: {
            diagnostic: true,
            diagnosedBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        treatments: {
          include: {
            treatment: true,
            createdBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!odontogram) {
      odontogram = await this.prisma.patientOdontogram.create({
        data: {
          tenantId,
          patientId,
          branchId: patient.branchId,
          teethModel: config.defaultTeethModel || TeethModel.ADULT,
        },
        include: {
          diagnostics: {
            include: {
              diagnostic: true,
              diagnosedBy: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          treatments: {
            include: {
              treatment: true,
              createdBy: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      });
    }

    const proposedPlan = (odontogram as any).proposedPlan || null;

    const linkedAppointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        patientId,
        patientOdontogramId: odontogram.id,
      },
      include: {
        doctor: {
          select: { id: true, name: true, email: true, colorCode: true },
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

    return {
      patient,
      odontogram: {
        ...odontogram,
        proposedPlan,
      },
      diagnostics: odontogram.diagnostics || [],
      treatments: odontogram.treatments || [],
      config,
      linkedAppointments,
    };
  }

  /**
   * Append a single audit log entry for a patient's treatment plan
   */
  async logTreatmentPlanAudit(params: {
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
      return await this.prisma.treatmentPlanAudit.create({
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
      this.logger.error(`Failed to write treatment plan audit: ${err.message}`);
      return null;
    }
  }

  /**
   * Build human-readable lookup maps for doctors & clinic services used in audit diffs
   */
  private async resolvePlanAuditLookups(tenantId: string, groups: any[]) {
    const doctorIds = new Set<string>();
    const serviceIds = new Set<string>();

    for (const g of groups) {
      for (const it of Array.isArray(g?.items) ? g.items : []) {
        if (it?.doctorId) doctorIds.add(it.doctorId);
        if (it?.serviceId) serviceIds.add(it.serviceId);
      }
    }

    const [docs, srvs] = await Promise.all([
      doctorIds.size > 0
        ? this.prisma.user.findMany({
            where: { id: { in: Array.from(doctorIds) } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      serviceIds.size > 0
        ? this.prisma.service.findMany({
            where: { id: { in: Array.from(serviceIds) }, tenantId },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    return {
      doctorNameMap: new Map(docs.map((d) => [d.id, d.name])),
      serviceNameMap: new Map(srvs.map((s) => [s.id, s.name])),
    };
  }

  /**
   * Strip UI-only flags like isSelected when comparing treatment plan items
   */
  private normalizePlanItemForDiff(it: any) {
    return {
      id: String(it?.id || ''),
      treatmentName: String(it?.treatmentName || '').trim(),
      otTeethNumber: String(it?.otTeethNumber || '').trim(),
      doctorId: String(it?.doctorId || ''),
      serviceId: String(it?.serviceId || ''),
      quantity: Number(it?.quantity || 1),
      unitPrice: Number(it?.unitPrice || 0),
      subtotal: Number(it?.subtotal || 0),
    };
  }

  /**
   * Save proposed treatment plan (visits, groups, doctors, services, prices, notes)
   * Enforces locking on groups/items with active appointments and logs granular audit trails.
   */
  async saveProposedTreatmentPlan(
    tenantId: string,
    patientId: string,
    actor: AuthenticatedUser,
    proposedPlan: any,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (isTenantAdminUser && !actor.isSuperAdmin) {
      throw new ForbiddenException(
        'Tenant Administrators do not have permission to edit or save clinical treatment plans.',
      );
    }

    const patient = await this.getVerifiedPatient(tenantId, patientId, actor);
    let odontogram = await this.prisma.patientOdontogram.findUnique({
      where: { patientId },
    });
    if (!odontogram) {
      const config = await this.getConfig(tenantId, actor, patient.branchId || undefined);
      odontogram = await this.prisma.patientOdontogram.create({
        data: {
          tenantId,
          patientId,
          branchId: patient.branchId,
          teethModel: config.defaultTeethModel || TeethModel.ADULT,
        },
      });
    }

    const previousPlan = (odontogram as any).proposedPlan || {};
    const prevGroups: any[] = Array.isArray(previousPlan?.groups) ? previousPlan.groups : [];
    const nextGroups: any[] = Array.isArray(proposedPlan?.groups) ? proposedPlan.groups : [];

    // Enforce server-side immutability for groups and items with active appointments
    const activeAppointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        patientOdontogramId: odontogram.id,
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        appointmentNumber: true,
        treatmentPlanGroupId: true,
        treatmentPlanItemIds: true,
      },
    });

    const activeGroupIds = new Set<string>();
    const activeItemIdsByGroup = new Map<string, Set<string>>();

    for (const apt of activeAppointments) {
      if (!apt.treatmentPlanGroupId) continue;
      activeGroupIds.add(apt.treatmentPlanGroupId);
      if (!activeItemIdsByGroup.has(apt.treatmentPlanGroupId)) {
        activeItemIdsByGroup.set(apt.treatmentPlanGroupId, new Set<string>());
      }
      const itemIds = Array.isArray(apt.treatmentPlanItemIds) ? (apt.treatmentPlanItemIds as string[]) : [];
      for (const itemId of itemIds) {
        if (itemId) activeItemIdsByGroup.get(apt.treatmentPlanGroupId)!.add(String(itemId));
      }
    }

    const prevGroupMap = new Map(prevGroups.map((g) => [g.id, g]));
    const nextGroupMap = new Map(nextGroups.map((g) => [g.id, g]));

    for (const lockedGroupId of activeGroupIds) {
      const prevG = prevGroupMap.get(lockedGroupId);
      const nextG = nextGroupMap.get(lockedGroupId);

      if (prevG && !nextG) {
        throw new BadRequestException(
          `Treatment plan "${prevG.name || lockedGroupId}" cannot be deleted because an appointment has already been created for it.`,
        );
      }

      if (prevG && nextG) {
        const prevItems: any[] = Array.isArray(prevG.items) ? prevG.items : [];
        const nextItems: any[] = Array.isArray(nextG.items) ? nextG.items : [];
        const prevItemIds = new Set(prevItems.map((it) => String(it.id)));
        const nextItemMap = new Map(nextItems.map((it) => [String(it.id), it]));

        const addedItem = nextItems.find((it) => !prevItemIds.has(String(it.id)));
        if (addedItem) {
          throw new BadRequestException(
            `Cannot add new services to "${prevG.name || lockedGroupId}" after an appointment has been created.`,
          );
        }

        const lockedItemIds = activeItemIdsByGroup.get(lockedGroupId) || new Set<string>();
        for (const lockedItemId of lockedItemIds) {
          const prevItem = prevItems.find((it) => String(it.id) === lockedItemId);
          const nextItem = nextItemMap.get(lockedItemId);
          if (prevItem && !nextItem) {
            throw new BadRequestException(
              `Cannot delete service "${prevItem.treatmentName || lockedItemId}" because an appointment has been created for it.`,
            );
          }
          if (prevItem && nextItem) {
            const pNorm = this.normalizePlanItemForDiff(prevItem);
            const nNorm = this.normalizePlanItemForDiff(nextItem);
            if (
              pNorm.treatmentName !== nNorm.treatmentName ||
              pNorm.otTeethNumber !== nNorm.otTeethNumber ||
              pNorm.doctorId !== nNorm.doctorId ||
              pNorm.serviceId !== nNorm.serviceId ||
              pNorm.quantity !== nNorm.quantity ||
              pNorm.unitPrice !== nNorm.unitPrice
            ) {
              throw new BadRequestException(
                `Cannot modify service "${prevItem.treatmentName || lockedItemId}" after an appointment has been created for it.`,
              );
            }
          }
        }
      }
    }

    const { doctorNameMap, serviceNameMap } = await this.resolvePlanAuditLookups(tenantId, [
      ...prevGroups,
      ...nextGroups,
    ]);

    const auditPayloads: Array<Parameters<ClinicOdontogramService['logTreatmentPlanAudit']>[0]> = [];

    // 1. Detect deleted plans
    for (const prevG of prevGroups) {
      if (!nextGroupMap.has(prevG.id)) {
        auditPayloads.push({
          tenantId,
          branchId: patient.branchId,
          patientId,
          odontogramId: odontogram.id,
          treatmentPlanGroupId: prevG.id,
          treatmentPlanName: prevG.name || 'Treatment Plan',
          userId: actor.id,
          action: 'PLAN_DELETED',
          resourceType: 'TREATMENT_PLAN',
          resourceId: prevG.id,
          oldValues: {
            name: prevG.name,
            status: prevG.status || 'CREATED',
            servicesCount: Array.isArray(prevG.items) ? prevG.items.length : 0,
          },
          description: `Deleted treatment plan "${prevG.name || prevG.id}"`,
        });
      }
    }

    // 2. Detect created or modified plans
    for (const nextG of nextGroups) {
      const prevG = prevGroupMap.get(nextG.id);
      const nextItems: any[] = Array.isArray(nextG.items) ? nextG.items : [];

      if (!prevG) {
        auditPayloads.push({
          tenantId,
          branchId: patient.branchId,
          patientId,
          odontogramId: odontogram.id,
          treatmentPlanGroupId: nextG.id,
          treatmentPlanName: nextG.name || 'Treatment Plan',
          userId: actor.id,
          action: 'PLAN_CREATED',
          resourceType: 'TREATMENT_PLAN',
          resourceId: nextG.id,
          newValues: {
            name: nextG.name,
            status: nextG.status || 'CREATED',
            servicesCount: nextItems.length,
          },
          description: `Created treatment plan "${nextG.name || nextG.id}" (${nextItems.length} services)`,
        });

        for (const it of nextItems) {
          const norm = this.normalizePlanItemForDiff(it);
          auditPayloads.push({
            tenantId,
            branchId: patient.branchId,
            patientId,
            odontogramId: odontogram.id,
            treatmentPlanGroupId: nextG.id,
            treatmentPlanName: nextG.name || 'Treatment Plan',
            userId: actor.id,
            action: 'SERVICE_ADDED',
            resourceType: 'TREATMENT_PLAN_SERVICE',
            resourceId: norm.id,
            newValues: {
              treatmentName: norm.treatmentName || null,
              tooth: norm.otTeethNumber || null,
              doctorName: norm.doctorId ? doctorNameMap.get(norm.doctorId) || norm.doctorId : null,
              serviceName: norm.serviceId ? serviceNameMap.get(norm.serviceId) || norm.serviceId : null,
              quantity: norm.quantity,
              unitPrice: norm.unitPrice,
            },
            description: `Added service "${norm.treatmentName || serviceNameMap.get(norm.serviceId) || 'Service'}" to "${nextG.name || nextG.id}"`,
          });
        }
        continue;
      }

      // Existing group diff
      if ((prevG.name || '').trim() !== (nextG.name || '').trim()) {
        auditPayloads.push({
          tenantId,
          branchId: patient.branchId,
          patientId,
          odontogramId: odontogram.id,
          treatmentPlanGroupId: nextG.id,
          treatmentPlanName: nextG.name || prevG.name,
          userId: actor.id,
          action: 'PLAN_RENAMED',
          resourceType: 'TREATMENT_PLAN',
          resourceId: nextG.id,
          oldValues: { name: prevG.name },
          newValues: { name: nextG.name },
          description: `Renamed treatment plan from "${prevG.name}" to "${nextG.name}"`,
        });
      }

      const prevStatus = prevG.status || (prevG.confirmed ? 'ACCEPTED' : 'CREATED');
      const nextStatus = nextG.status || (nextG.confirmed ? 'ACCEPTED' : 'CREATED');
      if (prevStatus !== nextStatus) {
        auditPayloads.push({
          tenantId,
          branchId: patient.branchId,
          patientId,
          odontogramId: odontogram.id,
          treatmentPlanGroupId: nextG.id,
          treatmentPlanName: nextG.name || prevG.name,
          userId: actor.id,
          action: 'STATUS_CHANGED',
          resourceType: 'TREATMENT_PLAN',
          resourceId: nextG.id,
          oldValues: { status: prevStatus },
          newValues: { status: nextStatus },
          description: `Status updated from ${prevStatus} to ${nextStatus}`,
        });
      }

      const prevItems: any[] = Array.isArray(prevG.items) ? prevG.items : [];
      const prevItemMap = new Map(prevItems.map((it) => [String(it.id), it]));
      const nextItemMap = new Map(nextItems.map((it) => [String(it.id), it]));

      for (const prevIt of prevItems) {
        if (!nextItemMap.has(String(prevIt.id))) {
          const pNorm = this.normalizePlanItemForDiff(prevIt);
          auditPayloads.push({
            tenantId,
            branchId: patient.branchId,
            patientId,
            odontogramId: odontogram.id,
            treatmentPlanGroupId: nextG.id,
            treatmentPlanName: nextG.name || prevG.name,
            userId: actor.id,
            action: 'SERVICE_REMOVED',
            resourceType: 'TREATMENT_PLAN_SERVICE',
            resourceId: pNorm.id,
            oldValues: {
              treatmentName: pNorm.treatmentName || null,
              tooth: pNorm.otTeethNumber || null,
              doctorName: pNorm.doctorId ? doctorNameMap.get(pNorm.doctorId) || pNorm.doctorId : null,
              serviceName: pNorm.serviceId ? serviceNameMap.get(pNorm.serviceId) || pNorm.serviceId : null,
              quantity: pNorm.quantity,
              unitPrice: pNorm.unitPrice,
            },
            description: `Removed service "${pNorm.treatmentName || serviceNameMap.get(pNorm.serviceId) || 'Service'}"`,
          });
        }
      }

      for (const nextIt of nextItems) {
        const prevIt = prevItemMap.get(String(nextIt.id));
        const nNorm = this.normalizePlanItemForDiff(nextIt);

        if (!prevIt) {
          auditPayloads.push({
            tenantId,
            branchId: patient.branchId,
            patientId,
            odontogramId: odontogram.id,
            treatmentPlanGroupId: nextG.id,
            treatmentPlanName: nextG.name || prevG.name,
            userId: actor.id,
            action: 'SERVICE_ADDED',
            resourceType: 'TREATMENT_PLAN_SERVICE',
            resourceId: nNorm.id,
            newValues: {
              treatmentName: nNorm.treatmentName || null,
              tooth: nNorm.otTeethNumber || null,
              doctorName: nNorm.doctorId ? doctorNameMap.get(nNorm.doctorId) || nNorm.doctorId : null,
              serviceName: nNorm.serviceId ? serviceNameMap.get(nNorm.serviceId) || nNorm.serviceId : null,
              quantity: nNorm.quantity,
              unitPrice: nNorm.unitPrice,
            },
            description: `Added service "${nNorm.treatmentName || serviceNameMap.get(nNorm.serviceId) || 'Service'}"`,
          });
        } else {
          const pNorm = this.normalizePlanItemForDiff(prevIt);
          const oldDiff: Record<string, any> = {};
          const newDiff: Record<string, any> = {};

          if (pNorm.treatmentName !== nNorm.treatmentName) {
            oldDiff.treatmentName = pNorm.treatmentName;
            newDiff.treatmentName = nNorm.treatmentName;
          }
          if (pNorm.otTeethNumber !== nNorm.otTeethNumber) {
            oldDiff.tooth = pNorm.otTeethNumber;
            newDiff.tooth = nNorm.otTeethNumber;
          }
          if (pNorm.doctorId !== nNorm.doctorId) {
            oldDiff.doctorName = pNorm.doctorId ? doctorNameMap.get(pNorm.doctorId) || pNorm.doctorId : null;
            newDiff.doctorName = nNorm.doctorId ? doctorNameMap.get(nNorm.doctorId) || nNorm.doctorId : null;
          }
          if (pNorm.serviceId !== nNorm.serviceId) {
            oldDiff.serviceName = pNorm.serviceId ? serviceNameMap.get(pNorm.serviceId) || pNorm.serviceId : null;
            newDiff.serviceName = nNorm.serviceId ? serviceNameMap.get(nNorm.serviceId) || nNorm.serviceId : null;
          }
          if (pNorm.quantity !== nNorm.quantity) {
            oldDiff.quantity = pNorm.quantity;
            newDiff.quantity = nNorm.quantity;
          }
          if (pNorm.unitPrice !== nNorm.unitPrice) {
            oldDiff.unitPrice = pNorm.unitPrice;
            newDiff.unitPrice = nNorm.unitPrice;
          }

          if (Object.keys(newDiff).length > 0) {
            auditPayloads.push({
              tenantId,
              branchId: patient.branchId,
              patientId,
              odontogramId: odontogram.id,
              treatmentPlanGroupId: nextG.id,
              treatmentPlanName: nextG.name || prevG.name,
              userId: actor.id,
              action: 'SERVICE_UPDATED',
              resourceType: 'TREATMENT_PLAN_SERVICE',
              resourceId: nNorm.id,
              oldValues: oldDiff,
              newValues: newDiff,
              description: `Updated service "${nNorm.treatmentName || pNorm.treatmentName || 'Service'}"`,
            });
          }
        }
      }
    }

    await this.prisma.patientOdontogram.update({
      where: { id: odontogram.id },
      data: {
        proposedPlan: (proposedPlan || {}) as any,
      },
    });

    for (const payload of auditPayloads) {
      await this.logTreatmentPlanAudit(payload);
    }

    this.notificationsGateway.sendToTenant(tenantId, 'treatment_plan:updated', {
      patientId,
    });

    return { success: true, proposedPlan };
  }

  /**
   * Instantly update a treatment plan group's status and persist audit record
   */
  async updateProposedPlanGroupStatus(
    tenantId: string,
    patientId: string,
    groupId: string,
    actor: AuthenticatedUser,
    dto: UpdateTreatmentPlanStatusDto,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (isTenantAdminUser && !actor.isSuperAdmin) {
      throw new ForbiddenException(
        'Tenant Administrators do not have permission to update clinical treatment plan statuses.',
      );
    }

    const patient = await this.getVerifiedPatient(tenantId, patientId, actor);
    let odontogram = await this.prisma.patientOdontogram.findUnique({
      where: { patientId },
    });

    if (!odontogram) {
      const config = await this.getConfig(tenantId, actor, patient.branchId || undefined);
      odontogram = await this.prisma.patientOdontogram.create({
        data: {
          tenantId,
          patientId,
          branchId: patient.branchId,
          teethModel: config.defaultTeethModel || TeethModel.ADULT,
        },
      });
    }

    const currentPlan: any = (odontogram as any).proposedPlan || { groups: [], grandTotal: 0 };
    const groups: any[] = Array.isArray(currentPlan.groups) ? [...currentPlan.groups] : [];
    const idx = groups.findIndex((g) => g.id === groupId);

    const isConfirmedStatus = ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(dto.status);
    let oldStatus = 'CREATED';
    let updatedGroup: any;
    let isNewGroup = false;

    if (idx === -1) {
      isNewGroup = true;
      const items = Array.isArray(dto.items) ? dto.items : [];
      updatedGroup = {
        id: groupId,
        name: dto.planName || 'Plan 1',
        status: dto.status,
        confirmed: isConfirmedStatus,
        items,
      };
      groups.push(updatedGroup);
    } else {
      oldStatus = groups[idx].status || (groups[idx].confirmed ? 'ACCEPTED' : 'CREATED');
      updatedGroup = {
        ...groups[idx],
        status: dto.status,
        confirmed: isConfirmedStatus,
      };
      groups[idx] = updatedGroup;
    }

    const grandTotal = groups.reduce(
      (gSum, g) =>
        gSum +
        (Array.isArray(g.items)
          ? g.items.reduce((iSum: number, it: any) => iSum + Number(it?.subtotal || 0), 0)
          : 0),
      0,
    );

    const nextPlan = {
      ...currentPlan,
      groups,
      grandTotal,
    };

    await this.prisma.patientOdontogram.update({
      where: { id: odontogram.id },
      data: { proposedPlan: nextPlan as any },
    });

    if (isNewGroup) {
      await this.logTreatmentPlanAudit({
        tenantId,
        branchId: patient.branchId,
        patientId,
        odontogramId: odontogram.id,
        treatmentPlanGroupId: groupId,
        treatmentPlanName: updatedGroup.name,
        userId: actor.id,
        action: 'PLAN_CREATED',
        resourceType: 'TREATMENT_PLAN',
        resourceId: groupId,
        newValues: {
          name: updatedGroup.name,
          status: dto.status,
          servicesCount: Array.isArray(updatedGroup.items) ? updatedGroup.items.length : 0,
        },
        description: `Created treatment plan "${updatedGroup.name}"`,
      });
    }

    if (oldStatus !== dto.status) {
      await this.logTreatmentPlanAudit({
        tenantId,
        branchId: patient.branchId,
        patientId,
        odontogramId: odontogram.id,
        treatmentPlanGroupId: groupId,
        treatmentPlanName: updatedGroup.name,
        userId: actor.id,
        action: 'STATUS_CHANGED',
        resourceType: 'TREATMENT_PLAN',
        resourceId: groupId,
        oldValues: { status: oldStatus },
        newValues: { status: dto.status },
        description: `Status changed from ${oldStatus} to ${dto.status}`,
      });
    }

    this.notificationsGateway.sendToTenant(tenantId, 'treatment_plan:updated', {
      patientId,
      groupId,
      status: dto.status,
    });

    return {
      success: true,
      group: updatedGroup,
      proposedPlan: nextPlan,
    };
  }

  /**
   * Get paginated treatment plan audit history for a patient (optionally scoped to one plan)
   */
  async getProposedPlanAuditHistory(
    tenantId: string,
    patientId: string,
    actor: AuthenticatedUser,
    query: QueryTreatmentPlanAuditDto,
  ) {
    await this.getVerifiedPatient(tenantId, patientId, actor);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.TreatmentPlanAuditWhereInput = {
      tenantId,
      patientId,
    };

    if (query.groupId && query.groupId !== 'ALL') {
      where.treatmentPlanGroupId = query.groupId;
    }

    if (query.action && query.action !== 'ALL') {
      if (query.action.includes(',')) {
        where.action = { in: query.action.split(',').map((s) => s.trim()).filter(Boolean) };
      } else {
        where.action = query.action;
      }
    }

    const [total, audits, odontogram, distinctPlanRows] = await Promise.all([
      this.prisma.treatmentPlanAudit.count({ where }),
      this.prisma.treatmentPlanAudit.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.patientOdontogram.findUnique({
        where: { patientId },
        select: { proposedPlan: true },
      }),
      this.prisma.treatmentPlanAudit.findMany({
        where: { tenantId, patientId },
        distinct: ['treatmentPlanGroupId'],
        select: {
          treatmentPlanGroupId: true,
          treatmentPlanName: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const planMap = new Map<string, string>();
    const currentGroups = Array.isArray((odontogram?.proposedPlan as any)?.groups)
      ? (odontogram!.proposedPlan as any).groups
      : [];
    for (const g of currentGroups) {
      if (g?.id) planMap.set(g.id, g.name || g.id);
    }
    for (const row of distinctPlanRows) {
      if (row.treatmentPlanGroupId && !planMap.has(row.treatmentPlanGroupId)) {
        planMap.set(row.treatmentPlanGroupId, row.treatmentPlanName || row.treatmentPlanGroupId);
      }
    }

    const availablePlans = Array.from(planMap.entries()).map(([groupId, name]) => ({
      groupId,
      name,
    }));

    return {
      audits,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      availablePlans,
    };
  }

  /**
   * Update patient odontogram header (teethModel, general notes)
   */
  async updatePatientOdontogram(
    tenantId: string,
    patientId: string,
    actor: AuthenticatedUser,
    dto: UpdatePatientOdontogramDto,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (isTenantAdminUser && !actor.isSuperAdmin) {
      throw new ForbiddenException(
        'Tenant Administrators do not have permission to edit patient odontograms.',
      );
    }

    await this.getVerifiedPatient(tenantId, patientId, actor);

    let odontogram = await this.prisma.patientOdontogram.findUnique({
      where: { patientId },
    });

    if (!odontogram) {
      odontogram = await this.prisma.patientOdontogram.create({
        data: {
          tenantId,
          patientId,
          teethModel: dto.teethModel || TeethModel.ADULT,
          notes: dto.notes,
        },
      });
      return odontogram;
    }

    return this.prisma.patientOdontogram.update({
      where: { id: odontogram.id },
      data: {
        ...(dto.teethModel && { teethModel: dto.teethModel }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  /**
   * Add a diagnostic finding to patient's tooth / surface
   */
  async addPatientDiagnostic(
    tenantId: string,
    patientId: string,
    actor: AuthenticatedUser,
    dto: AddPatientDiagnosticDto,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (isTenantAdminUser && !actor.isSuperAdmin) {
      throw new ForbiddenException(
        'Tenant Administrators do not have permission to add diagnostic findings.',
      );
    }

    const patient = await this.getVerifiedPatient(tenantId, patientId, actor);

    let odontogram = await this.prisma.patientOdontogram.findUnique({
      where: { patientId },
    });

    if (!odontogram) {
      const config = await this.getConfig(tenantId, actor, patient.branchId || undefined);
      odontogram = await this.prisma.patientOdontogram.create({
        data: {
          tenantId,
          patientId,
          branchId: patient.branchId,
          teethModel: config.defaultTeethModel || TeethModel.ADULT,
        },
      });
    }

    let diagColor = dto.color || '#EF4444';
    let diagName = dto.diagnosticName.trim();

    if (dto.diagnosticId) {
      const catalogDiag = await this.prisma.clinicOdontogramDiagnostic.findFirst({
        where: { id: dto.diagnosticId, tenantId },
      });
      if (catalogDiag) {
        if (!dto.color) diagColor = catalogDiag.color;
        if (!dto.diagnosticName) diagName = catalogDiag.name;
      }
    }

    return this.prisma.patientOdontogramDiagnostic.create({
      data: {
        tenantId,
        odontogramId: odontogram.id,
        patientId,
        branchId: patient.branchId,
        toothNumber: dto.toothNumber,
        surface: dto.surface || 'WHOLE',
        diagnosticId: dto.diagnosticId || null,
        diagnosticName: diagName,
        color: diagColor,
        notes: dto.notes?.trim() || null,
        diagnosedById: actor.id,
      },
      include: {
        diagnostic: true,
        diagnosedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  /**
   * Update a patient diagnostic finding
   */
  async updatePatientDiagnostic(
    tenantId: string,
    patientId: string,
    diagnosticId: string,
    actor: AuthenticatedUser,
    dto: UpdatePatientDiagnosticDto,
  ) {
    await this.getVerifiedPatient(tenantId, patientId, actor);

    const existing = await this.prisma.patientOdontogramDiagnostic.findFirst({
      where: { id: diagnosticId, tenantId, patientId },
    });

    if (!existing) {
      throw new NotFoundException(`Diagnostic record with ID "${diagnosticId}" was not found.`);
    }

    return this.prisma.patientOdontogramDiagnostic.update({
      where: { id: diagnosticId },
      data: {
        ...(dto.surface !== undefined && { surface: dto.surface }),
        ...(dto.diagnosticName !== undefined && { diagnosticName: dto.diagnosticName.trim() }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
      },
      include: {
        diagnostic: true,
        diagnosedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  /**
   * Delete a patient diagnostic finding
   */
  async removePatientDiagnostic(
    tenantId: string,
    patientId: string,
    diagnosticId: string,
    actor: AuthenticatedUser,
  ) {
    await this.getVerifiedPatient(tenantId, patientId, actor);

    const existing = await this.prisma.patientOdontogramDiagnostic.findFirst({
      where: { id: diagnosticId, tenantId, patientId },
    });

    if (!existing) {
      throw new NotFoundException(`Diagnostic record with ID "${diagnosticId}" was not found.`);
    }

    await this.prisma.patientOdontogramDiagnostic.delete({
      where: { id: diagnosticId },
    });

    return { success: true, message: 'Patient diagnostic finding deleted successfully' };
  }

  /**
   * Add a treatment plan item to patient's tooth / surface
   */
  async addPatientTreatment(
    tenantId: string,
    patientId: string,
    actor: AuthenticatedUser,
    dto: AddPatientTreatmentDto,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    if (isTenantAdminUser && !actor.isSuperAdmin) {
      throw new ForbiddenException(
        'Tenant Administrators do not have permission to add applied treatments.',
      );
    }

    const patient = await this.getVerifiedPatient(tenantId, patientId, actor);

    let odontogram = await this.prisma.patientOdontogram.findUnique({
      where: { patientId },
    });

    if (!odontogram) {
      const config = await this.getConfig(tenantId, actor, patient.branchId || undefined);
      odontogram = await this.prisma.patientOdontogram.create({
        data: {
          tenantId,
          patientId,
          branchId: patient.branchId,
          teethModel: config.defaultTeethModel || TeethModel.ADULT,
        },
      });
    }

    let treatColor = dto.color || '#3B82F6';
    let treatName = dto.treatmentName.trim();

    if (dto.treatmentId) {
      const catalogTreatment = await this.prisma.clinicOdontogramTreatment.findFirst({
        where: { id: dto.treatmentId, tenantId },
      });
      if (catalogTreatment) {
        if (!dto.color) treatColor = catalogTreatment.color;
        if (!dto.treatmentName) treatName = catalogTreatment.name;
      }
    }

    return this.prisma.patientOdontogramTreatment.create({
      data: {
        tenantId,
        odontogramId: odontogram.id,
        patientId,
        branchId: patient.branchId,
        toothNumber: dto.toothNumber,
        surface: dto.surface || 'WHOLE',
        treatmentId: dto.treatmentId || null,
        treatmentName: treatName,
        color: treatColor,
        status: dto.status || OdontogramTreatmentStatus.PLANNED,
        cost: dto.cost !== undefined ? dto.cost : null,
        notes: dto.notes?.trim() || null,
        plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : null,
        completedDate: dto.status === OdontogramTreatmentStatus.COMPLETED ? new Date() : null,
        createdById: actor.id,
      },
      include: {
        treatment: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  /**
   * Normalize a treatment name for case-insensitive matching between Odontogram and Treatment Plan items.
   */
  private normalizeTreatmentName(name?: string | null): string {
    return String(name || '')
      .replace(/\s*\([#\d\s,]+\)/g, '')
      .replace(/#\d+/g, '')
      .trim()
      .toLowerCase();
  }

  /**
   * Extract all valid FDI tooth numbers referenced by a proposed treatment plan item.
   */
  private extractToothNumbersFromPlanItem(item: any): number[] {
    const nums = new Set<number>();
    if (Array.isArray(item?.toothNumbers)) {
      for (const n of item.toothNumbers) {
        const parsed = Number(n);
        if (Number.isInteger(parsed) && parsed > 0) nums.add(parsed);
      }
    }
    if (item?.otTeethNumber) {
      const tokens = String(item.otTeethNumber).split(/[\s,;]+/);
      for (const token of tokens) {
        const cleaned = token.replace(/#/g, '').trim();
        if (!cleaned) continue;
        const parsed = Number(cleaned);
        if (Number.isInteger(parsed) && parsed > 0) nums.add(parsed);
      }
    }
    return Array.from(nums);
  }

  /**
   * Build a lookup map of `${normalizedTreatmentName}__${toothNumber}` -> linked Treatment Plan groups.
   */
  private getLinkedPlanTreatmentsMap(
    proposedPlan: any,
  ): Map<string, Array<{ groupId: string; groupName: string; status: string }>> {
    const linkedMap = new Map<
      string,
      Array<{ groupId: string; groupName: string; status: string }>
    >();
    const groups: any[] = Array.isArray(proposedPlan?.groups) ? proposedPlan.groups : [];

    for (const group of groups) {
      const groupId = String(group?.id || '');
      const groupName = String(group?.name || 'Treatment Plan');
      const status = String(group?.status || (group?.confirmed ? 'ACCEPTED' : 'CREATED'));
      const items: any[] = Array.isArray(group?.items) ? group.items : [];

      for (const item of items) {
        const normalizedName = this.normalizeTreatmentName(item?.treatmentName);
        if (!normalizedName) continue;
        const toothNumbers = this.extractToothNumbersFromPlanItem(item);
        for (const toothNumber of toothNumbers) {
          const key = `${normalizedName}__${toothNumber}`;
          const existingList = linkedMap.get(key) || [];
          if (!existingList.some((entry) => entry.groupId === groupId && entry.groupName === groupName)) {
            existingList.push({ groupId, groupName, status });
          }
          linkedMap.set(key, existingList);
        }
      }
    }

    return linkedMap;
  }

  /**
   * Prevent saving an Odontogram update that drops or replaces any treatment linked to a Treatment Plan.
   */
  private assertLinkedTreatmentsPreserved(
    proposedPlan: any,
    existingTreatments: Array<{ treatmentName: string; toothNumber: number }>,
    incomingTreatments: Array<{ treatmentName: string; toothNumber: number }>,
  ) {
    const linkedMap = this.getLinkedPlanTreatmentsMap(proposedPlan);
    if (linkedMap.size === 0 || existingTreatments.length === 0) return;

    const existingCounts = new Map<
      string,
      { count: number; displayName: string; toothNumber: number }
    >();
    for (const tr of existingTreatments) {
      const key = `${this.normalizeTreatmentName(tr.treatmentName)}__${Number(tr.toothNumber)}`;
      if (!linkedMap.has(key)) continue;
      const current = existingCounts.get(key);
      if (current) {
        current.count += 1;
      } else {
        existingCounts.set(key, {
          count: 1,
          displayName: tr.treatmentName,
          toothNumber: Number(tr.toothNumber),
        });
      }
    }

    if (existingCounts.size === 0) return;

    const incomingCounts = new Map<string, number>();
    for (const tr of incomingTreatments) {
      const key = `${this.normalizeTreatmentName(tr.treatmentName)}__${Number(tr.toothNumber)}`;
      incomingCounts.set(key, (incomingCounts.get(key) || 0) + 1);
    }

    const blockedDescriptions: string[] = [];
    for (const [key, entry] of existingCounts.entries()) {
      const nextCount = incomingCounts.get(key) || 0;
      if (nextCount < entry.count) {
        const plans = (linkedMap.get(key) || []).map((p) => p.groupName).join(', ');
        blockedDescriptions.push(`${entry.displayName} (Tooth #${entry.toothNumber} → ${plans})`);
      }
    }

    if (blockedDescriptions.length > 0) {
      throw new BadRequestException(
        `Cannot remove or replace treatment(s) linked to an existing Treatment Plan: ${blockedDescriptions.join('; ')}. Remove them from the Treatment Plan first.`,
      );
    }
  }

  /**
   * Update a patient treatment plan item
   */
  async updatePatientTreatment(
    tenantId: string,
    patientId: string,
    treatmentId: string,
    actor: AuthenticatedUser,
    dto: UpdatePatientTreatmentDto,
  ) {
    await this.getVerifiedPatient(tenantId, patientId, actor);

    const existing = await this.prisma.patientOdontogramTreatment.findFirst({
      where: { id: treatmentId, tenantId, patientId },
    });

    if (!existing) {
      throw new NotFoundException(`Treatment plan record with ID "${treatmentId}" was not found.`);
    }

    if (
      dto.treatmentName !== undefined &&
      this.normalizeTreatmentName(dto.treatmentName) !==
        this.normalizeTreatmentName(existing.treatmentName)
    ) {
      const odontogram = await this.prisma.patientOdontogram.findUnique({
        where: { id: existing.odontogramId },
        select: { proposedPlan: true },
      });
      const linkedMap = this.getLinkedPlanTreatmentsMap((odontogram as any)?.proposedPlan);
      const key = `${this.normalizeTreatmentName(existing.treatmentName)}__${existing.toothNumber}`;
      const linkedPlans = linkedMap.get(key);
      if (linkedPlans && linkedPlans.length > 0) {
        const planNames = linkedPlans.map((p) => p.groupName).join(', ');
        throw new BadRequestException(
          `Cannot rename treatment "${existing.treatmentName}" (Tooth #${existing.toothNumber}) because it is linked to Treatment Plan "${planNames}".`,
        );
      }
    }

    let completedDate = existing.completedDate;
    if (dto.completedDate) {
      completedDate = new Date(dto.completedDate);
    } else if (
      dto.status === OdontogramTreatmentStatus.COMPLETED &&
      existing.status !== OdontogramTreatmentStatus.COMPLETED
    ) {
      completedDate = new Date();
    } else if (dto.status && dto.status !== OdontogramTreatmentStatus.COMPLETED) {
      completedDate = null;
    }

    return this.prisma.patientOdontogramTreatment.update({
      where: { id: treatmentId },
      data: {
        ...(dto.surface !== undefined && { surface: dto.surface }),
        ...(dto.treatmentName !== undefined && { treatmentName: dto.treatmentName.trim() }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.cost !== undefined && { cost: dto.cost }),
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
        ...(dto.plannedDate !== undefined && {
          plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : null,
        }),
        completedDate,
      },
      include: {
        treatment: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  /**
   * Delete a patient treatment plan item
   */
  async removePatientTreatment(
    tenantId: string,
    patientId: string,
    treatmentId: string,
    actor: AuthenticatedUser,
  ) {
    await this.getVerifiedPatient(tenantId, patientId, actor);

    const existing = await this.prisma.patientOdontogramTreatment.findFirst({
      where: { id: treatmentId, tenantId, patientId },
    });

    if (!existing) {
      throw new NotFoundException(`Treatment plan record with ID "${treatmentId}" was not found.`);
    }

    const odontogram = await this.prisma.patientOdontogram.findUnique({
      where: { id: existing.odontogramId },
      select: { proposedPlan: true },
    });
    const linkedMap = this.getLinkedPlanTreatmentsMap((odontogram as any)?.proposedPlan);
    const key = `${this.normalizeTreatmentName(existing.treatmentName)}__${existing.toothNumber}`;
    const linkedPlans = linkedMap.get(key);
    if (linkedPlans && linkedPlans.length > 0) {
      const planNames = linkedPlans.map((p) => p.groupName).join(', ');
      throw new BadRequestException(
        `Cannot remove treatment "${existing.treatmentName}" (Tooth #${existing.toothNumber}) because it is linked to Treatment Plan "${planNames}". Remove it from the Treatment Plan first.`,
      );
    }

    await this.prisma.patientOdontogramTreatment.delete({
      where: { id: treatmentId },
    });

    return { success: true, message: 'Treatment plan item deleted successfully' };
  }

  /**
   * Save complete patient odontogram state (teethModel, notes, diagnostics, treatments)
   */
  async savePatientOdontogram(
    tenantId: string,
    patientId: string,
    actor: AuthenticatedUser,
    dto: SavePatientOdontogramDto,
  ) {
    const patient = await this.getVerifiedPatient(tenantId, patientId, actor);

    let odontogram = await this.prisma.patientOdontogram.findUnique({
      where: { patientId },
    });

    if (!odontogram) {
      const config = await this.getConfig(tenantId, actor, patient.branchId || undefined);
      odontogram = await this.prisma.patientOdontogram.create({
        data: {
          tenantId,
          patientId,
          branchId: patient.branchId,
          teethModel: dto.teethModel || config.defaultTeethModel || TeethModel.ADULT,
          notes: dto.notes || null,
        },
      });
    } else {
      odontogram = await this.prisma.patientOdontogram.update({
        where: { id: odontogram.id },
        data: {
          ...(dto.teethModel && { teethModel: dto.teethModel }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
      });
    }

    // Validate linked treatments BEFORE modifying diagnostics/treatments so errors leave DB state untouched
    if (dto.treatments !== undefined) {
      const existingTreatments = await this.prisma.patientOdontogramTreatment.findMany({
        where: { odontogramId: odontogram.id, tenantId },
        select: { treatmentName: true, toothNumber: true },
      });
      this.assertLinkedTreatmentsPreserved(
        (odontogram as any).proposedPlan,
        existingTreatments,
        dto.treatments,
      );
    }

    // Atomic update of diagnostics if provided
    if (dto.diagnostics !== undefined) {
      await this.prisma.patientOdontogramDiagnostic.deleteMany({
        where: { odontogramId: odontogram.id, tenantId },
      });

      if (dto.diagnostics.length > 0) {
        await this.prisma.patientOdontogramDiagnostic.createMany({
          data: dto.diagnostics.map((d) => ({
            tenantId,
            odontogramId: odontogram.id,
            patientId,
            branchId: patient.branchId,
            toothNumber: d.toothNumber,
            surface: d.surface || 'WHOLE',
            diagnosticId: d.diagnosticId || null,
            diagnosticName: d.diagnosticName,
            color: d.color || '#EF4444',
            notes: d.notes || null,
            diagnosedById: actor.id,
          })),
        });
      }
    }

    // Atomic update of treatments if provided
    if (dto.treatments !== undefined) {
      await this.prisma.patientOdontogramTreatment.deleteMany({
        where: { odontogramId: odontogram.id, tenantId },
      });

      if (dto.treatments.length > 0) {
        await this.prisma.patientOdontogramTreatment.createMany({
          data: dto.treatments.map((tr) => ({
            tenantId,
            odontogramId: odontogram.id,
            patientId,
            branchId: patient.branchId,
            toothNumber: tr.toothNumber,
            surface: tr.surface || 'WHOLE',
            treatmentId: tr.treatmentId || null,
            treatmentName: tr.treatmentName,
            color: tr.color || '#3B82F6',
            status: tr.status || OdontogramTreatmentStatus.PLANNED,
            cost: tr.cost !== undefined ? tr.cost : null,
            notes: tr.notes || null,
            completedDate: tr.status === OdontogramTreatmentStatus.COMPLETED ? new Date() : null,
            createdById: actor.id,
          })),
        });
      }
    }

    return this.getPatientOdontogram(tenantId, patientId, actor);
  }
}

