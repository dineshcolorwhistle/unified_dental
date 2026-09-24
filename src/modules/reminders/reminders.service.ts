import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { QueryRemindersDto } from './dto/query-reminders.dto';
import { parseCalendarDate, DEFAULT_TIMEZONE } from '../../shared/common/utils/timezone.util';
import { ReminderPriority, ReminderRecurrence, ReminderEndType } from '@prisma/client';

export interface CandidateAssignee {
  id: string; // "u:<userId>" or "d:<doctorId>"
  type: 'USER' | 'DOCTOR';
  rawId: string;
  name: string;
  email: string | null;
  profession: string; // 'Tenant Admin' | 'Lab Admin' | 'Technician' | 'Doctor'
  label: string; // e.g. "Dr. Roberto Silva (Doctor)"
}

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to verify if the actor is a Tenant Administrator or Super Admin
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
   * Helper to verify if the actor has Lab Administrator privileges
   */
  async isLabAdmin(actor: AuthenticatedUser, tenantId: string): Promise<boolean> {
    if (actor.isSuperAdmin) return true;

    const hasLabRole = actor.roles?.some((r: string) => {
      const lower = r.toLowerCase();
      return lower === 'lab-admin' || lower.includes('lab admin') || lower.includes('lab administrator');
    });
    if (hasLabRole) return true;

    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: { slug: { in: ['lab-admin', 'lab_admin'] } },
      },
    });

    return Boolean(userRole);
  }

  /**
   * Get all eligible assignees: Tenant Admins, Lab Admins, Technicians, and Doctors
   * Each entry includes their Name and Profession formatted for multi-select dropdown.
   */
  async getCandidateAssignees(tenantId: string, actor: AuthenticatedUser): Promise<CandidateAssignee[]> {
    const candidates: CandidateAssignee[] = [];
    const seenIds = new Set<string>();

    // 1. Fetch system users (Admins & Technicians) belonging to this tenant
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: {
        user: {
          include: {
            userRoles: {
              where: { tenantId },
              include: { role: true },
            },
          },
        },
      },
    });

    for (const mem of memberships) {
      const u = mem.user;
      if (!u || seenIds.has(`u:${u.id}`)) continue;
      seenIds.add(`u:${u.id}`);

      // Determine profession
      let profession = 'Technician';
      const roleSlugs = u.userRoles.map((ur) => ur.role.slug.toLowerCase());

      if (mem.isOwner || roleSlugs.includes('tenant-admin') || roleSlugs.includes('admin')) {
        profession = 'Tenant Admin';
      } else if (roleSlugs.includes('lab-admin')) {
        profession = 'Lab Admin';
      } else if (roleSlugs.includes('technician') || roleSlugs.includes('tech')) {
        profession = 'Technician';
      } else if (u.isSuperAdmin) {
        profession = 'Tenant Admin';
      }

      candidates.push({
        id: `u:${u.id}`,
        type: 'USER',
        rawId: u.id,
        name: u.name,
        email: u.email,
        profession,
        label: `${u.name} (${profession})`,
      });
    }

    // 2. Fetch all active Doctors in the tenant
    const doctors = await this.prisma.doctor.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });

    for (const doc of doctors) {
      if (seenIds.has(`d:${doc.id}`)) continue;
      seenIds.add(`d:${doc.id}`);

      const profession = 'Doctor';
      candidates.push({
        id: `d:${doc.id}`,
        type: 'DOCTOR',
        rawId: doc.id,
        name: doc.name,
        email: doc.email || null,
        profession,
        label: `${doc.name} (${profession})`,
      });
    }

    // Sort alphabetically by name
    return candidates.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * List reminders with filters, search, pagination, and multi-tenant scoping
   */
  async findAll(query: QueryRemindersDto, tenantId: string, actor: AuthenticatedUser) {
    const {
      page = 1,
      limit = 20,
      search,
      priority,
      recurrence,
      category,
      branchId,
      moduleKey,
      status = 'all',
    } = query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {
      tenantId,
    };

    if (moduleKey && moduleKey !== 'all' && moduleKey !== 'ALL') {
      where.moduleKey = moduleKey;
    }

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    if (branchId && branchId !== 'all') {
      where.branchId = branchId;
    }

    if (priority) {
      where.priority = priority;
    }

    if (recurrence) {
      where.recurrence = recurrence;
    }

    if (category && category.trim()) {
      where.category = { contains: category.trim(), mode: 'insensitive' };
    }

    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: 'insensitive' } },
        { category: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
        { assignees: { some: { name: { contains: search.trim(), mode: 'insensitive' } } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.reminder.findMany({
        where,
        skip,
        take,
        orderBy: [{ startDate: 'desc' }, { reminderTime: 'asc' }],
        include: {
          assignees: true,
          branch: { select: { id: true, name: true, code: true } },
          creator: { select: { id: true, name: true, email: true } },
          _count: { select: { notificationLogs: true } },
        },
      }),
      this.prisma.reminder.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / take) || 1,
      },
    };
  }

  /**
   * Find single reminder by ID
   */
  async findOne(id: string, tenantId: string, actor: AuthenticatedUser) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id, tenantId },
      include: {
        assignees: true,
        branch: { select: { id: true, name: true, code: true } },
        creator: { select: { id: true, name: true, email: true } },
        notificationLogs: {
          orderBy: { scheduledAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!reminder) {
      throw new NotFoundException(`Reminder with ID '${id}' not found`);
    }

    return reminder;
  }

  /**
   * Resolve and map candidate assignees from string array (e.g. ["u:123", "d:456"])
   */
  private async resolveAssignees(tenantId: string, assigneeIds: string[]) {
    const userIds = assigneeIds
      .filter((id) => id.startsWith('u:'))
      .map((id) => id.replace('u:', ''));
    const doctorIds = assigneeIds
      .filter((id) => id.startsWith('d:'))
      .map((id) => id.replace('d:', ''));

    const [users, doctors] = await Promise.all([
      userIds.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            include: {
              memberships: { where: { tenantId } },
              userRoles: { where: { tenantId }, include: { role: true } },
            },
          })
        : [],
      doctorIds.length > 0
        ? this.prisma.doctor.findMany({
            where: { id: { in: doctorIds }, tenantId },
          })
        : [],
    ]);

    const assigneesData: Array<{
      userId?: string;
      doctorId?: string;
      name: string;
      email?: string | null;
      profession: string;
    }> = [];

    for (const u of users) {
      let profession = 'Technician';
      const roleSlugs = u.userRoles.map((ur) => ur.role.slug.toLowerCase());
      const isOwner = u.memberships?.some((m) => m.isOwner);

      if (isOwner || roleSlugs.includes('tenant-admin') || roleSlugs.includes('admin') || u.isSuperAdmin) {
        profession = 'Tenant Admin';
      } else if (roleSlugs.includes('lab-admin')) {
        profession = 'Lab Admin';
      } else {
        profession = 'Technician';
      }

      assigneesData.push({
        userId: u.id,
        name: u.name,
        email: u.email,
        profession,
      });
    }

    for (const d of doctors) {
      assigneesData.push({
        doctorId: d.id,
        name: d.name,
        email: d.email || null,
        profession: 'Doctor',
      });
    }

    return assigneesData;
  }

  /**
   * Create a new Reminder
   * STRICT BOUNDARY: Lab Admin ONLY. Tenant Admin is strictly prohibited.
   */
  async create(dto: CreateReminderDto, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isLabAdminUser = await this.isLabAdmin(actor, tenantId);

    // If actor is Tenant Admin and NOT Lab Admin, strictly forbid creation
    if (isTenantAdminUser && !isLabAdminUser) {
      throw new ForbiddenException(
        'Tenant Administrators cannot create operational reminders. Creation is reserved for Lab Administrators.',
      );
    }

    if (!dto.assigneeIds || dto.assigneeIds.length === 0) {
      throw new BadRequestException('At least one assignee is required for the reminder.');
    }

    const assigneesData = await this.resolveAssignees(tenantId, dto.assigneeIds);
    if (assigneesData.length === 0) {
      throw new BadRequestException('No valid assignees found from the selected options.');
    }

    const parsedStartDate = parseCalendarDate(dto.startDate);
    const parsedEndDate = dto.endDate ? parseCalendarDate(dto.endDate) : null;

    // Validate 3 years range
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 3);
    if (parsedStartDate.getTime() > maxDate.getTime()) {
      throw new BadRequestException('Start date cannot be beyond 3 years from today.');
    }

    const reminder = await this.prisma.reminder.create({
      data: {
        tenantId,
        branchId: dto.branchId || null,
        moduleKey: dto.moduleKey || 'LAB',
        title: dto.title.trim(),
        priority: dto.priority || ReminderPriority.MEDIUM,
        category: dto.category ? dto.category.trim() : null,
        description: dto.description ? dto.description.trim() : null,
        recurrence: dto.recurrence,
        startDate: parsedStartDate,
        reminderTime: dto.reminderTime,
        recurrenceConfig: (dto.recurrenceConfig as any) || {},
        endType: dto.recurrence === ReminderRecurrence.ONE_TIME ? null : dto.endType || null,
        endDate: dto.recurrence === ReminderRecurrence.ONE_TIME ? null : parsedEndDate,
        endOccurrences: dto.recurrence === ReminderRecurrence.ONE_TIME ? null : dto.endOccurrences || null,
        createdBy: actor.id,
        assignees: {
          create: assigneesData.map((a) => ({
            userId: a.userId,
            doctorId: a.doctorId,
            name: a.name,
            email: a.email,
            profession: a.profession,
          })),
        },
      },
      include: {
        assignees: true,
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    this.logger.log(`✅ Reminder created: "${reminder.title}" by ${actor.email} for tenant ${tenantId}`);
    return reminder;
  }

  /**
   * Update an existing Reminder
   * STRICT BOUNDARY: Lab Admin ONLY. Tenant Admin is strictly prohibited.
   */
  async update(id: string, dto: UpdateReminderDto, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isLabAdminUser = await this.isLabAdmin(actor, tenantId);

    // If actor is Tenant Admin and NOT Lab Admin, strictly forbid updates
    if (isTenantAdminUser && !isLabAdminUser) {
      throw new ForbiddenException(
        'Tenant Administrators cannot update operational reminders. Updates are reserved for Lab Administrators.',
      );
    }

    const existing = await this.findOne(id, tenantId, actor);

    let assigneesUpdate: any = undefined;
    if (dto.assigneeIds) {
      if (dto.assigneeIds.length === 0) {
        throw new BadRequestException('At least one assignee is required for the reminder.');
      }
      const assigneesData = await this.resolveAssignees(tenantId, dto.assigneeIds);
      if (assigneesData.length === 0) {
        throw new BadRequestException('No valid assignees found from the selected options.');
      }

      assigneesUpdate = {
        deleteMany: {},
        create: assigneesData.map((a) => ({
          userId: a.userId,
          doctorId: a.doctorId,
          name: a.name,
          email: a.email,
          profession: a.profession,
        })),
      };
    }

    const parsedStartDate = dto.startDate ? parseCalendarDate(dto.startDate) : undefined;
    const parsedEndDate = dto.endDate !== undefined ? (dto.endDate ? parseCalendarDate(dto.endDate) : null) : undefined;

    const updated = await this.prisma.reminder.update({
      where: { id: existing.id },
      data: {
        title: dto.title !== undefined ? dto.title.trim() : undefined,
        priority: dto.priority !== undefined ? dto.priority : undefined,
        category: dto.category !== undefined ? (dto.category ? dto.category.trim() : null) : undefined,
        description: dto.description !== undefined ? (dto.description ? dto.description.trim() : null) : undefined,
        recurrence: dto.recurrence !== undefined ? dto.recurrence : undefined,
        startDate: parsedStartDate,
        reminderTime: dto.reminderTime !== undefined ? dto.reminderTime : undefined,
        recurrenceConfig: dto.recurrenceConfig !== undefined ? (dto.recurrenceConfig as any) : undefined,
        endType: dto.endType !== undefined ? dto.endType : undefined,
        endDate: parsedEndDate,
        endOccurrences: dto.endOccurrences !== undefined ? dto.endOccurrences : undefined,
        branchId: dto.branchId !== undefined ? (dto.branchId || null) : undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
        assignees: assigneesUpdate,
      },
      include: {
        assignees: true,
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    this.logger.log(`✅ Reminder updated: "${updated.title}" by ${actor.email}`);
    return updated;
  }

  /**
   * Delete a Reminder
   * STRICT BOUNDARY: Tenant Admin ONLY. Lab Admin is strictly prohibited from deleting.
   */
  async remove(id: string, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);

    // Only Tenant Admin can delete!
    if (!isTenantAdminUser) {
      throw new ForbiddenException(
        'Only Tenant Administrators have the authority to delete reminders. Lab Administrators cannot delete reminders.',
      );
    }

    const existing = await this.findOne(id, tenantId, actor);

    await this.prisma.reminder.delete({
      where: { id: existing.id },
    });

    this.logger.log(`🗑️ Reminder deleted: "${existing.title}" by Tenant Admin ${actor.email}`);
    return { success: true, message: 'Reminder deleted successfully', id };
  }
}
