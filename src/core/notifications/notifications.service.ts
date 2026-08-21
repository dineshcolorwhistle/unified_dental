import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
export interface CreateNotificationParams {
  tenantId?: string;
  userId: string;
  moduleKey?: string;
  type: string;
  title: string;
  body: string;
  data?: any;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async create(params: CreateNotificationParams) {
    const record = await this.prisma.notification.create({
      data: {
        tenantId: params.tenantId || null,
        userId: params.userId,
        moduleKey: params.moduleKey || null,
        type: params.type || 'SYSTEM',
        title: params.title,
        body: params.body,
        data: params.data || {},
      },
    });

    // Stream real-time event to connected user
    this.gateway.sendToUser(params.userId, 'notification:new', record);

    return record;
  }

  async findAllForUser(userId: string, tenantId?: string, unreadOnly = false) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
        tenantId: tenantId || undefined,
        readAt: unreadOnly ? null : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await this.prisma.notification.count({
      where: {
        userId,
        tenantId: tenantId || undefined,
        readAt: null,
      },
    });

    return {
      notifications,
      unreadCount,
    };
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string, tenantId?: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        tenantId: tenantId || undefined,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }
}
