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
import { TeethModel } from '@prisma/client';
import {
  UpdateOdontogramConfigDto,
  CreateOdontogramTreatmentDto,
  UpdateOdontogramTreatmentDto,
  CreateOdontogramDiagnosticDto,
  UpdateOdontogramDiagnosticDto,
} from './dto';

@Injectable()
export class ClinicOdontogramService {
  private readonly logger = new Logger(ClinicOdontogramService.name);

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
}

