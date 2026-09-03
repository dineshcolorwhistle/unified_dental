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
import { CreateLabAdminDto } from './dto/create-lab-admin.dto';
import { UpdateLabAdminDto } from './dto/update-lab-admin.dto';
import { AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LabUsersService {
  private readonly logger = new Logger(LabUsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Verify whether an authenticated actor has Tenant Administrator privileges
   * within the target tenant organization.
   */
  async assertTenantAdmin(actor: AuthenticatedUser, tenantId: string): Promise<void> {
    if (actor.isSuperAdmin) {
      return;
    }

    // Check in-memory actor roles / memberships if available
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

    // Fallback: Direct DB verification
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
        'Only Tenant Administrators can create or manage Lab Administrators and Branches.',
      );
    }
  }

  /**
   * Find or auto-provision the system-level 'lab-admin' role
   */
  async ensureLabAdminRole() {
    let role = await this.prisma.role.findFirst({
      where: {
        slug: 'lab-admin',
      },
    });

    if (!role) {
      this.logger.log('🌱 Auto-provisioning system role "lab-admin"...');
      role = await this.prisma.role.create({
        data: {
          name: 'Lab Admin',
          slug: 'lab-admin',
          description: 'Administrator for Dental Lab module operations and branch processes',
          moduleKey: 'LAB',
          isSystem: true,
          tenantId: null,
        },
      });
    }

    return role;
  }

  /**
   * Create a new Lab Admin assigned to a branch within the tenant.
   * Enforces:
   * 1. Tenant Admin authorization
   * 2. Branch prerequisite (tenant must have at least one branch)
   * 3. LAB module enablement
   * 4. Automatic welcome email with single-use password reset link
   */
  async createLabAdmin(
    dto: CreateLabAdminDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required to create a Lab Admin');
    }

    // 1. Enforce Tenant Admin authorization
    await this.assertTenantAdmin(actor, tenantId);

    // 2. Enforce Branch Prerequisite
    const branchCount = await this.prisma.branch.count({
      where: { tenantId },
    });

    if (branchCount === 0) {
      throw new BadRequestException(
        'Cannot create a Lab Admin without an active branch. Please create at least one branch in your organization first.',
      );
    }

    if (!dto.branchId) {
      throw new BadRequestException('Branch selection is mandatory for Lab Admin creation.');
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, tenantId },
    });

    if (!branch) {
      throw new BadRequestException(
        'The selected branch was not found or does not belong to this organization.',
      );
    }

    // 3. Enforce LAB Module Enablement
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: true,
        modules: {
          where: { isEnabled: true },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant organization '${tenantId}' not found`);
    }

    const hasLabModule = tenant.modules.some(
      (m) => m.moduleKey.toUpperCase() === 'LAB',
    );
    if (!hasLabModule) {
      throw new BadRequestException(
        'The Dental Lab module is not enabled for this organization. Please activate it in organization settings first.',
      );
    }

    // 4. Check Member Limit
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

    // 5. Check if user already exists
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
      throw new ConflictException(
        `User ${email} is already a member of this organization.`,
      );
    }

    // 5b. Enforce 1 Lab Admin : 1 Branch rule — same email cannot be a Lab Admin in another branch
    if (existingUser) {
      const existingLabAdminRole = await this.prisma.userRole.findFirst({
        where: {
          userId: existingUser.id,
          tenantId,
          role: {
            slug: 'lab-admin',
          },
        },
        include: {
          branch: true,
        },
      });

      if (existingLabAdminRole) {
        const branchName = existingLabAdminRole.branch?.name || 'another branch';
        throw new ConflictException(
          `This email (${email}) is already assigned as a Lab Admin in branch "${branchName}". A Lab Admin can only be assigned to one branch.`,
        );
      }
    }

    // 6. Ensure Role
    const labAdminRole = await this.ensureLabAdminRole();

    // 7. Temporary password hash (user will set their own password via email link)
    const temporaryPassword = `Temp@${uuidv4().substring(0, 8)}!2026`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const isDefaultAdmin = Boolean(dto.isDefaultAdmin);

    // 8. Create user and all associations in a transaction
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
        // Update name and phone if provided
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            name: fullName,
            phone: formattedPhone || user.phone,
          },
          include: { memberships: true },
        });
      }

      // Create membership
      await tx.tenantMembership.create({
        data: {
          userId: user.id,
          tenantId,
          status: UserStatus.ACTIVE,
          isOwner: false,
        },
      });

      // Assign branch
      if (isDefaultAdmin) {
        // If this admin is set as default for this branch, unset previous defaults
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

      await tx.userBranch.create({
        data: {
          userId: user.id,
          branchId: dto.branchId,
          isDefault: isDefaultAdmin,
        },
      });

      // Assign Module Access (LAB)
      await tx.userModuleAccess.upsert({
        where: {
          userId_tenantId_moduleKey: {
            userId: user.id,
            tenantId,
            moduleKey: 'LAB',
          },
        },
        update: { isActive: true },
        create: {
          userId: user.id,
          tenantId,
          moduleKey: 'LAB',
          isActive: true,
        },
      });

      // Assign Lab Admin Role
      await tx.userRole.create({
        data: {
          userId: user.id,
          tenantId,
          branchId: dto.branchId,
          roleId: labAdminRole.id,
        },
      });

      // If marked as default admin, record in branch settings as reference
      if (isDefaultAdmin) {
        const currentSettings = (branch.settings as Record<string, any>) || {};
        await tx.branch.update({
          where: { id: branch.id },
          data: {
            settings: {
              ...currentSettings,
              defaultLabAdminId: user.id,
              defaultLabAdminName: fullName,
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
          action: 'CREATE_LAB_ADMIN',
          resourceType: 'USER',
          resourceId: user.id,
          moduleKey: 'LAB',
          newValues: {
            email,
            name: fullName,
            phone: formattedPhone,
            branchId: dto.branchId,
            branchName: branch.name,
            isDefaultAdmin,
            role: 'Lab Admin',
          },
        },
      });

      return user;
    });

    // 9. Generate Single-Use 24h Password Reset Token
    let resetToken: string | undefined;
    try {
      resetToken = await this.authService.generatePasswordResetToken(createdUser.id);
    } catch (tokenErr) {
      this.logger.error(`Failed to generate password reset token: ${tokenErr.message}`);
    }

    // 10. Send Welcome / Password Reset Email
    try {
      const isSpanish = (createdUser.locale || actor.locale || 'en').toLowerCase().startsWith('es');
      const roleDisplayName = isSpanish ? 'Administrador de Laboratorio' : 'Lab Administrator';

      await this.mailService.sendWelcomeInvite(
        createdUser.email,
        createdUser.name,
        tenant.name,
        resetToken,
        createdUser.locale || actor.locale || 'en',
        tenant.slug,
        roleDisplayName,
      );
      this.logger.log(`📧 Welcome invite email dispatched to Lab Admin: ${createdUser.email}`);
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
      role: 'Lab Admin',
      moduleKey: 'LAB',
      message: 'Lab Admin created successfully. Welcome email with password reset instructions has been sent.',
    };
  }

  /**
   * List all Lab Admins in the active tenant organization.
   */
  async findAllLabAdmins(
    tenantId: string,
    branchId?: string,
    search?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    const whereClause: any = {
      memberships: {
        some: { tenantId },
      },
      moduleAccess: {
        some: { tenantId, moduleKey: 'LAB', isActive: true },
      },
      userRoles: {
        some: {
          tenantId,
          role: { slug: 'lab-admin' },
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
      ];
    }

    const users = await this.prisma.user.findMany({
      where: whereClause,
      include: {
        userBranches: {
          where: { branch: { tenantId } },
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
      const primaryUserBranch = u.userBranches[0];
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

  /**
   * Resend welcome / password setup email to an existing Lab Admin
   */
  async resendInvite(
    adminId: string,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    await this.assertTenantAdmin(actor, tenantId);

    const user = await this.prisma.user.findFirst({
      where: {
        id: adminId,
        memberships: { some: { tenantId } },
      },
    });

    if (!user) {
      throw new NotFoundException(`Lab Admin with ID '${adminId}' not found in this organization`);
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant organization '${tenantId}' not found`);
    }

    const resetToken = await this.authService.generatePasswordResetToken(user.id);
    const isSpanish = (user.locale || actor.locale || 'en').toLowerCase().startsWith('es');
    const roleDisplayName = isSpanish ? 'Administrador de Laboratorio' : 'Lab Administrator';

    await this.mailService.sendWelcomeInvite(
      user.email,
      user.name,
      tenant.name,
      resetToken,
      user.locale || actor.locale || 'en',
      tenant.slug,
      roleDisplayName,
    );

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actor.id,
        action: 'RESEND_LAB_ADMIN_INVITE',
        resourceType: 'USER',
        resourceId: user.id,
        moduleKey: 'LAB',
        newValues: { email: user.email },
      },
    });

    return {
      success: true,
      message: `Password reset email resent successfully to ${user.email}`,
    };
  }

  /**
   * Update Lab Admin profile, branch assignment, or default status
   */
  async updateLabAdmin(
    adminId: string,
    dto: UpdateLabAdminDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    await this.assertTenantAdmin(actor, tenantId);

    const user = await this.prisma.user.findFirst({
      where: {
        id: adminId,
        memberships: { some: { tenantId } },
      },
    });

    if (!user) {
      throw new NotFoundException(`Lab Admin with ID '${adminId}' not found in this organization`);
    }

    let fullName: string | undefined = undefined;
    if (dto.firstName !== undefined) {
      fullName = `${dto.firstName.trim()} ${dto.lastName?.trim() || ''}`.trim();
    }

    let formattedPhone: string | undefined = undefined;
    if (dto.phoneNumber !== undefined) {
      if (dto.phoneNumber.trim()) {
        const code = dto.phoneCountryCode?.trim() || '+52';
        formattedPhone = `${code} ${dto.phoneNumber.trim()}`;
      } else {
        formattedPhone = null as any;
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Update basic user details
      await tx.user.update({
        where: { id: adminId },
        data: {
          name: fullName !== undefined ? fullName : undefined,
          phone: formattedPhone !== undefined ? formattedPhone : undefined,
          status: dto.status !== undefined ? dto.status : undefined,
        },
      });

      // 2. Update branch assignment if provided
      if (dto.branchId) {
        const branch = await tx.branch.findFirst({
          where: { id: dto.branchId, tenantId },
        });
        if (!branch) {
          throw new BadRequestException('Selected branch does not belong to this organization');
        }

        // Delete existing branch links for this user in this tenant
        const existingBranches = await tx.branch.findMany({
          where: { tenantId },
          select: { id: true },
        });
        const branchIds = existingBranches.map((b) => b.id);

        await tx.userBranch.deleteMany({
          where: {
            userId: adminId,
            branchId: { in: branchIds },
          },
        });

        // If default admin, unset other defaults
        if (dto.isDefaultAdmin) {
          await tx.userBranch.updateMany({
            where: { branchId: dto.branchId, isDefault: true },
            data: { isDefault: false },
          });
        }

        await tx.userBranch.create({
          data: {
            userId: adminId,
            branchId: dto.branchId,
            isDefault: Boolean(dto.isDefaultAdmin),
          },
        });

        // Also update UserRole branchId
        await tx.userRole.updateMany({
          where: {
            userId: adminId,
            tenantId,
            role: { slug: 'lab-admin' },
          },
          data: {
            branchId: dto.branchId,
          },
        });
      } else if (dto.isDefaultAdmin !== undefined) {
        // Only toggling default flag on existing branch
        const currentUb = await tx.userBranch.findFirst({
          where: {
            userId: adminId,
            branch: { tenantId },
          },
        });

        if (currentUb) {
          if (dto.isDefaultAdmin) {
            await tx.userBranch.updateMany({
              where: { branchId: currentUb.branchId, isDefault: true },
              data: { isDefault: false },
            });
          }

          await tx.userBranch.update({
            where: { id: currentUb.id },
            data: { isDefault: dto.isDefaultAdmin },
          });
        }
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: actor.id,
          action: 'UPDATE_LAB_ADMIN',
          resourceType: 'USER',
          resourceId: adminId,
          moduleKey: 'LAB',
          newValues: dto as any,
        },
      });
    });

    return { success: true, message: 'Lab Admin updated successfully' };
  }

  /**
   * Delete / Remove Lab Admin from the organization
   */
  async deleteLabAdmin(
    adminId: string,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    await this.assertTenantAdmin(actor, tenantId);

    const user = await this.prisma.user.findFirst({
      where: {
        id: adminId,
        memberships: { some: { tenantId } },
      },
    });

    if (!user) {
      throw new NotFoundException(`Lab Admin with ID '${adminId}' not found in this organization`);
    }

    await this.prisma.$transaction(async (tx) => {
      // Remove tenant membership
      await tx.tenantMembership.deleteMany({
        where: { userId: adminId, tenantId },
      });

      // Remove roles in this tenant
      await tx.userRole.deleteMany({
        where: { userId: adminId, tenantId },
      });

      // Remove branch links in this tenant
      const tenantBranches = await tx.branch.findMany({
        where: { tenantId },
        select: { id: true },
      });
      const branchIds = tenantBranches.map((b) => b.id);

      await tx.userBranch.deleteMany({
        where: { userId: adminId, branchId: { in: branchIds } },
      });

      // Remove module access for this tenant
      await tx.userModuleAccess.deleteMany({
        where: { userId: adminId, tenantId },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: actor.id,
          action: 'DELETE_LAB_ADMIN',
          resourceType: 'USER',
          resourceId: adminId,
          moduleKey: 'LAB',
          oldValues: { email: user.email, name: user.name },
        },
      });
    });

    return { success: true, message: `Lab Admin '${user.name}' removed from organization` };
  }
}
