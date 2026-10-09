import api from './api';

export interface PaymentMethodItem {
  id: string;
  tenantId: string;
  branchId?: string | null;
  moduleKey: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  branch?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
}

export interface CreatePaymentMethodPayload {
  name: string;
  description?: string;
  branchId?: string;
  isActive?: boolean;
}

export interface UpdatePaymentMethodPayload {
  name?: string;
  description?: string;
  branchId?: string;
  isActive?: boolean;
}

export interface QueryPaymentMethodsParams {
  branchId?: string;
  moduleKey?: string;
  search?: string;
  activeOnly?: boolean;
}

export const paymentMethodService = {
  getAll: async (params?: QueryPaymentMethodsParams): Promise<PaymentMethodItem[]> => {
    const res = await api.get('/lab/payment-methods', { params });
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },

  getById: async (id: string): Promise<PaymentMethodItem> => {
    const res = await api.get(`/lab/payment-methods/${id}`);
    return res.data;
  },

  create: async (payload: CreatePaymentMethodPayload): Promise<PaymentMethodItem> => {
    const res = await api.post('/lab/payment-methods', payload);
    return res.data;
  },

  update: async (id: string, payload: UpdatePaymentMethodPayload): Promise<PaymentMethodItem> => {
    const res = await api.patch(`/lab/payment-methods/${id}`, payload);
    return res.data;
  },

  delete: async (id: string): Promise<{ success: boolean; deactivated?: boolean; message: string }> => {
    const res = await api.delete(`/lab/payment-methods/${id}`);
    return res.data;
  },
};
