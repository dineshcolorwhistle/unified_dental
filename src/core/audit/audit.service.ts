import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
export interface CreateAuditLogParams {
  tenantId?: string;
  branchId?: string;
  moduleKey?: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: CreateAuditLogParams) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          tenantId: params.tenantId || null,
          branchId: params.branchId || null,
          moduleKey: params.moduleKey || null,
          userId: params.userId || null,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId || null,
          oldValues: params.oldValues || undefined,
          newValues: params.newValues || undefined,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
        },
      });
    } catch (e) {
      console.error('Failed to write audit log:', e);
      return null;
    }
  }

  async findAll(tenantId?: string, limit = 50, page = 1) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: tenantId ? { tenantId } : undefined,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          branch: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.auditLog.count({
        where: tenantId ? { tenantId } : undefined,
      }),
    ]);

    return {
      logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
