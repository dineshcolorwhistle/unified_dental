import api from './api';

export type WhatsappTemplateStatus = 'ACTIVE' | 'INACTIVE';

export interface ClinicWhatsappTemplateItem {
  id: string;
  tenantId: string;
  branchId?: string | null;
  name: string;
  status: WhatsappTemplateStatus;
  message: string;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  branch?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface CreateClinicWhatsappTemplatePayload {
  name: string;
  status?: WhatsappTemplateStatus;
  message: string;
  branchId?: string;
}

export interface UpdateClinicWhatsappTemplatePayload {
  name?: string;
  status?: WhatsappTemplateStatus;
  message?: string;
  branchId?: string;
}

export interface QueryClinicWhatsappTemplatesParams {
  branchId?: string;
  status?: WhatsappTemplateStatus;
  search?: string;
}

export const clinicWhatsappTemplateService = {
  getAll: async (params?: QueryClinicWhatsappTemplatesParams): Promise<ClinicWhatsappTemplateItem[]> => {
    const res = await api.get('/clinic/whatsapp-templates', { params });
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },

  getById: async (id: string): Promise<ClinicWhatsappTemplateItem> => {
    const res = await api.get(`/clinic/whatsapp-templates/${id}`);
    return res.data;
  },

  create: async (payload: CreateClinicWhatsappTemplatePayload): Promise<ClinicWhatsappTemplateItem> => {
    const res = await api.post('/clinic/whatsapp-templates', payload);
    return res.data;
  },

  update: async (id: string, payload: UpdateClinicWhatsappTemplatePayload): Promise<ClinicWhatsappTemplateItem> => {
    const res = await api.patch(`/clinic/whatsapp-templates/${id}`, payload);
    return res.data;
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/clinic/whatsapp-templates/${id}`);
    return res.data;
  },
};
