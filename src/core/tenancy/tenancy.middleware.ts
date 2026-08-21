import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../shared/prisma/prisma.service';

export interface TenantContext {
  id: string;
  name: string;
  slug: string;
  status: string;
  settings?: any;
  enabledModules: string[];
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext | null;
    }
  }
}

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // 1. Try resolving slug from custom header (useful for development / mobile API calls)
    let slug = (req.headers['x-tenant-slug'] as string)?.trim()?.toLowerCase();

    // 2. If not in header, extract from Host header
    if (!slug && req.headers.host) {
      const host = req.headers.host.split(':')[0]; // remove port
      const parts = host.split('.');

      // If host is subdomain.domain.com or subdomain.localhost (parts.length >= 2)
      if (parts.length > 2 || (parts.length === 2 && parts[1] === 'localhost')) {
        const sub = parts[0];
        if (sub !== 'www' && sub !== 'api' && sub !== 'app') {
          slug = sub.toLowerCase();
        }
      }
    }

    if (slug) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { slug },
        include: {
          modules: {
            where: { isEnabled: true },
          },
        },
      });

      if (tenant) {
        req.tenant = {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
          settings: tenant.settings,
          enabledModules: tenant.modules.map((m) => m.moduleKey),
        };
      }
    }

    next();
  }
}
