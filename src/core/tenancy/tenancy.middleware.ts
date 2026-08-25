import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

const SYSTEM_SUBDOMAINS = new Set([
  'www',
  'api',
  'app',
  'admin',
  'staging',
  'staging-unified',
  'dev',
  'demo',
  'platform',
  'portal',
  'root',
  'superadmin',
  'backend',
  'localhost',
]);

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // 1. Try resolving slug from custom header (useful for development / mobile API calls)
    let slug = (req.headers['x-tenant-slug'] as string)?.trim()?.toLowerCase();

    // 2. If not in header, extract from Host header
    if (!slug && req.headers.host) {
      const host = req.headers.host.split(':')[0].toLowerCase(); // remove port
      const baseDomain = (
        this.configService.get<string>('BASE_DOMAIN') ||
        process.env.BASE_DOMAIN ||
        ''
      ).toLowerCase().trim();

      if (baseDomain) {
        if (host === baseDomain || host === `www.${baseDomain}`) {
          slug = undefined;
        } else if (host.endsWith(`.${baseDomain}`)) {
          const sub = host.slice(0, -(baseDomain.length + 1));
          if (!SYSTEM_SUBDOMAINS.has(sub)) {
            slug = sub;
          }
        }
      }

      if (!slug && !baseDomain) {
        const parts = host.split('.');
        if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
          const sub = parts[0];
          if (!SYSTEM_SUBDOMAINS.has(sub)) {
            slug = sub;
          }
        } else if (parts.length === 3) {
          const sub = parts[0];
          if (!SYSTEM_SUBDOMAINS.has(sub)) {
            slug = sub;
          }
        } else if (parts.length >= 4) {
          const sub = parts[0];
          if (!SYSTEM_SUBDOMAINS.has(sub)) {
            slug = sub;
          }
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
