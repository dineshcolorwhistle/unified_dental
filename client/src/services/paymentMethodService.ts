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
    const endpoint = params?.moduleKey === 'CLINIC' ? '/clinic/payment-methods' : '/lab/payment-methods';
    const res = await api.get(endpoint, { params });
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },

  getById: async (id: string, moduleKey?: string): Promise<PaymentMethodItem> => {
    const endpoint = moduleKey === 'CLINIC' ? `/clinic/payment-methods/${id}` : `/lab/payment-methods/${id}`;
    const res = await api.get(endpoint);
    return res.data;
  },

  create: async (payload: CreatePaymentMethodPayload, moduleKey?: string): Promise<PaymentMethodItem> => {
    const endpoint = moduleKey === 'CLINIC' ? '/clinic/payment-methods' : '/lab/payment-methods';
    const res = await api.post(endpoint, payload);
    return res.data;
  },

  update: async (id: string, payload: UpdatePaymentMethodPayload, moduleKey?: string): Promise<PaymentMethodItem> => {
    const endpoint = moduleKey === 'CLINIC' ? `/clinic/payment-methods/${id}` : `/lab/payment-methods/${id}`;
    const res = await api.patch(endpoint, payload);
    return res.data;
  },

  delete: async (id: string, moduleKey?: string): Promise<{ success: boolean; deactivated?: boolean; message: string }> => {
    const endpoint = moduleKey === 'CLINIC' ? `/clinic/payment-methods/${id}` : `/lab/payment-methods/${id}`;
    const res = await api.delete(endpoint);
    return res.data;
  },
};
