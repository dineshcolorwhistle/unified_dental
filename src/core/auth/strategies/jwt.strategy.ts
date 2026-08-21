import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../shared/prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  isSuperAdmin: boolean;
  tenantId?: string;
  branchId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'unified-dental-secure-jwt-secret-key-2026',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        memberships: {
          include: { tenant: true },
        },
        userBranches: {
          include: { branch: true },
        },
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

    if (!user || user.status === 'INACTIVE') {
      throw new UnauthorizedException('User account not found or inactive');
    }

    // Collect permissions for the active tenant/branch context
    const tenantId = payload.tenantId;
    const branchId = payload.branchId;

    const filteredRoles = user.userRoles.filter((ur) => {
      if (user.isSuperAdmin) return true;
      if (!tenantId) return true;
      if (ur.tenantId !== tenantId) return false;
      if (ur.branchId && branchId && ur.branchId !== branchId) return false;
      return true;
    });

    const permissionKeys = new Set<string>();
    const roleNames: string[] = [];

    if (user.isSuperAdmin) {
      permissionKeys.add('*');
    }

    for (const ur of filteredRoles) {
      roleNames.push(ur.role.name);
      for (const rp of ur.role.rolePermissions) {
        permissionKeys.add(rp.permission.key);
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
      locale: user.locale,
      activeTenantId: tenantId,
      activeBranchId: branchId,
      roles: roleNames,
      permissions: Array.from(permissionKeys),
      memberships: user.memberships.map((m) => ({
        tenantId: m.tenantId,
        tenantName: m.tenant.name,
        tenantSlug: m.tenant.slug,
        isOwner: m.isOwner,
        status: m.status,
      })),
      branches: user.userBranches.map((ub) => ({
        branchId: ub.branchId,
        branchName: ub.branch.name,
        isDefault: ub.isDefault,
      })),
    };
  }
}
