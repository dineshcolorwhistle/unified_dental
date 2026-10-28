import api from './api';

export type SpecializationStatus = 'ACTIVE' | 'INACTIVE';

export interface SpecializationItem {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  status: SpecializationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpecializationPayload {
  name: string;
  description?: string;
}

export interface UpdateSpecializationPayload {
  name?: string;
  description?: string;
  status?: SpecializationStatus;
}

export interface QuerySpecializationsParams {
  search?: string;
  status?: SpecializationStatus;
}

export const specializationService = {
  getAll: async (params?: QuerySpecializationsParams): Promise<SpecializationItem[]> => {
    const res = await api.get('/clinic/specializations', { params });
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },

  getById: async (id: string): Promise<SpecializationItem> => {
    const res = await api.get(`/clinic/specializations/${id}`);
    return res.data;
  },

  create: async (payload: CreateSpecializationPayload): Promise<SpecializationItem> => {
    const res = await api.post('/clinic/specializations', payload);
    return res.data;
  },

  update: async (id: string, payload: UpdateSpecializationPayload): Promise<SpecializationItem> => {
    const res = await api.patch(`/clinic/specializations/${id}`, payload);
    return res.data;
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/clinic/specializations/${id}`);
    return res.data;
  },
};
