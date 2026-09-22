import api from './api';

export interface SubscriptionQuotaItem {
  allocated: number;
  used: number;
  remaining: number;
  percentage: number;
}

export interface SubscriptionModulesQuota {
  allocated: number;
  used: number;
  enabledList: string[];
}

export interface SubscriptionPlanData {
  id: string | null;
  code: string;
  name: string;
  price: number | string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface SubscriptionQuotas {
  branches: SubscriptionQuotaItem;
  members: SubscriptionQuotaItem;
  modules: SubscriptionModulesQuota;
}

export interface SubscriptionSectionData {
  plan: SubscriptionPlanData;
  quotas: SubscriptionQuotas;
}

export interface LabBranchesSummary {
  totalLabBranches: number;
  activeLabBranches: number;
}

export interface LabKpisSummary {
  totalWorkOrders: number;
  activeOrders: number;
  inProgressOrders: number;
  pendingVerifications: number;
  completedOrders: number;
  totalTechnicians: number;
}

export interface LabModuleSectionData {
  moduleKey: 'LAB';
  branches: LabBranchesSummary;
  kpis: LabKpisSummary;
}

export interface GenericModuleSectionData {
  moduleKey: string;
  branches: {
    totalBranches: number;
    activeBranches: number;
  };
  kpis: Record<string, any>;
}

export interface TenantAdminDashboardResponse {
  subscription: SubscriptionSectionData;
  module: LabModuleSectionData | GenericModuleSectionData;
}

export const tenantDashboardService = {
  async getDashboard(moduleKey = 'LAB'): Promise<TenantAdminDashboardResponse> {
    const res = await api.get<TenantAdminDashboardResponse>('/tenants/admin/dashboard', {
      params: { moduleKey },
    });
    return res.data;
  },
};
