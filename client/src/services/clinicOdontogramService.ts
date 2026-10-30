import api from './api';

export type TeethModel = 'ADULT' | 'CHILD' | 'COMPLETE';

export type OdontogramTreatmentStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

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

// ─── Patient Odontogram Interfaces ─────────────────────────

export interface PatientOdontogramDiagnosticItem {
  id: string;
  tenantId: string;
  odontogramId: string;
  patientId: string;
  branchId: string | null;
  toothNumber: number;
  surface: string; // WHOLE, OCCLUSAL, MESIAL, DISTAL, VESTIBULAR, LINGUAL
  diagnosticId: string | null;
  diagnosticName: string;
  color: string;
  notes: string | null;
  diagnosedAt: string;
  diagnosedById: string | null;
  createdAt: string;
  updatedAt: string;
  diagnostic?: OdontogramDiagnosticItem | null;
  diagnosedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface PatientOdontogramTreatmentItem {
  id: string;
  tenantId: string;
  odontogramId: string;
  patientId: string;
  branchId: string | null;
  toothNumber: number;
  surface: string; // WHOLE, OCCLUSAL, MESIAL, DISTAL, VESTIBULAR, LINGUAL
  treatmentId: string | null;
  treatmentName: string;
  color: string;
  status: OdontogramTreatmentStatus;
  cost: number | null;
  notes: string | null;
  plannedDate: string | null;
  completedDate: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  treatment?: OdontogramTreatmentItem | null;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface PatientOdontogramHeader {
  id: string;
  tenantId: string;
  patientId: string;
  branchId: string | null;
  teethModel: TeethModel;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatientOdontogramResponse {
  patient: {
    id: string;
    recordNumber: string;
    firstName: string;
    fatherLastName?: string | null;
    motherLastName?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    phoneCountryCode?: string | null;
    phoneNumber?: string | null;
    email?: string | null;
    allergies?: string | null;
    medications?: string | null;
    status: string;
    branch?: {
      id: string;
      name: string;
      code?: string;
    } | null;
  };
  odontogram: PatientOdontogramHeader;
  diagnostics: PatientOdontogramDiagnosticItem[];
  treatments: PatientOdontogramTreatmentItem[];
  config: OdontogramConfigItem;
}

export interface AddPatientDiagnosticPayload {
  toothNumber: number;
  surface?: string;
  diagnosticId?: string;
  diagnosticName: string;
  color?: string;
  notes?: string;
}

export interface UpdatePatientDiagnosticPayload {
  surface?: string;
  diagnosticName?: string;
  color?: string;
  notes?: string;
}

export interface AddPatientTreatmentPayload {
  toothNumber: number;
  surface?: string;
  treatmentId?: string;
  treatmentName: string;
  color?: string;
  status?: OdontogramTreatmentStatus;
  cost?: number;
  notes?: string;
  plannedDate?: string;
}

export interface UpdatePatientTreatmentPayload {
  surface?: string;
  treatmentName?: string;
  color?: string;
  status?: OdontogramTreatmentStatus;
  cost?: number;
  notes?: string;
  plannedDate?: string;
  completedDate?: string;
}

export interface SavePatientDiagnosticItem {
  toothNumber: number;
  surface: string;
  diagnosticName: string;
  color?: string;
  notes?: string;
  diagnosticId?: string;
}

export interface SavePatientTreatmentItem {
  toothNumber: number;
  surface: string;
  treatmentName: string;
  color?: string;
  status?: OdontogramTreatmentStatus;
  cost?: number;
  notes?: string;
  treatmentId?: string;
}

export interface SavePatientOdontogramPayload {
  teethModel?: TeethModel;
  notes?: string;
  diagnostics?: SavePatientDiagnosticItem[];
  treatments?: SavePatientTreatmentItem[];
}

export interface UpdatePatientOdontogramPayload {
  teethModel?: TeethModel;
  notes?: string;
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

  // Patient Odontogram
  getPatientOdontogram: async (patientId: string): Promise<PatientOdontogramResponse> => {
    const { data } = await api.get<PatientOdontogramResponse>(`/clinic/odontogram/patient/${patientId}`);
    return data;
  },

  updatePatientOdontogram: async (
    patientId: string,
    payload: UpdatePatientOdontogramPayload,
  ): Promise<PatientOdontogramHeader> => {
    const { data } = await api.patch<PatientOdontogramHeader>(`/clinic/odontogram/patient/${patientId}`, payload);
    return data;
  },

  addPatientDiagnostic: async (
    patientId: string,
    payload: AddPatientDiagnosticPayload,
  ): Promise<PatientOdontogramDiagnosticItem> => {
    const { data } = await api.post<PatientOdontogramDiagnosticItem>(
      `/clinic/odontogram/patient/${patientId}/diagnostics`,
      payload,
    );
    return data;
  },

  updatePatientDiagnostic: async (
    patientId: string,
    diagnosticId: string,
    payload: UpdatePatientDiagnosticPayload,
  ): Promise<PatientOdontogramDiagnosticItem> => {
    const { data } = await api.patch<PatientOdontogramDiagnosticItem>(
      `/clinic/odontogram/patient/${patientId}/diagnostics/${diagnosticId}`,
      payload,
    );
    return data;
  },

  deletePatientDiagnostic: async (
    patientId: string,
    diagnosticId: string,
  ): Promise<{ success: boolean; message: string }> => {
    const { data } = await api.delete<{ success: boolean; message: string }>(
      `/clinic/odontogram/patient/${patientId}/diagnostics/${diagnosticId}`,
    );
    return data;
  },

  addPatientTreatment: async (
    patientId: string,
    payload: AddPatientTreatmentPayload,
  ): Promise<PatientOdontogramTreatmentItem> => {
    const { data } = await api.post<PatientOdontogramTreatmentItem>(
      `/clinic/odontogram/patient/${patientId}/treatments`,
      payload,
    );
    return data;
  },

  updatePatientTreatment: async (
    patientId: string,
    treatmentId: string,
    payload: UpdatePatientTreatmentPayload,
  ): Promise<PatientOdontogramTreatmentItem> => {
    const { data } = await api.patch<PatientOdontogramTreatmentItem>(
      `/clinic/odontogram/patient/${patientId}/treatments/${treatmentId}`,
      payload,
    );
    return data;
  },

  deletePatientTreatment: async (
    patientId: string,
    treatmentId: string,
  ): Promise<{ success: boolean; message: string }> => {
    const { data } = await api.delete<{ success: boolean; message: string }>(
      `/clinic/odontogram/patient/${patientId}/treatments/${treatmentId}`,
    );
    return data;
  },

  savePatientOdontogram: async (
    patientId: string,
    payload: SavePatientOdontogramPayload,
  ): Promise<PatientOdontogramResponse> => {
    const { data } = await api.post<PatientOdontogramResponse>(
      `/clinic/odontogram/patient/${patientId}/save`,
      payload,
    );
    return data;
  },
};
