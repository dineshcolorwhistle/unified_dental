import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';
import {
  QueryFinanceOverviewDto,
  QueryDoctorBalancesDto,
  QueryDoctorListsDto,
  QueryDoctorOrdersDto,
} from './dto';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ──────────────── Role Helpers ────────────────

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

  async isLabAdmin(actor: AuthenticatedUser, tenantId: string): Promise<boolean> {
    const hasLabAdminRole = actor.roles?.some((r: string) => {
      const lower = r.toLowerCase();
      return lower === 'lab-admin' || lower.includes('lab administrator');
    });
    if (hasLabAdminRole) return true;

    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: { slug: { in: ['lab-admin'] } },
      },
    });

    return Boolean(userRole);
  }

  /**
   * Resolve branch for the actor. Lab Admins get their assigned branch.
   */
  async resolveBranch(
    actor: AuthenticatedUser,
    tenantId: string,
    moduleKey?: string,
  ): Promise<string> {
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        branch: moduleKey ? { tenantId, moduleKey } : { tenantId },
      },
      include: { branch: true },
    });

    if (userRole?.branchId) {
      return userRole.branchId;
    }

    const userBranch = await this.prisma.userBranch.findFirst({
      where: {
        userId: actor.id,
        branch: moduleKey ? { tenantId, moduleKey } : { tenantId },
      },
    });

    if (userBranch?.branchId) {
      return userBranch.branchId;
    }

    throw new ForbiddenException(
      moduleKey
        ? `User is not assigned to any ${moduleKey} branch.`
        : 'User is not assigned to any branch in this organization.',
    );
  }

  // ──────────────── Date Helpers ────────────────

  private buildDateFilter(startDate?: string, endDate?: string): any {
    const filter: any = {};
    if (startDate) {
      const sMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(startDate);
      if (sMatch) {
        filter.gte = new Date(Date.UTC(
          parseInt(sMatch[1], 10), parseInt(sMatch[2], 10) - 1, parseInt(sMatch[3], 10),
          0, 0, 0, 0,
        ));
      }
    }
    if (endDate) {
      const eMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(endDate);
      if (eMatch) {
        filter.lte = new Date(Date.UTC(
          parseInt(eMatch[1], 10), parseInt(eMatch[2], 10) - 1, parseInt(eMatch[3], 10),
          23, 59, 59, 999,
        ));
      }
    }
    return Object.keys(filter).length ? filter : undefined;
  }

  // ──────────────── OVERVIEW ────────────────

  async getOverview(
    query: QueryFinanceOverviewDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isLabAdminUser = await this.isLabAdmin(actor, tenantId);

    if (!isTenantAdminUser && !isLabAdminUser) {
      throw new ForbiddenException('You do not have permission to access finance reports.');
    }

    const moduleKey = query.moduleKey || 'LAB';

    // Resolve branch scoping
    let branchFilter: any = {};
    let isAllBranches = false;
    if (isTenantAdminUser) {
      if (!query.branchId || query.branchId === 'all') {
        isAllBranches = true;
        // No branch filter for cross-branch view
      } else {
        branchFilter = { branchId: query.branchId };
      }
    } else {
      // Lab Admin: forced to assigned branch
      const assignedBranchId = await this.resolveBranch(actor, tenantId, moduleKey);
      branchFilter = { branchId: assignedBranchId };
    }

    const dateFilter = this.buildDateFilter(query.startDate, query.endDate);
    const where: any = {
      tenantId,
      moduleKey,
      ...branchFilter,
    };
    if (dateFilter) {
      where.createdAt = dateFilter;
    }

    // Get all work orders in scope
    const workOrders = await this.prisma.workOrder.findMany({
      where,
      select: {
        id: true,
        branchId: true,
        totalQuote: true,
        createdAt: true,
        payments: {
          select: { amount: true, status: true },
        },
        branch: { select: { id: true, name: true } },
      },
    });

    // Compute KPIs
    let totalRevenue = 0;
    let totalCollected = 0;
    let pendingPaymentsCount = 0;
    let paidCount = 0;

    for (const wo of workOrders) {
      const quoted = Number(wo.totalQuote || 0);
      totalRevenue += quoted;

      const collected = wo.payments
        .filter((p) => p.status === 'SETTLED')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      totalCollected += collected;

      if (collected >= quoted && quoted > 0) {
        paidCount++;
      } else if (quoted > 0) {
        pendingPaymentsCount++;
      } else {
        // Zero-quoted orders: if no outstanding, treat as settled
        pendingPaymentsCount++;
      }
    }

    const outstanding = Math.max(0, totalRevenue - totalCollected);
    const collectionPercentage =
      totalRevenue > 0 ? Math.round((totalCollected / totalRevenue) * 1000) / 10 : 0;

    // Monthly trend (last 12 months if no date range, or within date range)
    const monthlyMap = new Map<string, { quoted: number; collected: number }>();
    for (const wo of workOrders) {
      const d = new Date(wo.createdAt);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const existing = monthlyMap.get(key) || { quoted: 0, collected: 0 };
      existing.quoted += Number(wo.totalQuote || 0);
      existing.collected += wo.payments
        .filter((p) => p.status === 'SETTLED')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      monthlyMap.set(key, existing);
    }

    const monthlyTrend = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        quoted: Math.round(data.quoted * 100) / 100,
        collected: Math.round(data.collected * 100) / 100,
      }));

    // Payment distribution
    const totalOrders = workOrders.length;
    const paymentDistribution = {
      totalOrders,
      paidCount,
      pendingCount: pendingPaymentsCount,
      paidPercentage: totalOrders > 0 ? Math.round((paidCount / totalOrders) * 1000) / 10 : 0,
      pendingPercentage:
        totalOrders > 0
          ? Math.round((pendingPaymentsCount / totalOrders) * 1000) / 10
          : 0,
    };

    // Branch performance (only for tenant admin "all branches" mode)
    let branchPerformance: any[] = [];
    let branchCharts: any = null;

    if (isAllBranches && isTenantAdminUser) {
      const branchMap = new Map<
        string,
        {
          branchId: string;
          branchName: string;
          quoted: number;
          collected: number;
          paidCount: number;
          pendingCount: number;
        }
      >();

      for (const wo of workOrders) {
        const bId = wo.branchId;
        const bName = wo.branch?.name || 'Unknown';
        const existing = branchMap.get(bId) || {
          branchId: bId,
          branchName: bName,
          quoted: 0,
          collected: 0,
          paidCount: 0,
          pendingCount: 0,
        };

        const quoted = Number(wo.totalQuote || 0);
        existing.quoted += quoted;

        const collected = wo.payments
          .filter((p) => p.status === 'SETTLED')
          .reduce((sum, p) => sum + Number(p.amount || 0), 0);
        existing.collected += collected;

        if (collected >= quoted && quoted > 0) {
          existing.paidCount++;
        } else {
          existing.pendingCount++;
        }

        branchMap.set(bId, existing);
      }

      // Include branches with zero orders too
      const activeBranches = await this.prisma.branch.findMany({
        where: { tenantId, moduleKey, status: 'ACTIVE' },
        select: { id: true, name: true },
      });

      for (const branch of activeBranches) {
        if (!branchMap.has(branch.id)) {
          branchMap.set(branch.id, {
            branchId: branch.id,
            branchName: branch.name,
            quoted: 0,
            collected: 0,
            paidCount: 0,
            pendingCount: 0,
          });
        }
      }

      branchPerformance = Array.from(branchMap.values()).map((bp) => ({
        branchId: bp.branchId,
        branchName: bp.branchName,
        quoted: Math.round(bp.quoted * 100) / 100,
        collected: Math.round(bp.collected * 100) / 100,
        outstanding: Math.round(Math.max(0, bp.quoted - bp.collected) * 100) / 100,
        collectionPercentage:
          bp.quoted > 0 ? Math.round((bp.collected / bp.quoted) * 1000) / 10 : 0,
        paidCount: bp.paidCount,
        pendingCount: bp.pendingCount,
      }));

      branchCharts = {
        revenueByBranch: branchPerformance.map((bp) => ({
          branchName: bp.branchName,
          revenue: bp.quoted,
        })),
        collectionsVsOutstandingByBranch: branchPerformance.map((bp) => ({
          branchName: bp.branchName,
          collected: bp.collected,
          outstanding: bp.outstanding,
        })),
      };
    }

    return {
      kpis: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCollected: Math.round(totalCollected * 100) / 100,
        outstanding: Math.round(outstanding * 100) / 100,
        collectionPercentage,
        pendingPayments: pendingPaymentsCount,
      },
      monthlyTrend,
      paymentDistribution,
      branchPerformance,
      branchCharts,
      isAllBranches,
    };
  }

  // ──────────────── DOCTOR BALANCES ────────────────

  async getDoctorBalances(
    query: QueryDoctorBalancesDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isLabAdminUser = await this.isLabAdmin(actor, tenantId);

    if (!isTenantAdminUser && !isLabAdminUser) {
      throw new ForbiddenException('You do not have permission to access finance reports.');
    }

    const moduleKey = query.moduleKey || 'LAB';

    // Branch scoping
    let branchFilter: any = {};
    if (!isTenantAdminUser) {
      const assignedBranchId = await this.resolveBranch(actor, tenantId, moduleKey);
      branchFilter = { branchId: assignedBranchId };
    } else if (query.branchId && query.branchId !== 'all') {
      branchFilter = { branchId: query.branchId };
    }

    const dateFilter = this.buildDateFilter(query.startDate, query.endDate);

    // Fetch all doctors in scope
    const doctorWhere: any = {
      tenantId,
      moduleKey,
      ...branchFilter,
      isActive: true,
    };

    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      doctorWhere.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { clinicName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const allDoctors = await this.prisma.doctor.findMany({
      where: doctorWhere,
      select: {
        id: true,
        name: true,
        clinicName: true,
      },
    });

    // Get work orders for these doctors
    const woWhere: any = {
      tenantId,
      moduleKey,
      ...branchFilter,
      doctorId: { in: allDoctors.map((d) => d.id) },
    };
    if (dateFilter) {
      woWhere.createdAt = dateFilter;
    }

    const workOrders = await this.prisma.workOrder.findMany({
      where: woWhere,
      select: {
        id: true,
        doctorId: true,
        totalQuote: true,
        payments: {
          select: { amount: true, status: true },
        },
      },
    });

    // Aggregate per doctor
    const doctorAggMap = new Map<
      string,
      { totalOrders: number; quoted: number; collected: number }
    >();

    for (const wo of workOrders) {
      const existing = doctorAggMap.get(wo.doctorId) || {
        totalOrders: 0,
        quoted: 0,
        collected: 0,
      };
      existing.totalOrders++;
      existing.quoted += Number(wo.totalQuote || 0);
      existing.collected += wo.payments
        .filter((p) => p.status === 'SETTLED')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      doctorAggMap.set(wo.doctorId, existing);
    }

    // Build result items
    let items = allDoctors.map((doc) => {
      const agg = doctorAggMap.get(doc.id) || { totalOrders: 0, quoted: 0, collected: 0 };
      const outstanding = Math.max(0, agg.quoted - agg.collected);
      const pendingCount = workOrders.filter((wo) => {
        if (wo.doctorId !== doc.id) return false;
        const q = Number(wo.totalQuote || 0);
        const c = wo.payments
          .filter((p) => p.status === 'SETTLED')
          .reduce((sum, p) => sum + Number(p.amount || 0), 0);
        return c < q;
      }).length;

      return {
        id: doc.id,
        name: doc.name,
        clinicName: doc.clinicName || null,
        totalOrders: agg.totalOrders,
        quoted: Math.round(agg.quoted * 100) / 100,
        collected: Math.round(agg.collected * 100) / 100,
        outstanding: Math.round(outstanding * 100) / 100,
        pendingCount,
        status: outstanding > 0 ? 'PENDING' : 'SETTLED',
      };
    });

    // Filter only pending if requested
    if (query.onlyPending) {
      items = items.filter((i) => i.outstanding > 0);
    }

    // Sort by outstanding descending
    items.sort((a, b) => b.outstanding - a.outstanding);

    // Compute subtotal
    const subtotal = {
      totalOrders: items.reduce((s, i) => s + i.totalOrders, 0),
      quoted: Math.round(items.reduce((s, i) => s + i.quoted, 0) * 100) / 100,
      collected: Math.round(items.reduce((s, i) => s + i.collected, 0) * 100) / 100,
      outstanding: Math.round(items.reduce((s, i) => s + i.outstanding, 0) * 100) / 100,
    };

    // KPIs
    const totalDoctors = allDoctors.length;
    const doctorsWithPending = allDoctors.filter((d) => {
      const agg = doctorAggMap.get(d.id);
      if (!agg) return false;
      return agg.quoted - agg.collected > 0;
    }).length;

    const kpis = {
      totalOutstandingBalance: subtotal.outstanding,
      doctorsWithPending,
      totalDoctors,
      quotedRevenue: subtotal.quoted,
      totalCollected: subtotal.collected,
    };

    // Pagination
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Number(query.pageSize) || 20);
    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const paginatedItems = items.slice((page - 1) * pageSize, page * pageSize);

    return {
      kpis,
      items: paginatedItems,
      subtotal,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  // ──────────────── DOCTOR ORDERS ────────────────

  async getDoctorOrders(
    doctorId: string,
    query: QueryDoctorOrdersDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isLabAdminUser = await this.isLabAdmin(actor, tenantId);

    if (!isTenantAdminUser && !isLabAdminUser) {
      throw new ForbiddenException('You do not have permission to access finance reports.');
    }

    const moduleKey = query.moduleKey || 'LAB';

    // Verify doctor exists
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, tenantId },
      select: { id: true, name: true, clinicName: true },
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID "${doctorId}" not found.`);
    }

    // Branch scoping
    let branchFilter: any = {};
    if (!isTenantAdminUser) {
      const assignedBranchId = await this.resolveBranch(actor, tenantId, moduleKey);
      branchFilter = { branchId: assignedBranchId };
    } else if (query.branchId && query.branchId !== 'all') {
      branchFilter = { branchId: query.branchId };
    }

    const dateFilter = this.buildDateFilter(query.startDate, query.endDate);

    const woWhere: any = {
      tenantId,
      moduleKey,
      doctorId,
      ...branchFilter,
    };
    if (dateFilter) {
      woWhere.createdAt = dateFilter;
    }

    const workOrders = await this.prisma.workOrder.findMany({
      where: woWhere,
      select: {
        id: true,
        folioNumber: true,
        patient: true,
        totalQuote: true,
        createdAt: true,
        payments: {
          select: { id: true, amount: true, status: true, createdAt: true },
        },
        prosthesisType: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute per-order metrics
    const orders = workOrders.map((wo) => {
      const quoted = Number(wo.totalQuote || 0);
      const collected = wo.payments
        .filter((p) => p.status === 'SETTLED')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const orderOutstanding = Math.max(0, quoted - collected);
      return {
        id: wo.id,
        folioNumber: wo.folioNumber,
        patient: wo.patient || '—',
        prosthesisType: wo.prosthesisType?.name || '—',
        quoted: Math.round(quoted * 100) / 100,
        collected: Math.round(collected * 100) / 100,
        outstanding: Math.round(orderOutstanding * 100) / 100,
        status: orderOutstanding > 0 ? 'PENDING' : 'SETTLED',
        createdAt: wo.createdAt,
      };
    });

    // Filter
    const pendingOrders = orders.filter((o) => o.status === 'PENDING');
    const filteredOrders = query.filter === 'pending' ? pendingOrders : orders;

    // Summary
    const totalQuoted = orders.reduce((s, o) => s + o.quoted, 0);
    const totalCollected = orders.reduce((s, o) => s + o.collected, 0);
    const totalOutstanding = Math.max(0, totalQuoted - totalCollected);

    return {
      doctor: {
        id: doctor.id,
        name: doctor.name,
        clinicName: doctor.clinicName || null,
      },
      summary: {
        quoted: Math.round(totalQuoted * 100) / 100,
        collected: Math.round(totalCollected * 100) / 100,
        outstanding: Math.round(totalOutstanding * 100) / 100,
      },
      counts: {
        pending: pendingOrders.length,
        all: orders.length,
      },
      orders: filteredOrders,
    };
  }

  // ──────────────── MARK AS PAID ────────────────

  async markOrderAsPaid(
    orderId: string,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isLabAdminUser = await this.isLabAdmin(actor, tenantId);

    if (!isTenantAdminUser && !isLabAdminUser) {
      throw new ForbiddenException('You do not have permission to record payments.');
    }

    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: orderId, tenantId },
      select: {
        id: true,
        totalQuote: true,
        branchId: true,
        folioNumber: true,
        payments: {
          select: { amount: true, status: true },
        },
      },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order with ID "${orderId}" not found.`);
    }

    // Lab admin branch check
    if (!isTenantAdminUser) {
      const assignedBranchId = await this.resolveBranch(actor, tenantId, 'LAB');
      if (workOrder.branchId !== assignedBranchId) {
        throw new ForbiddenException('You do not have permission to modify this work order.');
      }
    }

    const quoted = Number(workOrder.totalQuote || 0);
    const alreadyCollected = workOrder.payments
      .filter((p) => p.status === 'SETTLED')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const remainingBalance = Math.max(0, quoted - alreadyCollected);

    if (remainingBalance <= 0) {
      throw new BadRequestException('This work order is already fully paid.');
    }

    // Create payment record for the remaining balance
    await this.prisma.workOrderPayment.create({
      data: {
        workOrderId: orderId,
        amount: remainingBalance,
        notes: 'Marked as paid via Finance Module',
        reference: null,
        status: 'SETTLED',
        recordedById: actor.id,
      },
    });

    // Update total paid on workOrder
    const newTotalPaid = alreadyCollected + remainingBalance;
    await this.prisma.workOrder.update({
      where: { id: orderId },
      data: { initialPayment: newTotalPaid },
    });

    return {
      success: true,
      orderId,
      folioNumber: workOrder.folioNumber,
      amountPaid: Math.round(remainingBalance * 100) / 100,
      newTotalPaid: Math.round(newTotalPaid * 100) / 100,
    };
  }

  // ──────────────── DOCTOR LISTS ────────────────

  async getDoctorLists(
    query: QueryDoctorListsDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isLabAdminUser = await this.isLabAdmin(actor, tenantId);

    if (!isTenantAdminUser && !isLabAdminUser) {
      throw new ForbiddenException('You do not have permission to access finance reports.');
    }

    const moduleKey = query.moduleKey || 'LAB';

    // Branch scoping
    let branchFilter: any = {};
    if (!isTenantAdminUser) {
      const assignedBranchId = await this.resolveBranch(actor, tenantId, moduleKey);
      branchFilter = { branchId: assignedBranchId };
    } else if (query.branchId && query.branchId !== 'all') {
      branchFilter = { branchId: query.branchId };
    }

    const dateFilter = this.buildDateFilter(query.startDate, query.endDate);

    // Fetch all doctor lists in scope
    const listWhere: any = {
      tenantId,
      moduleKey,
      ...branchFilter,
    };

    if (query.search && query.search.trim()) {
      listWhere.name = { contains: query.search.trim(), mode: 'insensitive' };
    }

    const lists = await this.prisma.doctorList.findMany({
      where: listWhere,
      select: {
        id: true,
        name: true,
        description: true,
        members: {
          select: {
            doctor: {
              select: { id: true, name: true, clinicName: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // For each list, aggregate financials from member doctors' work orders
    const items = await Promise.all(
      lists.map(async (list) => {
        const memberDoctorIds = list.members.map((m) => m.doctor.id);
        const memberCount = list.members.length;

        if (memberDoctorIds.length === 0) {
          return {
            id: list.id,
            name: list.name,
            description: list.description,
            memberCount,
            totalOrders: 0,
            quoted: 0,
            collected: 0,
            outstanding: 0,
            pendingCount: 0,
            status: 'SETTLED' as const,
          };
        }

        const woWhere: any = {
          tenantId,
          moduleKey,
          ...branchFilter,
          doctorId: { in: memberDoctorIds },
        };
        if (dateFilter) {
          woWhere.createdAt = dateFilter;
        }

        const workOrders = await this.prisma.workOrder.findMany({
          where: woWhere,
          select: {
            id: true,
            totalQuote: true,
            payments: { select: { amount: true, status: true } },
          },
        });

        let totalQuoted = 0;
        let totalCollected = 0;
        let pendingCount = 0;

        for (const wo of workOrders) {
          const q = Number(wo.totalQuote || 0);
          totalQuoted += q;
          const c = wo.payments
            .filter((p) => p.status === 'SETTLED')
            .reduce((sum, p) => sum + Number(p.amount || 0), 0);
          totalCollected += c;
          if (c < q) pendingCount++;
        }

        const outstanding = Math.max(0, totalQuoted - totalCollected);

        return {
          id: list.id,
          name: list.name,
          description: list.description,
          memberCount,
          totalOrders: workOrders.length,
          quoted: Math.round(totalQuoted * 100) / 100,
          collected: Math.round(totalCollected * 100) / 100,
          outstanding: Math.round(outstanding * 100) / 100,
          pendingCount,
          status: (outstanding > 0 ? 'PENDING' : 'SETTLED') as 'PENDING' | 'SETTLED',
        };
      }),
    );

    // Subtotal
    const subtotal = {
      totalMembers: items.reduce((s, i) => s + i.memberCount, 0),
      totalOrders: items.reduce((s, i) => s + i.totalOrders, 0),
      quoted: Math.round(items.reduce((s, i) => s + i.quoted, 0) * 100) / 100,
      collected: Math.round(items.reduce((s, i) => s + i.collected, 0) * 100) / 100,
      outstanding: Math.round(items.reduce((s, i) => s + i.outstanding, 0) * 100) / 100,
    };

    // KPIs
    const totalLists = items.length;
    const listsWithPending = items.filter((i) => i.outstanding > 0).length;

    const kpis = {
      totalOutstandingBalance: subtotal.outstanding,
      listsWithPending,
      totalLists,
      quotedRevenue: subtotal.quoted,
      totalCollected: subtotal.collected,
    };

    // Pagination
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Number(query.pageSize) || 20);
    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const paginatedItems = items.slice((page - 1) * pageSize, page * pageSize);

    return {
      kpis,
      items: paginatedItems,
      subtotal,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  // ──────────────── DOCTOR LIST BREAKDOWN ────────────────

  async getDoctorListBreakdown(
    listId: string,
    tenantId: string,
    actor: AuthenticatedUser,
    moduleKey?: string,
    branchId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const isTenantAdminUser = await this.isTenantAdmin(actor, tenantId);
    const isLabAdminUser = await this.isLabAdmin(actor, tenantId);

    if (!isTenantAdminUser && !isLabAdminUser) {
      throw new ForbiddenException('You do not have permission to access finance reports.');
    }

    const modKey = moduleKey || 'LAB';

    const list = await this.prisma.doctorList.findFirst({
      where: { id: listId, tenantId },
      select: {
        id: true,
        name: true,
        description: true,
        members: {
          select: {
            doctor: {
              select: { id: true, name: true, clinicName: true },
            },
          },
        },
      },
    });

    if (!list) {
      throw new NotFoundException(`Doctor List with ID "${listId}" not found.`);
    }

    // Branch scoping
    let branchFilter: any = {};
    if (!isTenantAdminUser) {
      const assignedBranchId = await this.resolveBranch(actor, tenantId, modKey);
      branchFilter = { branchId: assignedBranchId };
    } else if (branchId && branchId !== 'all') {
      branchFilter = { branchId };
    }

    const dateFilter = this.buildDateFilter(startDate, endDate);

    // Aggregate per member doctor
    const members = await Promise.all(
      list.members.map(async (m) => {
        const woWhere: any = {
          tenantId,
          moduleKey: modKey,
          ...branchFilter,
          doctorId: m.doctor.id,
        };
        if (dateFilter) {
          woWhere.createdAt = dateFilter;
        }

        const workOrders = await this.prisma.workOrder.findMany({
          where: woWhere,
          select: {
            totalQuote: true,
            payments: { select: { amount: true, status: true } },
          },
        });

        let quoted = 0;
        let collected = 0;
        for (const wo of workOrders) {
          quoted += Number(wo.totalQuote || 0);
          collected += wo.payments
            .filter((p) => p.status === 'SETTLED')
            .reduce((sum, p) => sum + Number(p.amount || 0), 0);
        }

        const outstanding = Math.max(0, quoted - collected);

        return {
          id: m.doctor.id,
          name: m.doctor.name,
          clinicName: m.doctor.clinicName || null,
          totalOrders: workOrders.length,
          quoted: Math.round(quoted * 100) / 100,
          collected: Math.round(collected * 100) / 100,
          outstanding: Math.round(outstanding * 100) / 100,
        };
      }),
    );

    // Summary
    const totalQuoted = members.reduce((s, m) => s + m.quoted, 0);
    const totalCollected = members.reduce((s, m) => s + m.collected, 0);
    const totalOutstanding = Math.max(0, totalQuoted - totalCollected);

    return {
      list: {
        id: list.id,
        name: list.name,
        description: list.description,
      },
      summary: {
        quoted: Math.round(totalQuoted * 100) / 100,
        collected: Math.round(totalCollected * 100) / 100,
        outstanding: Math.round(totalOutstanding * 100) / 100,
      },
      members,
    };
  }
}
