import api from './api';

export interface IncomeRecordSummary {
  id: string;
  appointmentId: string;
  status: 'DRAFT' | 'FINALIZED' | 'CANCELLED';
  grandTotal: number | string;
  totalServices: number | string;
  totalProducts: number | string;
  totalDiscount: number | string;
  totalPaid: number | string;
  balanceDue: number | string;
  createdAt: string;
  appointment: {
    id: string;
    appointmentNumber: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    expectedAmount?: number | string | null;
  };
  patient: {
    id: string;
    recordNumber: string;
    firstName: string;
    fatherLastName?: string | null;
    motherLastName?: string | null;
    phoneNumber?: string | null;
  };
  doctor: {
    id: string;
    name: string;
    email: string;
    colorCode?: string | null;
  };
  createdBy: {
    id: string;
    name: string;
  };
}

export interface IncomeRecordListResponse {
  records: IncomeRecordSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IncomeServiceLineItem {
  id: string;
  tenantId: string;
  incomeRecordId: string;
  doctorId: string;
  serviceId: string;
  serviceName: string;
  quantity: number;
  unitPrice: number | string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number | string;
  discountAmount: number | string;
  lineTotal: number | string;
  isFromAppointment: boolean;
  isCompleted: boolean;
  completedAt?: string | null;
  completedById?: string | null;
  paymentStatus: 'PENDING' | 'PAID';
  createdAt: string;
  doctor?: { id: string; name: string };
  completedBy?: { id: string; name: string } | null;
  service?: { id: string; name: string; price: number | string };
}

export interface IncomeProductLineItem {
  id: string;
  tenantId: string;
  incomeRecordId: string;
  inventoryItemId: string;
  productName: string;
  quantity: number;
  unitPrice: number | string;
  lineTotal: number | string;
  paymentStatus: 'PENDING' | 'PAID';
  createdAt: string;
  inventoryItem?: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number | string;
    quantity: number;
  };
}

export interface IncomePaymentItem {
  id: string;
  tenantId: string;
  incomeRecordId: string;
  paymentDate: string;
  paymentMethodId: string;
  paymentMethodName: string;
  amount: number | string;
  advanceUsed: number | string;
  advancePaymentId?: string | null;
  allocation: 'SERVICES' | 'PRODUCTS' | 'BOTH';
  notes?: string | null;
  createdAt: string;
  paymentMethod?: { id: string; name: string; type: string };
  advancePayment?: { id: string; receiptNumber: string; balanceRemaining: number | string };
  createdBy?: { id: string; name: string };
}

export interface IncomeAuditItem {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  oldValues?: any;
  newValues?: any;
  description?: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string };
}

export interface IncomeVarianceData {
  expectedAmount: number;
  actualCompletedTotal: number;
  pendingTotal: number;
  difference: number;
  hasVariation: boolean;
  variationType: 'HIGHER' | 'LOWER' | 'EQUAL';
  expectedServicesCount: number;
  completedServicesCount: number;
  pendingServicesCount: number;
  addedServicesCount: number;
  missingExpectedCount: number;
  addedServices: Array<{ name: string; lineTotal: number; isCompleted: boolean }>;
  pendingServices: Array<{ name: string; lineTotal: number }>;
}

export interface IncomeRecordDetail extends IncomeRecordSummary {
  serviceLines: IncomeServiceLineItem[];
  productLines: IncomeProductLineItem[];
  payments: IncomePaymentItem[];
}

export interface QueryIncomeParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  doctorId?: string;
  branchId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const incomeService = {
  getAll: async (params?: QueryIncomeParams): Promise<IncomeRecordListResponse> => {
    const res = await api.get('/clinic/income', { params });
    return res.data;
  },

  getByAppointment: async (appointmentId: string): Promise<IncomeRecordDetail> => {
    const res = await api.get(`/clinic/income/by-appointment/${appointmentId}`);
    return res.data;
  },

  getDetails: async (id: string): Promise<IncomeRecordDetail> => {
    const res = await api.get(`/clinic/income/${id}/details`);
    return res.data;
  },

  addServiceLine: async (
    id: string,
    payload: {
      serviceId: string;
      doctorId?: string;
      quantity?: number;
      unitPrice?: number;
      discountType?: 'PERCENTAGE' | 'FIXED';
      discountValue?: number;
    },
  ): Promise<IncomeRecordDetail> => {
    const res = await api.post(`/clinic/income/${id}/services`, payload);
    return res.data;
  },

  updateServiceLine: async (
    id: string,
    lineId: string,
    payload: {
      quantity?: number;
      unitPrice?: number;
      discountType?: 'PERCENTAGE' | 'FIXED';
      discountValue?: number;
    },
  ): Promise<IncomeRecordDetail> => {
    const res = await api.patch(`/clinic/income/${id}/services/${lineId}`, payload);
    return res.data;
  },

  toggleServiceComplete: async (id: string, lineId: string): Promise<IncomeRecordDetail> => {
    const res = await api.patch(`/clinic/income/${id}/services/${lineId}/complete`);
    return res.data;
  },

  removeServiceLine: async (id: string, lineId: string): Promise<IncomeRecordDetail> => {
    const res = await api.delete(`/clinic/income/${id}/services/${lineId}`);
    return res.data;
  },

  addProductLine: async (
    id: string,
    payload: {
      inventoryItemId: string;
      quantity?: number;
      unitPrice?: number;
    },
  ): Promise<IncomeRecordDetail> => {
    const res = await api.post(`/clinic/income/${id}/products`, payload);
    return res.data;
  },

  updateProductLine: async (
    id: string,
    lineId: string,
    payload: {
      quantity: number;
      unitPrice?: number;
    },
  ): Promise<IncomeRecordDetail> => {
    const res = await api.patch(`/clinic/income/${id}/products/${lineId}`, payload);
    return res.data;
  },

  removeProductLine: async (id: string, lineId: string): Promise<IncomeRecordDetail> => {
    const res = await api.delete(`/clinic/income/${id}/products/${lineId}`);
    return res.data;
  },

  addPayment: async (
    id: string,
    payload: {
      paymentMethodId: string;
      amount: number;
      paymentDate?: string;
      advanceUsed?: number;
      advancePaymentId?: string;
      allocation?: 'SERVICES' | 'PRODUCTS' | 'BOTH';
      notes?: string;
    },
  ): Promise<IncomeRecordDetail> => {
    const res = await api.post(`/clinic/income/${id}/payments`, payload);
    return res.data;
  },

  getVariance: async (id: string): Promise<IncomeVarianceData> => {
    const res = await api.get(`/clinic/income/${id}/variance`);
    return res.data;
  },

  getAudit: async (id: string): Promise<IncomeAuditItem[]> => {
    const res = await api.get(`/clinic/income/${id}/audit`);
    return res.data;
  },

  finalize: async (id: string): Promise<any> => {
    const res = await api.patch(`/clinic/income/${id}/finalize`);
    return res.data;
  },
};
