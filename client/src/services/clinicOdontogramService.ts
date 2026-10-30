import api from './api';

export type TeethModel = 'ADULT' | 'CHILD';

export interface OdontogramConfigItem {
  id?: string;
  tenantId: string;
  branchId: string | null;
  defaultTeethModel: TeethModel;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateOdontogramConfigPayload {
  defaultTeethModel: TeethModel;
  branchId?: string;
}

export interface OdontogramTreatmentItem {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  description: string | null;
  color: string;
  appliesToWholeTooth: boolean;
  createdAt: string;
  updatedAt: string;
  branch?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
}

export interface CreateOdontogramTreatmentPayload {
  name: string;
  description?: string;
  color: string;
  appliesToWholeTooth: boolean;
  branchId?: string;
}

export interface UpdateOdontogramTreatmentPayload {
  name?: string;
  description?: string;
  color?: string;
  appliesToWholeTooth?: boolean;
}

export interface OdontogramDiagnosticItem {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  description: string | null;
  color: string;
  appliesToWholeTooth: boolean;
  createdAt: string;
  updatedAt: string;
  branch?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
}

export interface CreateOdontogramDiagnosticPayload {
  name: string;
  description?: string;
  color: string;
  appliesToWholeTooth: boolean;
  branchId?: string;
}

export interface UpdateOdontogramDiagnosticPayload {
  name?: string;
  description?: string;
  color?: string;
  appliesToWholeTooth?: boolean;
}

export const clinicOdontogramService = {
  // Config
  getConfig: async (branchId?: string): Promise<OdontogramConfigItem> => {
    const params = branchId && branchId !== 'ALL' && branchId !== 'all' ? { branchId } : {};
    const { data } = await api.get<OdontogramConfigItem>('/clinic/odontogram/config', { params });
    return data;
  },

  updateConfig: async (payload: UpdateOdontogramConfigPayload): Promise<OdontogramConfigItem> => {
    const { data } = await api.put<OdontogramConfigItem>('/clinic/odontogram/config', payload);
    return data;
  },

  // Treatments
  getTreatments: async (branchId?: string): Promise<OdontogramTreatmentItem[]> => {
    const params = branchId && branchId !== 'ALL' && branchId !== 'all' ? { branchId } : {};
    const { data } = await api.get<OdontogramTreatmentItem[]>('/clinic/odontogram/treatments', { params });
    return Array.isArray(data) ? data : (data as any)?.data || [];
  },

  createTreatment: async (payload: CreateOdontogramTreatmentPayload): Promise<OdontogramTreatmentItem> => {
    const { data } = await api.post<OdontogramTreatmentItem>('/clinic/odontogram/treatments', payload);
    return data;
  },

  updateTreatment: async (id: string, payload: UpdateOdontogramTreatmentPayload): Promise<OdontogramTreatmentItem> => {
    const { data } = await api.patch<OdontogramTreatmentItem>(`/clinic/odontogram/treatments/${id}`, payload);
    return data;
  },

  deleteTreatment: async (id: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await api.delete<{ success: boolean; message: string }>(`/clinic/odontogram/treatments/${id}`);
    return data;
  },

  // Diagnostics
  getDiagnostics: async (branchId?: string): Promise<OdontogramDiagnosticItem[]> => {
    const params = branchId && branchId !== 'ALL' && branchId !== 'all' ? { branchId } : {};
    const { data } = await api.get<OdontogramDiagnosticItem[]>('/clinic/odontogram/diagnostics', { params });
    return Array.isArray(data) ? data : (data as any)?.data || [];
  },

  createDiagnostic: async (payload: CreateOdontogramDiagnosticPayload): Promise<OdontogramDiagnosticItem> => {
    const { data } = await api.post<OdontogramDiagnosticItem>('/clinic/odontogram/diagnostics', payload);
    return data;
  },

  updateDiagnostic: async (id: string, payload: UpdateOdontogramDiagnosticPayload): Promise<OdontogramDiagnosticItem> => {
    const { data } = await api.patch<OdontogramDiagnosticItem>(`/clinic/odontogram/diagnostics/${id}`, payload);
    return data;
  },

  deleteDiagnostic: async (id: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await api.delete<{ success: boolean; message: string }>(`/clinic/odontogram/diagnostics/${id}`);
    return data;
  },
};

