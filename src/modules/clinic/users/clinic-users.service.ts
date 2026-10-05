import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { AuthService } from '../../../core/auth/auth.service';
import { MailService } from '../../../core/mail/mail.service';
import { CreateClinicAdminDto } from './dto/create-clinic-admin.dto';
import { UpdateClinicAdminDto } from './dto/update-clinic-admin.dto';
import { CreateClinicStaffDto } from './dto/create-clinic-staff.dto';
import { UpdateClinicStaffDto } from './dto/update-clinic-staff.dto';
import { CreateClinicDoctorDto } from './dto/create-clinic-doctor.dto';
import { UpdateClinicDoctorDto } from './dto/update-clinic-doctor.dto';
import { AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ClinicUsersService {
  private readonly logger = new Logger(ClinicUsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly mailService: MailService,
  ) {}

  // ============================================================================
  // AUTHORIZATION & SCOPING HELPERS
  // ============================================================================

  /**
   * Verify whether the authenticated actor is a Tenant Administrator or Platform Super Admin.
   */
  async assertTenantAdmin(actor: AuthenticatedUser, tenantId: string): Promise<void> {
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

    // Direct DB verification fallback
    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        userId_tenantId: {
          userId: actor.id,
          tenantId,
        },
      },
    });

    if (membership?.isOwner) {
      return;
    }

    const userAdminRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: {
          slug: { in: ['tenant-admin', 'admin', 'administrator'] },
        },
      },
    });

    if (!userAdminRole) {
      throw new ForbiddenException(
        'Only Tenant Administrators can manage Clinic Administrators and Branches.',
      );
    }
  }

  /**
   * Verify whether the actor is a Clinic Administrator and return their assigned branch ID.
   */
  async assertClinicAdmin(actor: AuthenticatedUser, tenantId: string): Promise<string> {
    const clinicAdminRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: {
          slug: 'clinic-admin',
        },
      },
      include: {
        branch: true,
      },
    });

    if (clinicAdminRole?.branchId) {
      return clinicAdminRole.branchId;
    }

    // Fallback: check userBranches
    const userBranch = await this.prisma.userBranch.findFirst({
      where: {
        userId: actor.id,
        branch: { tenantId, moduleKey: 'CLINIC' },
      },
    });

    if (userBranch?.branchId) {
      return userBranch.branchId;
    }

    throw new ForbiddenException(
      'Only Clinic Administrators can create and manage Staff and Doctors within their branch.',
    );
  }

  /**
   * Enforce Rule 1: Tenant Admin CANNOT create Staff or Doctor users.
   * Only Clinic Admin can create Staff and Doctors.
   */
  async rejectTenantAdminFromStaffAndDoctor(actor: AuthenticatedUser, tenantId: string): Promise<void> {
    const isTenantAdmin = await this.checkIsTenantAdmin(actor, tenantId);
    const hasClinicAdminRole = actor.roles?.some((r) => {
      const lower = r.toLowerCase();
      return lower === 'clinic-admin' || lower === 'clinic admin';
    });

    if (isTenantAdmin && !hasClinicAdminRole && !actor.isSuperAdmin) {
      throw new ForbiddenException(
        'Tenant Admins cannot create Staff or Doctor users. Staff and Doctors must be created and managed by the Clinic Admin of the branch.',
      );
    }
  }

  private async checkIsTenantAdmin(actor: AuthenticatedUser, tenantId: string): Promise<boolean> {
    if (actor.isSuperAdmin) return true;
    const isOwnerMem = (actor as any).memberships?.some(
      (m: any) => m.tenantId === tenantId && m.isOwner,
    );
    if (isOwnerMem) return true;
    const hasAdminRole = actor.roles?.some((r: string) => {
      const lower = r.toLowerCase();
      return lower === 'tenant-admin' || lower.includes('tenant administrator') || lower.includes('tenant admin');
    });
    if (hasAdminRole) return true;
    const membership = await this.prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId: actor.id, tenantId } },
    });
    return Boolean(membership?.isOwner);
  }

  // ============================================================================
  // SYSTEM ROLES AUTO-PROVISIONING
  // ============================================================================

  async ensureClinicAdminRole() {
    let role = await this.prisma.role.findFirst({
      where: { slug: 'clinic-admin' },
    });

    if (!role) {
      this.logger.log('🌱 Auto-provisioning system role "clinic-admin"...');
      role = await this.prisma.role.create({
        data: {
          name: 'Clinic Admin',
          slug: 'clinic-admin',
          description: 'Administrator for Clinic operations, branch personnel, and clinical workflows',
          moduleKey: 'CLINIC',
          isSystem: true,
          tenantId: null,
        },
      });
    }

    return role;
  }

  async ensureClinicStaffRole() {
    let role = await this.prisma.role.findFirst({
      where: { slug: 'clinic-staff' },
    });

    if (!role) {
      this.logger.log('🌱 Auto-provisioning system role "clinic-staff"...');
      role = await this.prisma.role.create({
        data: {
          name: 'Clinic Staff',
          slug: 'clinic-staff',
          description: 'Clinic staff member (assistant, receptionist, hygienist)',
          moduleKey: 'CLINIC',
          isSystem: true,
          tenantId: null,
        },
      });
    }

    return role;
  }

  async ensureClinicDoctorRole() {
    let role = await this.prisma.role.findFirst({
      where: { slug: 'clinic-doctor' },
    });

    if (!role) {
      this.logger.log('🌱 Auto-provisioning system role "clinic-doctor"...');
      role = await this.prisma.role.create({
        data: {
          name: 'Clinic Doctor',
          slug: 'clinic-doctor',
          description: 'Attending dentist, surgeon, or specialist practitioner',
          moduleKey: 'CLINIC',
          isSystem: true,
          tenantId: null,
        },
      });
    }

    return role;
  }

  // ============================================================================
  // 1. CLINIC ADMIN MANAGEMENT (Rule 1, Rule 3, Rule 4, Rule 5)
  // ============================================================================

  async findAllClinicAdmins(tenantId: string, branchId?: string, search?: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    const whereClause: any = {
      memberships: {
        some: { tenantId },
      },
      moduleAccess: {
        some: { tenantId, moduleKey: 'CLINIC', isActive: true },
      },
      userRoles: {
        some: {
          tenantId,
          role: { slug: 'clinic-admin' },
        },
      },
    };

    if (branchId && branchId !== 'all') {
      whereClause.userBranches = {
        some: { branchId },
      };
    }

    if (search?.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        {
          userBranches: {
            some: {
              branch: {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { code: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ];
    }

    const users = await this.prisma.user.findMany({
      where: whereClause,
      include: {
        userBranches: {
          where: { branch: { tenantId, moduleKey: 'CLINIC' } },
          include: { branch: true },
        },
        userRoles: {
          where: { tenantId },
          include: { role: true },
        },
        memberships: {
          where: { tenantId },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => {
      const primaryUserBranch =
        (branchId && branchId !== 'all'
          ? u.userBranches.find((ub) => ub.branchId === branchId)
          : null) || u.userBranches[0];

      const isDefault = primaryUserBranch?.isDefault || false;

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone,
        status: u.status,
        avatarUrl: u.avatarUrl,
        locale: u.locale,
        createdAt: u.createdAt,
        branch: primaryUserBranch?.branch
          ? {
              id: primaryUserBranch.branch.id,
              name: primaryUserBranch.branch.name,
              code: primaryUserBranch.branch.code,
            }
          : null,
        isDefaultAdmin: isDefault,
        roles: u.userRoles.map((ur) => ur.role.name),
      };
    });
  }

  async createClinicAdmin(
    dto: CreateClinicAdminDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required to create a Clinic Administrator');
    }

    // Rule 1: Only Tenant Admin can create Clinic Admin
    await this.assertTenantAdmin(actor, tenantId);

    // Rule 3: Branch Requirement - branch must exist before creating Clinic Admin
    const clinicBranchCount = await this.prisma.branch.count({
      where: { tenantId, moduleKey: 'CLINIC' },
    });

    if (clinicBranchCount === 0) {
      throw new BadRequestException(
        'Cannot create a Clinic Admin without an active Clinic branch. Please create at least one Clinic branch in your organization first.',
      );
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, tenantId, moduleKey: 'CLINIC' },
    });

    if (!branch) {
      throw new BadRequestException(
        'The selected branch was not found or is not a Clinic branch. A Clinic branch must exist before a Clinic Admin can be created.',
      );
    }

    // Check organization member limit against plan
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant organization '${tenantId}' not found`);
    }

    const currentMemberCount = await this.prisma.tenantMembership.count({
      where: { tenantId },
    });

    const effectiveMaxMembers =
      tenant.maxMembers !== null && tenant.maxMembers !== undefined
        ? Number(tenant.maxMembers)
        : tenant.plan?.memberCount !== null && tenant.plan?.memberCount !== undefined
        ? Number(tenant.plan.memberCount)
        : 10;

    if (currentMemberCount >= effectiveMaxMembers) {
      throw new BadRequestException(
        `Organization has reached the maximum allowed limit of ${effectiveMaxMembers} team member(s). Please upgrade your subscription plan or contact support.`,
      );
    }

    const email = dto.email.toLowerCase().trim();
    const fullName = `${dto.firstName.trim()} ${dto.lastName?.trim() || ''}`.trim();

    let formattedPhone: string | null = null;
    if (dto.phoneNumber?.trim()) {
      const code = dto.phoneCountryCode?.trim() || '+52';
      formattedPhone = `${code} ${dto.phoneNumber.trim()}`;
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { tenantId },
        },
      },
    });

    if (existingUser && existingUser.memberships.length > 0) {
      throw new ConflictException(`User ${email} is already a member of this organization.`);
    }

    // Rule 4: First User for a Branch - Automatically assign as Default Admin
    // Query existing Clinic Admins for this branch
    const existingDefaultCount = await this.prisma.userBranch.count({
      where: {
        branchId: dto.branchId,
        isDefault: true,
        user: {
          userRoles: {
            some: {
              tenantId,
              role: { slug: 'clinic-admin' },
            },
          },
        },
      },
    });

    // If 0 default admins exist, this first user is MANDATORILY the Default Admin
    const isDefaultAdmin = existingDefaultCount === 0 ? true : Boolean(dto.isDefaultAdmin);

    const clinicAdminRole = await this.ensureClinicAdminRole();

    // Temporary password hash
    const temporaryPassword = `Temp@${uuidv4().substring(0, 8)}!2026`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    // Atomic transaction
    const createdUser = await this.prisma.$transaction(async (tx) => {
      let user = existingUser;

      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            passwordHash,
            name: fullName,
            phone: formattedPhone,
            status: UserStatus.ACTIVE,
            locale: actor.locale || 'en',
          },
          include: { memberships: true },
        });
      } else {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            name: fullName,
            phone: formattedPhone || user.phone,
          },
          include: { memberships: true },
        });
      }

      // Create Tenant Membership
      await tx.tenantMembership.create({
        data: {
          userId: user.id,
          tenantId,
          status: UserStatus.ACTIVE,
          isOwner: false,
        },
      });

      // If marking as default admin, unset previous default admin for this branch (Rule 3)
      if (isDefaultAdmin) {
        await tx.userBranch.updateMany({
          where: {
            branchId: dto.branchId,
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        });
      }

      // Create UserBranch
      await tx.userBranch.create({
        data: {
          userId: user.id,
          branchId: dto.branchId,
          isDefault: isDefaultAdmin,
        },
      });

      // Assign CLINIC Module Access
      await tx.userModuleAccess.upsert({
        where: {
          userId_tenantId_moduleKey: {
            userId: user.id,
            tenantId,
            moduleKey: 'CLINIC',
          },
        },
        update: { isActive: true },
        create: {
          userId: user.id,
          tenantId,
          moduleKey: 'CLINIC',
          isActive: true,
        },
      });

      // Assign Clinic Admin Role
      await tx.userRole.create({
        data: {
          userId: user.id,
          tenantId,
          branchId: dto.branchId,
          roleId: clinicAdminRole.id,
        },
      });

      // Record default admin reference in branch settings
      if (isDefaultAdmin) {
        const currentSettings = (branch.settings as Record<string, any>) || {};
        await tx.branch.update({
          where: { id: branch.id },
          data: {
            settings: {
              ...currentSettings,
              defaultClinicAdminId: user.id,
              defaultClinicAdminName: fullName,
            },
          },
        });
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          tenantId,
          branchId: dto.branchId,
          userId: actor.id,
          action: 'CREATE_CLINIC_ADMIN',
          resourceType: 'USER',
          resourceId: user.id,
          moduleKey: 'CLINIC',
          newValues: {
            email,
            name: fullName,
            phone: formattedPhone,
            branchId: dto.branchId,
            branchName: branch.name,
            isDefaultAdmin,
            role: 'Clinic Admin',
          },
        },
      });

      return user;
    });

    // Rule 5: Email Notification with login access information
    let resetToken: string | undefined;
    try {
      resetToken = await this.authService.generatePasswordResetToken(createdUser.id);
    } catch (tokenErr) {
      this.logger.error(`Failed to generate password reset token: ${tokenErr.message}`);
    }

    try {
      const isSpanish = (createdUser.locale || actor.locale || 'en').toLowerCase().startsWith('es');
      const roleDisplayName = isSpanish ? 'Administrador de Clínica' : 'Clinic Administrator';

      await this.mailService.sendWelcomeInvite(
        createdUser.email,
        createdUser.name,
        tenant.name,
        resetToken,
        createdUser.locale || actor.locale || 'en',
        tenant.slug,
        roleDisplayName,
      );
      this.logger.log(`📧 Welcome invite email dispatched to Clinic Admin: ${createdUser.email}`);
    } catch (mailErr) {
      this.logger.warn(`⚠️ Failed to send welcome invite email to ${createdUser.email}: ${mailErr.message}`);
    }

    return {
      id: createdUser.id,
      email: createdUser.email,
      name: createdUser.name,
      phone: createdUser.phone,
      status: createdUser.status,
      branch: {
        id: branch.id,
        name: branch.name,
        code: branch.code,
      },
      isDefaultAdmin,
      roles: ['Clinic Admin'],
    };
  }

  async updateClinicAdmin(
    id: string,
    dto: UpdateClinicAdminDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    await this.assertTenantAdmin(actor, tenantId);

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userBranches: { where: { branch: { tenantId, moduleKey: 'CLINIC' } } },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, tenantId, moduleKey: 'CLINIC' },
      });
      if (!branch) {
        throw new BadRequestException(
          'The selected branch was not found or is not a Clinic branch.',
        );
      }
    }

    let fullName = user.name;
    if (dto.firstName) {
      fullName = `${dto.firstName.trim()} ${dto.lastName?.trim() || ''}`.trim();
    }

    let formattedPhone = user.phone;
    if (dto.phoneNumber !== undefined) {
      if (dto.phoneNumber.trim()) {
        const code = dto.phoneCountryCode?.trim() || '+52';
        formattedPhone = `${code} ${dto.phoneNumber.trim()}`;
      } else {
        formattedPhone = null;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: {
          name: fullName,
          phone: formattedPhone,
          ...(dto.status ? { status: dto.status } : {}),
        },
      });

      // Handle branch or default admin reassignment
      if (dto.branchId || dto.isDefaultAdmin !== undefined) {
        const targetBranchId = dto.branchId || user.userBranches[0]?.branchId;

        if (targetBranchId) {
          if (dto.isDefaultAdmin) {
            // Unset previous default admin for this branch
            await tx.userBranch.updateMany({
              where: {
                branchId: targetBranchId,
                isDefault: true,
                userId: { not: id },
              },
              data: { isDefault: false },
            });
          }

          await tx.userBranch.upsert({
            where: {
              userId_branchId: {
                userId: id,
                branchId: targetBranchId,
              },
            },
            update: {
              ...(dto.isDefaultAdmin !== undefined ? { isDefault: dto.isDefaultAdmin } : {}),
            },
            create: {
              userId: id,
              branchId: targetBranchId,
              isDefault: Boolean(dto.isDefaultAdmin),
            },
          });

          // Update userRole branchId
          const clinicAdminRole = await this.ensureClinicAdminRole();
          await tx.userRole.updateMany({
            where: {
              userId: id,
              tenantId,
              roleId: clinicAdminRole.id,
            },
            data: {
              branchId: targetBranchId,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: actor.id,
          action: 'UPDATE_CLINIC_ADMIN',
          resourceType: 'USER',
          resourceId: id,
          moduleKey: 'CLINIC',
          newValues: dto as any,
        },
      });

      return updatedUser;
    });
  }

  async deleteClinicAdmin(
    id: string,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    await this.assertTenantAdmin(actor, tenantId);

    const userBranch = await this.prisma.userBranch.findFirst({
      where: {
        userId: id,
        branch: { tenantId, moduleKey: 'CLINIC' },
      },
      include: { branch: true },
    });

    // Rule 3: Safeguard default admin - check if deleting the sole default admin
    if (userBranch?.isDefault) {
      const otherAdminsCount = await this.prisma.userBranch.count({
        where: {
          branchId: userBranch.branchId,
          userId: { not: id },
          user: {
            userRoles: {
              some: {
                tenantId,
                role: { slug: 'clinic-admin' },
              },
            },
          },
        },
      });

      if (otherAdminsCount > 0) {
        throw new BadRequestException(
          'Cannot delete the Default Clinic Admin while other administrators exist in the branch. Please transfer the Default Admin role to another administrator first.',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Unlink roles for this tenant
      await tx.userRole.deleteMany({
        where: { userId: id, tenantId },
      });

      // Unlink branches
      await tx.userBranch.deleteMany({
        where: { userId: id, branch: { tenantId, moduleKey: 'CLINIC' } },
      });

      // Unlink module access
      await tx.userModuleAccess.deleteMany({
        where: { userId: id, tenantId },
      });

      // Delete membership
      await tx.tenantMembership.deleteMany({
        where: { userId: id, tenantId },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: actor.id,
          action: 'DELETE_CLINIC_ADMIN',
          resourceType: 'USER',
          resourceId: id,
          moduleKey: 'CLINIC',
        },
      });
    });

    return { success: true, message: 'Clinic Administrator removed successfully' };
  }

  async resendAdminInvite(id: string, tenantId: string, actor: AuthenticatedUser) {
    await this.assertTenantAdmin(actor, tenantId);

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User '${id}' not found`);
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    const resetToken = await this.authService.generatePasswordResetToken(id);
    const isSpanish = (user.locale || actor.locale || 'en').toLowerCase().startsWith('es');
    const roleDisplayName = isSpanish ? 'Administrador de Clínica' : 'Clinic Administrator';

    await this.mailService.sendWelcomeInvite(
      user.email,
      user.name,
      tenant?.name || 'Unified Dental',
      resetToken,
      user.locale || actor.locale || 'en',
      tenant?.slug,
      roleDisplayName,
    );

    return { success: true, message: 'Invitation email resent successfully' };
  }

  // ============================================================================
  // 2. CLINIC STAFF MANAGEMENT (Rule 1, Rule 2, Rule 5)
  // ============================================================================

  async findAllClinicStaff(
    tenantId: string,
    actor: AuthenticatedUser,
    branchId?: string,
    search?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // If actor is Clinic Admin, lock branchId to their assigned branch
    let effectiveBranchId = branchId;
    const isTenantAdmin = await this.checkIsTenantAdmin(actor, tenantId);

    if (!isTenantAdmin && !actor.isSuperAdmin) {
      effectiveBranchId = await this.assertClinicAdmin(actor, tenantId);
    }

    const whereClause: any = {
      memberships: {
        some: { tenantId },
      },
      moduleAccess: {
        some: { tenantId, moduleKey: 'CLINIC', isActive: true },
      },
      userRoles: {
        some: {
          tenantId,
          role: { slug: 'clinic-staff' },
        },
      },
    };

    if (effectiveBranchId && effectiveBranchId !== 'all') {
      whereClause.userBranches = {
        some: { branchId: effectiveBranchId },
      };
    }

    if (search?.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        {
          userBranches: {
            some: {
              branch: {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { code: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ];
    }

    const users = await this.prisma.user.findMany({
      where: whereClause,
      include: {
        userBranches: {
          where: { branch: { tenantId, moduleKey: 'CLINIC' } },
          include: { branch: true },
        },
        userRoles: {
          where: { tenantId },
          include: { role: true },
        },
        memberships: {
          where: { tenantId },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => {
      const primaryUserBranch =
        (effectiveBranchId && effectiveBranchId !== 'all'
          ? u.userBranches.find((ub) => ub.branchId === effectiveBranchId)
          : null) || u.userBranches[0];

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone,
        status: u.status,
        avatarUrl: u.avatarUrl,
        createdAt: u.createdAt,
        branch: primaryUserBranch?.branch
          ? {
              id: primaryUserBranch.branch.id,
              name: primaryUserBranch.branch.name,
              code: primaryUserBranch.branch.code,
            }
          : null,
        roles: ['Clinic Staff'],
      };
    });
  }

  async createClinicStaff(
    dto: CreateClinicStaffDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // Rule 1: Tenant Admin CANNOT create Staff users
    await this.rejectTenantAdminFromStaffAndDoctor(actor, tenantId);

    // Rule 2: Clinic Admin creates Staff and auto-assigns to Clinic Admin's branch
    const branchId = await this.assertClinicAdmin(actor, tenantId);

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId, moduleKey: 'CLINIC' },
    });

    if (!branch) {
      throw new BadRequestException('The branch assigned to the Clinic Admin was not found or is not a Clinic branch.');
    }

    // Check member limits
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant organization '${tenantId}' not found`);
    }

    const currentMemberCount = await this.prisma.tenantMembership.count({
      where: { tenantId },
    });

    const effectiveMaxMembers =
      tenant.maxMembers !== null && tenant.maxMembers !== undefined
        ? Number(tenant.maxMembers)
        : tenant.plan?.memberCount !== null && tenant.plan?.memberCount !== undefined
        ? Number(tenant.plan.memberCount)
        : 10;

    if (currentMemberCount >= effectiveMaxMembers) {
      throw new BadRequestException(
        `Organization has reached the maximum allowed limit of ${effectiveMaxMembers} team member(s). Please upgrade your subscription plan or contact support.`,
      );
    }

    const email = dto.email.toLowerCase().trim();
    const fullName = `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim();

    let formattedPhone: string | null = null;
    if (dto.phoneNumber?.trim()) {
      const code = dto.phoneCountryCode?.trim() || '+52';
      formattedPhone = `${code} ${dto.phoneNumber.trim()}`;
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { tenantId },
        },
      },
    });

    if (existingUser && existingUser.memberships.length > 0) {
      throw new ConflictException(`User ${email} is already a member of this organization.`);
    }

    const clinicStaffRole = await this.ensureClinicStaffRole();

    const temporaryPassword = `Temp@${uuidv4().substring(0, 8)}!2026`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const createdUser = await this.prisma.$transaction(async (tx) => {
      let user = existingUser;

      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            passwordHash,
            name: fullName,
            phone: formattedPhone,
            status: UserStatus.ACTIVE,
            locale: actor.locale || 'en',
          },
          include: { memberships: true },
        });
      } else {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            name: fullName,
            phone: formattedPhone || user.phone,
          },
          include: { memberships: true },
        });
      }

      await tx.tenantMembership.create({
        data: {
          userId: user.id,
          tenantId,
          status: UserStatus.ACTIVE,
          isOwner: false,
        },
      });

      // Auto-assign to Clinic Admin's branch
      await tx.userBranch.create({
        data: {
          userId: user.id,
          branchId,
          isDefault: true,
        },
      });

      await tx.userModuleAccess.upsert({
        where: {
          userId_tenantId_moduleKey: {
            userId: user.id,
            tenantId,
            moduleKey: 'CLINIC',
          },
        },
        update: { isActive: true },
        create: {
          userId: user.id,
          tenantId,
          moduleKey: 'CLINIC',
          isActive: true,
        },
      });

      await tx.userRole.create({
        data: {
          userId: user.id,
          tenantId,
          branchId,
          roleId: clinicStaffRole.id,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          branchId,
          userId: actor.id,
          action: 'CREATE_CLINIC_STAFF',
          resourceType: 'USER',
          resourceId: user.id,
          moduleKey: 'CLINIC',
          newValues: {
            email,
            name: fullName,
            phone: formattedPhone,
            branchId,
            branchName: branch.name,
            roleTitle: dto.roleTitle,
            role: 'Clinic Staff',
          },
        },
      });

      return user;
    });

    // Rule 5: Email Notification
    let resetToken: string | undefined;
    try {
      resetToken = await this.authService.generatePasswordResetToken(createdUser.id);
    } catch (tokenErr) {
      this.logger.error(`Failed to generate password reset token for staff: ${tokenErr.message}`);
    }

    try {
      const isSpanish = (createdUser.locale || actor.locale || 'en').toLowerCase().startsWith('es');
      const roleDisplayName = isSpanish ? 'Personal de Clínica' : 'Clinic Staff';

      await this.mailService.sendWelcomeInvite(
        createdUser.email,
        createdUser.name,
        tenant.name,
        resetToken,
        createdUser.locale || actor.locale || 'en',
        tenant.slug,
        roleDisplayName,
      );
      this.logger.log(`📧 Welcome invite email dispatched to Clinic Staff: ${createdUser.email}`);
    } catch (mailErr) {
      this.logger.warn(`⚠️ Failed to send welcome invite email to ${createdUser.email}: ${mailErr.message}`);
    }

    return {
      id: createdUser.id,
      email: createdUser.email,
      name: createdUser.name,
      phone: createdUser.phone,
      status: createdUser.status,
      branch: {
        id: branch.id,
        name: branch.name,
        code: branch.code,
      },
      roles: ['Clinic Staff'],
    };
  }

  async updateClinicStaff(
    id: string,
    dto: UpdateClinicStaffDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const isTenantAdmin = await this.checkIsTenantAdmin(actor, tenantId);
    let clinicBranchId: string | undefined;
    if (!isTenantAdmin && !actor.isSuperAdmin) {
      clinicBranchId = await this.assertClinicAdmin(actor, tenantId);
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userBranches: { where: { branch: { tenantId, moduleKey: 'CLINIC' } } },
      },
    });

    if (!user) {
      throw new NotFoundException(`User '${id}' not found`);
    }

    // Verify branch scope for Clinic Admin
    if (clinicBranchId && !user.userBranches.some((ub) => ub.branchId === clinicBranchId)) {
      throw new ForbiddenException('You can only update staff members within your assigned branch.');
    }

    let fullName = user.name;
    if (dto.firstName) {
      fullName = `${dto.firstName.trim()} ${dto.lastName?.trim() || ''}`.trim();
    }

    let formattedPhone = user.phone;
    if (dto.phoneNumber !== undefined) {
      if (dto.phoneNumber.trim()) {
        const code = dto.phoneCountryCode?.trim() || '+52';
        formattedPhone = `${code} ${dto.phoneNumber.trim()}`;
      } else {
        formattedPhone = null;
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: fullName,
        phone: formattedPhone,
        ...(dto.status ? { status: dto.status } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actor.id,
        action: 'UPDATE_CLINIC_STAFF',
        resourceType: 'USER',
        resourceId: id,
        moduleKey: 'CLINIC',
        newValues: dto as any,
      },
    });

    return updated;
  }

  async deleteClinicStaff(id: string, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdmin = await this.checkIsTenantAdmin(actor, tenantId);
    let clinicBranchId: string | undefined;
    if (!isTenantAdmin && !actor.isSuperAdmin) {
      clinicBranchId = await this.assertClinicAdmin(actor, tenantId);
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userBranches: { where: { branch: { tenantId, moduleKey: 'CLINIC' } } },
      },
    });

    if (!user) {
      throw new NotFoundException(`Staff user '${id}' not found`);
    }

    if (clinicBranchId && !user.userBranches.some((ub) => ub.branchId === clinicBranchId)) {
      throw new ForbiddenException('You can only delete staff members within your assigned branch.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id, tenantId, role: { slug: 'clinic-staff' } } });
      await tx.userBranch.deleteMany({ where: { userId: id, branch: { tenantId, moduleKey: 'CLINIC' } } });
      await tx.userModuleAccess.deleteMany({ where: { userId: id, tenantId, moduleKey: 'CLINIC' } });
      await tx.tenantMembership.deleteMany({ where: { userId: id, tenantId } });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: actor.id,
          action: 'DELETE_CLINIC_STAFF',
          resourceType: 'USER',
          resourceId: id,
          moduleKey: 'CLINIC',
        },
      });
    });

    return { success: true, message: 'Clinic staff member removed successfully' };
  }

  async resendStaffInvite(id: string, tenantId: string, actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User '${id}' not found`);

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const resetToken = await this.authService.generatePasswordResetToken(id);
    const isSpanish = (user.locale || actor.locale || 'en').toLowerCase().startsWith('es');
    const roleDisplayName = isSpanish ? 'Personal de Clínica' : 'Clinic Staff';

    await this.mailService.sendWelcomeInvite(
      user.email,
      user.name,
      tenant?.name || 'Unified Dental',
      resetToken,
      user.locale || actor.locale || 'en',
      tenant?.slug,
      roleDisplayName,
    );

    return { success: true, message: 'Invitation email resent successfully' };
  }

  // ============================================================================
  // 3. CLINIC DOCTOR MANAGEMENT (Rule 1, Rule 2, Rule 5)
  // ============================================================================

  async findAllClinicDoctors(
    tenantId: string,
    actor: AuthenticatedUser,
    branchId?: string,
    search?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    let effectiveBranchId = branchId;
    const isTenantAdmin = await this.checkIsTenantAdmin(actor, tenantId);

    if (!isTenantAdmin && !actor.isSuperAdmin) {
      effectiveBranchId = await this.assertClinicAdmin(actor, tenantId);
    }

    const whereClause: any = {
      memberships: {
        some: { tenantId },
      },
      moduleAccess: {
        some: { tenantId, moduleKey: 'CLINIC', isActive: true },
      },
      userRoles: {
        some: {
          tenantId,
          role: { slug: 'clinic-doctor' },
        },
      },
    };

    if (effectiveBranchId && effectiveBranchId !== 'all') {
      whereClause.userBranches = {
        some: { branchId: effectiveBranchId },
      };
    }

    if (search?.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        {
          userBranches: {
            some: {
              branch: {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { code: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ];
    }

    const [users, doctorRecords] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        include: {
          userBranches: {
            where: { branch: { tenantId, moduleKey: 'CLINIC' } },
            include: { branch: true },
          },
          userRoles: {
            where: { tenantId },
            include: { role: true },
          },
          memberships: {
            where: { tenantId },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.doctor.findMany({
        where: { tenantId, moduleKey: 'CLINIC' },
      }),
    ]);

    const doctorMap = new Map<string, typeof doctorRecords[0]>();
    for (const d of doctorRecords) {
      if (d.email) doctorMap.set(d.email.toLowerCase(), d);
    }

    return users.map((u) => {
      const primaryUserBranch =
        (effectiveBranchId && effectiveBranchId !== 'all'
          ? u.userBranches.find((ub) => ub.branchId === effectiveBranchId)
          : null) || u.userBranches[0];

      const docRecord = doctorMap.get(u.email.toLowerCase());

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone,
        status: u.status,
        avatarUrl: u.avatarUrl,
        specialization: docRecord?.specialization || 'General Dentistry',
        licenseNumber: docRecord?.externalId || null,
        createdAt: u.createdAt,
        branch: primaryUserBranch?.branch
          ? {
              id: primaryUserBranch.branch.id,
              name: primaryUserBranch.branch.name,
              code: primaryUserBranch.branch.code,
            }
          : null,
        roles: ['Clinic Doctor'],
      };
    });
  }

  async createClinicDoctor(
    dto: CreateClinicDoctorDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // Rule 1: Tenant Admin CANNOT create Doctor users
    await this.rejectTenantAdminFromStaffAndDoctor(actor, tenantId);

    // Rule 2: Clinic Admin creates Doctor and auto-assigns to Clinic Admin's branch
    const branchId = await this.assertClinicAdmin(actor, tenantId);

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId, moduleKey: 'CLINIC' },
    });

    if (!branch) {
      throw new BadRequestException('The branch assigned to the Clinic Admin was not found or is not a Clinic branch.');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant organization '${tenantId}' not found`);
    }

    const currentMemberCount = await this.prisma.tenantMembership.count({
      where: { tenantId },
    });

    const effectiveMaxMembers =
      tenant.maxMembers !== null && tenant.maxMembers !== undefined
        ? Number(tenant.maxMembers)
        : tenant.plan?.memberCount !== null && tenant.plan?.memberCount !== undefined
        ? Number(tenant.plan.memberCount)
        : 10;

    if (currentMemberCount >= effectiveMaxMembers) {
      throw new BadRequestException(
        `Organization has reached the maximum allowed limit of ${effectiveMaxMembers} team member(s). Please upgrade your subscription plan or contact support.`,
      );
    }

    const email = dto.email.toLowerCase().trim();
    const fullName = `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim();

    let formattedPhone: string | null = null;
    if (dto.phoneNumber?.trim()) {
      const code = dto.phoneCountryCode?.trim() || '+52';
      formattedPhone = `${code} ${dto.phoneNumber.trim()}`;
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { tenantId },
        },
      },
    });

    if (existingUser && existingUser.memberships.length > 0) {
      throw new ConflictException(`User ${email} is already a member of this organization.`);
    }

    const clinicDoctorRole = await this.ensureClinicDoctorRole();

    const temporaryPassword = `Temp@${uuidv4().substring(0, 8)}!2026`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const createdUser = await this.prisma.$transaction(async (tx) => {
      let user = existingUser;

      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            passwordHash,
            name: fullName,
            phone: formattedPhone,
            status: UserStatus.ACTIVE,
            locale: actor.locale || 'en',
          },
          include: { memberships: true },
        });
      } else {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            name: fullName,
            phone: formattedPhone || user.phone,
          },
          include: { memberships: true },
        });
      }

      await tx.tenantMembership.create({
        data: {
          userId: user.id,
          tenantId,
          status: UserStatus.ACTIVE,
          isOwner: false,
        },
      });

      // Auto-assign to Clinic Admin's branch
      await tx.userBranch.create({
        data: {
          userId: user.id,
          branchId,
          isDefault: true,
        },
      });

      await tx.userModuleAccess.upsert({
        where: {
          userId_tenantId_moduleKey: {
            userId: user.id,
            tenantId,
            moduleKey: 'CLINIC',
          },
        },
        update: { isActive: true },
        create: {
          userId: user.id,
          tenantId,
          moduleKey: 'CLINIC',
          isActive: true,
        },
      });

      await tx.userRole.create({
        data: {
          userId: user.id,
          tenantId,
          branchId,
          roleId: clinicDoctorRole.id,
        },
      });

      // Sync record in Doctor table for clinical appointments, prescriptions, etc.
      await tx.doctor.create({
        data: {
          tenantId,
          branchId,
          moduleKey: 'CLINIC',
          name: fullName,
          clinicName: branch.name,
          email,
          phone: formattedPhone,
          specialization: dto.specialization || 'General Dentistry',
          externalId: dto.licenseNumber || null,
          type: 'LOCAL',
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          branchId,
          userId: actor.id,
          action: 'CREATE_CLINIC_DOCTOR',
          resourceType: 'USER',
          resourceId: user.id,
          moduleKey: 'CLINIC',
          newValues: {
            email,
            name: fullName,
            phone: formattedPhone,
            branchId,
            branchName: branch.name,
            specialization: dto.specialization,
            licenseNumber: dto.licenseNumber,
            role: 'Clinic Doctor',
          },
        },
      });

      return user;
    });

    // Rule 5: Email Notification
    let resetToken: string | undefined;
    try {
      resetToken = await this.authService.generatePasswordResetToken(createdUser.id);
    } catch (tokenErr) {
      this.logger.error(`Failed to generate password reset token for doctor: ${tokenErr.message}`);
    }

    try {
      const isSpanish = (createdUser.locale || actor.locale || 'en').toLowerCase().startsWith('es');
      const roleDisplayName = isSpanish ? 'Doctor de Clínica' : 'Clinic Doctor';

      await this.mailService.sendWelcomeInvite(
        createdUser.email,
        createdUser.name,
        tenant.name,
        resetToken,
        createdUser.locale || actor.locale || 'en',
        tenant.slug,
        roleDisplayName,
      );
      this.logger.log(`📧 Welcome invite email dispatched to Clinic Doctor: ${createdUser.email}`);
    } catch (mailErr) {
      this.logger.warn(`⚠️ Failed to send welcome invite email to ${createdUser.email}: ${mailErr.message}`);
    }

    return {
      id: createdUser.id,
      email: createdUser.email,
      name: createdUser.name,
      phone: createdUser.phone,
      status: createdUser.status,
      specialization: dto.specialization || 'General Dentistry',
      branch: {
        id: branch.id,
        name: branch.name,
        code: branch.code,
      },
      roles: ['Clinic Doctor'],
    };
  }

  async updateClinicDoctor(
    id: string,
    dto: UpdateClinicDoctorDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const isTenantAdmin = await this.checkIsTenantAdmin(actor, tenantId);
    let clinicBranchId: string | undefined;
    if (!isTenantAdmin && !actor.isSuperAdmin) {
      clinicBranchId = await this.assertClinicAdmin(actor, tenantId);
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userBranches: { where: { branch: { tenantId, moduleKey: 'CLINIC' } } },
      },
    });

    if (!user) {
      throw new NotFoundException(`Doctor '${id}' not found`);
    }

    if (clinicBranchId && !user.userBranches.some((ub) => ub.branchId === clinicBranchId)) {
      throw new ForbiddenException('You can only update doctors within your assigned branch.');
    }

    let fullName = user.name;
    if (dto.firstName) {
      fullName = `${dto.firstName.trim()} ${dto.lastName?.trim() || ''}`.trim();
    }

    let formattedPhone = user.phone;
    if (dto.phoneNumber !== undefined) {
      if (dto.phoneNumber.trim()) {
        const code = dto.phoneCountryCode?.trim() || '+52';
        formattedPhone = `${code} ${dto.phoneNumber.trim()}`;
      } else {
        formattedPhone = null;
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: {
          name: fullName,
          phone: formattedPhone,
          ...(dto.status ? { status: dto.status } : {}),
        },
      });

      // Also update linked doctor record
      await tx.doctor.updateMany({
        where: {
          tenantId,
          email: user.email,
          moduleKey: 'CLINIC',
        },
        data: {
          name: fullName,
          phone: formattedPhone,
          ...(dto.specialization ? { specialization: dto.specialization } : {}),
          ...(dto.licenseNumber ? { externalId: dto.licenseNumber } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: actor.id,
          action: 'UPDATE_CLINIC_DOCTOR',
          resourceType: 'USER',
          resourceId: id,
          moduleKey: 'CLINIC',
          newValues: dto as any,
        },
      });

      return u;
    });

    return updated;
  }

  async deleteClinicDoctor(id: string, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdmin = await this.checkIsTenantAdmin(actor, tenantId);
    let clinicBranchId: string | undefined;
    if (!isTenantAdmin && !actor.isSuperAdmin) {
      clinicBranchId = await this.assertClinicAdmin(actor, tenantId);
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userBranches: { where: { branch: { tenantId, moduleKey: 'CLINIC' } } },
      },
    });

    if (!user) {
      throw new NotFoundException(`Doctor user '${id}' not found`);
    }

    if (clinicBranchId && !user.userBranches.some((ub) => ub.branchId === clinicBranchId)) {
      throw new ForbiddenException('You can only delete doctors within your assigned branch.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id, tenantId, role: { slug: 'clinic-doctor' } } });
      await tx.userBranch.deleteMany({ where: { userId: id, branch: { tenantId, moduleKey: 'CLINIC' } } });
      await tx.userModuleAccess.deleteMany({ where: { userId: id, tenantId, moduleKey: 'CLINIC' } });
      await tx.tenantMembership.deleteMany({ where: { userId: id, tenantId } });

      // Deactivate doctor record
      await tx.doctor.updateMany({
        where: { tenantId, email: user.email, moduleKey: 'CLINIC' },
        data: { isActive: false },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: actor.id,
          action: 'DELETE_CLINIC_DOCTOR',
          resourceType: 'USER',
          resourceId: id,
          moduleKey: 'CLINIC',
        },
      });
    });

    return { success: true, message: 'Clinic doctor removed successfully' };
  }

  async resendDoctorInvite(id: string, tenantId: string, actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User '${id}' not found`);

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const resetToken = await this.authService.generatePasswordResetToken(id);
    const isSpanish = (user.locale || actor.locale || 'en').toLowerCase().startsWith('es');
    const roleDisplayName = isSpanish ? 'Doctor de Clínica' : 'Clinic Doctor';

    await this.mailService.sendWelcomeInvite(
      user.email,
      user.name,
      tenant?.name || 'Unified Dental',
      resetToken,
      user.locale || actor.locale || 'en',
      tenant?.slug,
      roleDisplayName,
    );

    return { success: true, message: 'Invitation email resent successfully' };
  }
}
