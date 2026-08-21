import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_MODULE_KEY } from '../decorators/require-module.decorator';
import { PrismaService } from '../../../shared/prisma/prisma.service';

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModules = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredModules || requiredModules.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenant?.id || request.user?.activeTenantId;

    if (!tenantId) {
      // If no tenant context is present, check if super admin
      if (request.user?.isSuperAdmin) {
        return true;
      }
      throw new ForbiddenException('Tenant context is required to access this module');
    }

    // Verify tenant has enabled this module
    const enabledModule = await this.prisma.tenantModule.findFirst({
      where: {
        tenantId,
        moduleKey: { in: requiredModules },
        isEnabled: true,
      },
    });

    if (!enabledModule) {
      throw new ForbiddenException(
        `The requested module (${requiredModules.join(', ')}) is not enabled for this organization.`,
      );
    }

    // If user is logged in and not super admin, check user module access
    if (request.user && !request.user.isSuperAdmin) {
      const userAccess = await this.prisma.userModuleAccess.findFirst({
        where: {
          userId: request.user.id,
          tenantId,
          moduleKey: { in: requiredModules },
          isActive: true,
        },
      });

      if (!userAccess) {
        throw new ForbiddenException(
          `You do not have personal access to module (${requiredModules.join(', ')}).`,
        );
      }
    }

    return true;
  }
}
