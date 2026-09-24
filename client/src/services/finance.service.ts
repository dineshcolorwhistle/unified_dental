import api from './api';

// ──────────────── Types ────────────────

export interface FinanceOverviewKpis {
  totalRevenue: number;
  totalCollected: number;
  outstanding: number;
  collectionPercentage: number;
  pendingPayments: number;
}

export interface MonthlyTrendPoint {
  month: string;
  quoted: number;
  collected: number;
}

export interface PaymentDistribution {
  totalOrders: number;
  paidCount: number;
  pendingCount: number;
  paidPercentage: number;
  pendingPercentage: number;
}

export interface BranchPerformanceItem {
  branchId: string;
  branchName: string;
  quoted: number;
  collected: number;
  outstanding: number;
  collectionPercentage: number;
  paidCount: number;
  pendingCount: number;
}

export interface BranchCharts {
  revenueByBranch: { branchName: string; revenue: number }[];
  collectionsVsOutstandingByBranch: { branchName: string; collected: number; outstanding: number }[];
}

export interface FinanceOverviewResponse {
  kpis: FinanceOverviewKpis;
  monthlyTrend: MonthlyTrendPoint[];
  paymentDistribution: PaymentDistribution;
  branchPerformance: BranchPerformanceItem[];
  branchCharts: BranchCharts | null;
  isAllBranches: boolean;
}

export interface DoctorBalanceItem {
  id: string;
  name: string;
  clinicName: string | null;
  totalOrders: number;
  quoted: number;
  collected: number;
  outstanding: number;
  pendingCount: number;
  status: 'PENDING' | 'SETTLED';
}

export interface DoctorBalancesKpis {
  totalOutstandingBalance: number;
  doctorsWithPending: number;
  totalDoctors: number;
  quotedRevenue: number;
  totalCollected: number;
}

export interface DoctorBalancesSubtotal {
  totalOrders: number;
  quoted: number;
  collected: number;
  outstanding: number;
}

export interface DoctorBalancesResponse {
  kpis: DoctorBalancesKpis;
  items: DoctorBalanceItem[];
  subtotal: DoctorBalancesSubtotal;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface DoctorOrderItem {
  id: string;
  folioNumber: string;
  patient: string;
  prosthesisType: string;
  quoted: number;
  collected: number;
  outstanding: number;
  status: 'PENDING' | 'SETTLED';
  createdAt: string;
}

export interface DoctorOrdersResponse {
  doctor: {
    id: string;
    name: string;
    clinicName: string | null;
  };
  summary: {
    quoted: number;
    collected: number;
    outstanding: number;
  };
  counts: {
    pending: number;
    all: number;
  };
  orders: DoctorOrderItem[];
}

export interface DoctorListFinanceItem {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  totalOrders: number;
  quoted: number;
  collected: number;
  outstanding: number;
  pendingCount: number;
  status: 'PENDING' | 'SETTLED';
}

export interface DoctorListsKpis {
  totalOutstandingBalance: number;
  listsWithPending: number;
  totalLists: number;
  quotedRevenue: number;
  totalCollected: number;
}

export interface DoctorListsSubtotal {
  totalMembers: number;
  totalOrders: number;
  quoted: number;
  collected: number;
  outstanding: number;
}

export interface DoctorListsResponse {
  kpis: DoctorListsKpis;
  items: DoctorListFinanceItem[];
  subtotal: DoctorListsSubtotal;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface DoctorListBreakdownMember {
  id: string;
  name: string;
  clinicName: string | null;
  totalOrders: number;
  quoted: number;
  collected: number;
  outstanding: number;
}

export interface DoctorListBreakdownResponse {
  list: {
    id: string;
    name: string;
    description: string | null;
  };
  summary: {
    quoted: number;
    collected: number;
    outstanding: number;
  };
  members: DoctorListBreakdownMember[];
}

export interface MarkAsPaidResponse {
  success: boolean;
  orderId: string;
  folioNumber: string;
  amountPaid: number;
  newTotalPaid: number;
}

// ──────────────── API Service ────────────────

export const financeService = {
  getOverview: async (params: {
    branchId?: string;
    moduleKey?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<FinanceOverviewResponse> => {
    const { data } = await api.get('/finance/overview', { params });
    return data;
  },

  getDoctorBalances: async (params: {
    branchId?: string;
    moduleKey?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    onlyPending?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<DoctorBalancesResponse> => {
    const { data } = await api.get('/finance/doctor-balances', { params });
    return data;
  },

  getDoctorOrders: async (
    doctorId: string,
    params: {
      filter?: 'pending' | 'all';
      branchId?: string;
      moduleKey?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<DoctorOrdersResponse> => {
    const { data } = await api.get(`/finance/doctor-balances/${doctorId}/orders`, { params });
    return data;
  },

  markOrderAsPaid: async (orderId: string): Promise<MarkAsPaidResponse> => {
    const { data } = await api.post(`/finance/orders/${orderId}/mark-as-paid`);
    return data;
  },

  getDoctorLists: async (params: {
    branchId?: string;
    moduleKey?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<DoctorListsResponse> => {
    const { data } = await api.get('/finance/doctor-lists', { params });
    return data;
  },

  getDoctorListBreakdown: async (
    listId: string,
    params?: {
      moduleKey?: string;
      branchId?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<DoctorListBreakdownResponse> => {
    const { data } = await api.get(`/finance/doctor-lists/${listId}/breakdown`, { params });
    return data;
  },
};
