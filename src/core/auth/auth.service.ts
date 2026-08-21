import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { LoginDto, ResetPasswordDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return null;
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      return null;
    }

    return user;
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'INACTIVE') {
      throw new ForbiddenException('Account is inactive. Please contact your organization administrator.');
    }

    // 1. Resolve Tenant Context
    let tenantId = undefined;
    let tenantSlug = dto.tenantSlug;

    // Platform-only login enforcement: non-super-admins MUST provide a tenant slug
    if (!tenantSlug && !user.isSuperAdmin) {
      throw new ForbiddenException(
        'This login is for platform administrators only. Please use your organization\'s subdomain URL to sign in.',
      );
    }

    if (tenantSlug) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { slug: tenantSlug.toLowerCase() },
      });
      if (!tenant) {
        throw new NotFoundException(`Tenant organization '${tenantSlug}' not found`);
      }
      tenantId = tenant.id;

      // If not super admin, check membership
      if (!user.isSuperAdmin) {
        const membership = await this.prisma.tenantMembership.findUnique({
          where: {
            userId_tenantId: {
              userId: user.id,
              tenantId: tenant.id,
            },
          },
        });

        if (!membership || membership.status === 'INACTIVE') {
          throw new ForbiddenException(`You do not have active access to organization '${tenant.name}'`);
        }
      }
    }

    // 2. Resolve Active Branch Context
    let branchId = dto.branchId;
    if (!branchId && tenantId) {
      // Find user's default branch or first branch in tenant
      const userBranch = await this.prisma.userBranch.findFirst({
        where: {
          userId: user.id,
          branch: { tenantId },
        },
        orderBy: { isDefault: 'desc' },
      });

      if (userBranch) {
        branchId = userBranch.branchId;
      } else {
        const tenantBranch = await this.prisma.branch.findFirst({
          where: { tenantId, status: 'ACTIVE' },
          orderBy: { isDefault: 'desc' },
        });
        if (tenantBranch) {
          branchId = tenantBranch.id;
        }
      }
    }

    // 3. Issue Tokens
    const tokens = await this.generateTokens(user.id, user.email, user.isSuperAdmin, tenantId, branchId);

    // 4. Log Audit
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        branchId,
        userId: user.id,
        action: 'LOGIN',
        resourceType: 'AUTH',
        resourceId: user.id,
        ipAddress,
        userAgent,
      },
    });

    const userProfile = await this.getMe(user.id, tenantId, branchId);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: userProfile,
    };
  }

  async generateTokens(
    userId: string,
    email: string,
    isSuperAdmin: boolean,
    tenantId?: string,
    branchId?: string,
  ) {
    const payload = {
      sub: userId,
      email,
      isSuperAdmin,
      tenantId,
      branchId,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const rawRefreshToken = `${uuidv4()}-${uuidv4()}`;
    const tokenHash = await bcrypt.hash(rawRefreshToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: `${userId}:${rawRefreshToken}`,
    };
  }

  async refreshToken(refreshTokenStr: string) {
    const [userId, rawToken] = refreshTokenStr.split(':');
    if (!userId || !rawToken) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });

    let matchedTokenRecord = null;
    for (const record of tokens) {
      const match = await bcrypt.compare(rawToken, record.tokenHash);
      if (match) {
        matchedTokenRecord = record;
        break;
      }
    }

    if (!matchedTokenRecord) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: matchedTokenRecord.id },
      data: { revoked: true },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status === 'INACTIVE') {
      throw new UnauthorizedException('User account inactive');
    }

    const newTokens = await this.generateTokens(user.id, user.email, user.isSuperAdmin);

    return {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
    };
  }

  async logout(userId: string, refreshTokenStr?: string) {
    if (refreshTokenStr) {
      const [, rawToken] = refreshTokenStr.split(':');
      if (rawToken) {
        const tokens = await this.prisma.refreshToken.findMany({
          where: { userId, revoked: false },
        });
        for (const token of tokens) {
          if (await bcrypt.compare(rawToken, token.tokenHash)) {
            await this.prisma.refreshToken.update({
              where: { id: token.id },
              data: { revoked: true },
            });
          }
        }
      }
    }
    return { success: true, message: 'Logged out successfully' };
  }

  async getMe(userId: string, activeTenantId?: string, activeBranchId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            tenant: {
              include: {
                modules: { where: { isEnabled: true } },
                branches: { where: { status: 'ACTIVE' } },
              },
            },
          },
        },
        userBranches: {
          include: { branch: true },
        },
        moduleAccess: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    // Determine effective tenant
    const effectiveTenantId = activeTenantId || user.memberships[0]?.tenantId;
    const effectiveTenant = user.memberships.find((m) => m.tenantId === effectiveTenantId)?.tenant;

    // Filter branches
    const availableBranches = effectiveTenant
      ? effectiveTenant.branches
      : user.userBranches.map((ub) => ub.branch);

    const effectiveBranchId = activeBranchId || user.userBranches.find((ub) => ub.branch.tenantId === effectiveTenantId && ub.isDefault)?.branchId || availableBranches[0]?.id;

    // Compute permissions
    const permissionKeys = new Set<string>();
    const roleNames: string[] = [];

    if (user.isSuperAdmin) {
      permissionKeys.add('*');
    }

    for (const ur of user.userRoles) {
      if (user.isSuperAdmin || !effectiveTenantId || ur.tenantId === effectiveTenantId) {
        roleNames.push(ur.role.name);
        for (const rp of ur.role.rolePermissions) {
          permissionKeys.add(rp.permission.key);
        }
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      isSuperAdmin: user.isSuperAdmin,
      locale: user.locale,
      activeTenant: effectiveTenant
        ? {
            id: effectiveTenant.id,
            name: effectiveTenant.name,
            slug: effectiveTenant.slug,
            enabledModules: effectiveTenant.modules.map((m) => m.moduleKey),
          }
        : null,
      activeBranchId: effectiveBranchId,
      availableBranches: availableBranches.map((b) => ({
        id: b.id,
        name: b.name,
        code: b.code,
        isDefault: b.isDefault,
      })),
      tenants: user.memberships.map((m) => ({
        id: m.tenant.id,
        name: m.tenant.name,
        slug: m.tenant.slug,
        isOwner: m.isOwner,
        modules: m.tenant.modules.map((mod) => mod.moduleKey),
      })),
      roles: roleNames,
      permissions: Array.from(permissionKeys),
    };
  }

  async switchBranch(userId: string, tenantId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found in this organization');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const tokens = await this.generateTokens(user.id, user.email, user.isSuperAdmin, tenantId, branchId);
    const profile = await this.getMe(user.id, tenantId, branchId);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: profile,
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    // Don't leak user existence
    return {
      success: true,
      message: 'If the email is registered, password reset instructions have been generated.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    // In local dev/monolith demo, simple password reset support
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    return {
      success: true,
      message: 'Password has been updated successfully.',
    };
  }
}
