import api from './api';

export type ServiceStatus = 'ACTIVE' | 'INACTIVE';

export interface ClinicServiceItem {
  id: string;
  tenantId: string;
  branchId?: string | null;
  name: string;
  description?: string | null;
  price: number | string;
  status: ServiceStatus;
  createdAt: string;
  updatedAt: string;
  branch?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
}

export interface CreateClinicServicePayload {
  name: string;
  description?: string;
  price: number;
  branchId?: string;
}

export interface UpdateClinicServicePayload {
  name?: string;
  description?: string;
  price?: number;
  status?: ServiceStatus;
  branchId?: string;
}

export interface QueryClinicServicesParams {
  branchId?: string;
  status?: ServiceStatus;
  search?: string;
}

export const clinicServiceService = {
  getAll: async (params?: QueryClinicServicesParams): Promise<ClinicServiceItem[]> => {
    const res = await api.get('/clinic/services', { params });
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },

  getById: async (id: string): Promise<ClinicServiceItem> => {
    const res = await api.get(`/clinic/services/${id}`);
    return res.data;
  },

  create: async (payload: CreateClinicServicePayload): Promise<ClinicServiceItem> => {
    const res = await api.post('/clinic/services', payload);
    return res.data;
  },

  update: async (id: string, payload: UpdateClinicServicePayload): Promise<ClinicServiceItem> => {
    const res = await api.patch(`/clinic/services/${id}`, payload);
    return res.data;
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/clinic/services/${id}`);
    return res.data;
  },
};
