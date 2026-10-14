import api from './api';

export type WhatsappTemplateStatus = 'ACTIVE' | 'INACTIVE';

export interface WhatsappTemplateItem {
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

export interface CreateWhatsappTemplatePayload {
  name: string;
  status?: WhatsappTemplateStatus;
  message: string;
  branchId?: string;
}

export interface UpdateWhatsappTemplatePayload {
  name?: string;
  status?: WhatsappTemplateStatus;
  message?: string;
  branchId?: string;
}

export interface QueryWhatsappTemplatesParams {
  branchId?: string;
  status?: WhatsappTemplateStatus;
  search?: string;
}

export const whatsappTemplateService = {
  getAll: async (params?: QueryWhatsappTemplatesParams): Promise<WhatsappTemplateItem[]> => {
    const res = await api.get('/lab/whatsapp-templates', { params });
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },

  getById: async (id: string): Promise<WhatsappTemplateItem> => {
    const res = await api.get(`/lab/whatsapp-templates/${id}`);
    return res.data;
  },

  create: async (payload: CreateWhatsappTemplatePayload): Promise<WhatsappTemplateItem> => {
    const res = await api.post('/lab/whatsapp-templates', payload);
    return res.data;
  },

  update: async (id: string, payload: UpdateWhatsappTemplatePayload): Promise<WhatsappTemplateItem> => {
    const res = await api.patch(`/lab/whatsapp-templates/${id}`, payload);
    return res.data;
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/lab/whatsapp-templates/${id}`);
    return res.data;
  },
};
