import api from './api';

export interface TreatmentPlanDoctorItem {
  id: string;
  name: string;
  email?: string;
  specialization?: string;
}

export interface AdvancePaymentContextResponse {
  hasTreatmentPlan: boolean;
  treatmentPlanCount: number;
  doctors: TreatmentPlanDoctorItem[];
  branchId?: string | null;
}

export interface PatientAdvancePaymentItem {
  id: string;
  tenantId: string;
  branchId?: string | null;
  patientId: string;
  doctorId?: string | null;
  receiptNumber: string;
  amount: number | string;
  balanceRemaining: number | string;
  paymentMethod?: string | null;
  paymentDate: string;
  status: 'AVAILABLE' | 'PARTIALLY_USED' | 'CONSUMED' | 'REFUNDED' | 'CANCELLED';
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  doctor?: {
    id: string;
    name: string;
    email?: string;
  } | null;
  createdBy?: {
    id: string;
    name: string;
    email?: string;
  } | null;
}

export interface PatientAdvancePaymentListResponse {
  payments: PatientAdvancePaymentItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  totalAdvancesAmount: number;
  totalAvailableBalance: number;
  patient: {
    id: string;
    recordNumber: string;
    firstName: string;
    fatherLastName?: string | null;
    motherLastName?: string | null;
  };
}

export interface CreateAdvancePaymentPayload {
  patientId?: string;
  doctorId?: string | null;
  amount: number;
  paymentMethod?: string;
  paymentDate?: string;
  notes?: string;
}

export const clinicAdvancePaymentService = {
  getAdvancePaymentContext: async (patientId: string): Promise<AdvancePaymentContextResponse> => {
    const res = await api.get<AdvancePaymentContextResponse>(
      `/clinic/patients/${patientId}/advance-payments/context`
    );
    return res.data;
  },

  getPatientAdvancePayments: async (
    patientId: string,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      doctorId?: string;
      status?: string;
    }
  ): Promise<PatientAdvancePaymentListResponse> => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.search?.trim()) query.append('search', params.search.trim());
    if (params?.doctorId) query.append('doctorId', params.doctorId);
    if (params?.status) query.append('status', params.status);

    const queryString = query.toString();
    const url = `/clinic/patients/${patientId}/advance-payments${queryString ? `?${queryString}` : ''}`;
    const res = await api.get<PatientAdvancePaymentListResponse>(url);
    return res.data;
  },

  createAdvancePayment: async (
    patientId: string,
    payload: CreateAdvancePaymentPayload
  ): Promise<PatientAdvancePaymentItem> => {
    const res = await api.post<PatientAdvancePaymentItem>(
      `/clinic/patients/${patientId}/advance-payments`,
      payload
    );
    return res.data;
  },
};
