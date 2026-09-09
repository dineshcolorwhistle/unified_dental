import api from './api';

export interface ProcessActivityLogItem {
  id: string;
  workOrderProcessId: string;
  userId?: string | null;
  action: 'START' | 'PAUSE' | 'RESUME' | 'COMPLETE' | string;
  notes?: string | null;
  timestamp: string;
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface WorkOrderProcessItem {
  id?: string;
  processId?: string | null;
  processName: string;
  processType: 'PRODUCTION' | 'INTERNAL_VERIFICATION' | 'EXTERNAL_VERIFICATION';
  technicianId?: string | null;
  doctorId?: string | null;
  sequence: number;
  isVerification: boolean;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startedAt?: string | null;
  endedAt?: string | null;
  lastPausedAt?: string | null;
  totalActiveDuration?: number;
  pauseCount?: number;
  totalPauseDuration?: number;
  technician?: { id: string; name: string } | null;
  doctor?: { id: string; name: string; clinicName?: string | null } | null;
  activityLogs?: ProcessActivityLogItem[];
}

export interface TechnicianQueueItem {
  workOrderId: string;
  folioNumber: string;
  patient?: string | null;
  prosthesisTypeName: string;
  boxNumber?: string | null;
  currentProcessId: string;
  currentStepSequence: number;
  currentStepName: string;
  currentStepStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED';
  isReadyToStart: boolean;
  doctorName?: string | null;
  clinicName?: string | null;
  createdAt: string;
}

export interface TechnicianDashboardData {
  stats: {
    pendingSteps: number;
    activeSteps: number;
    pausedSteps: number;
    completedToday: number;
  };
  queue: TechnicianQueueItem[];
}

export interface WorkOrderNoteItem {
  id: string;
  workOrderId: string;
  userId: string;
  note: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface WorkOrderListItem {
  id: string;
  tenantId: string;
  branchId: string;
  moduleKey: string;
  folioNumber: string;
  fileNumber?: string | null;
  boxNumber?: string | null;
  patient?: string | null;
  doctorId: string;
  prosthesisTypeId: string;
  specification: string;
  color: string;
  notes?: string | null;
  deliveryDate?: string | null;
  totalQuote: number | string;
  initialPayment: number | string;
  paymentReferenceNumbers: string[];
  status: 'CREATED' | 'ASSIGNED' | 'IN_PROGRESS' | 'INTERNAL_VERIFICATION' | 'EXTERNAL_VERIFICATION' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  qrToken: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  doctor: {
    id: string;
    name: string;
    clinicName?: string | null;
    type: 'LOCAL' | 'INTEGRATED';
  };
  prosthesisType: {
    id: string;
    name: string;
    price: number | string;
  };
  branch: {
    id: string;
    name: string;
    code?: string | null;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  processes: WorkOrderProcessItem[];
  notesHistory?: WorkOrderNoteItem[];
  _count?: {
    notesHistory: number;
  };
}

export interface CreateWorkOrderPayload {
  doctorId: string;
  patient?: string;
  fileNumber?: string;
  boxNumber?: string;
  deliveryDate?: string;
  prosthesisTypeId: string;
  specification: string;
  color: string;
  notes?: string;
  branchId?: string;
  totalQuote?: number;
  initialPayment?: number;
  paymentReferenceNumbers?: string[];
  action: 'create' | 'createAndAssign';
  processes: Array<{
    id?: string;
    processName: string;
    processId?: string;
    processType?: 'PRODUCTION' | 'INTERNAL_VERIFICATION' | 'EXTERNAL_VERIFICATION';
    technicianId?: string;
    doctorId?: string;
    sequence: number;
    isVerification?: boolean;
    status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  }>;
}

export interface UpdateWorkOrderPayload {
  doctorId?: string;
  patient?: string;
  fileNumber?: string;
  boxNumber?: string;
  deliveryDate?: string;
  prosthesisTypeId?: string;
  specification?: string;
  color?: string;
  notes?: string;
  branchId?: string;
  totalQuote?: number;
  initialPayment?: number;
  paymentReferenceNumbers?: string[];
  action?: 'save' | 'saveAndAssign';
  processes?: Array<{
    id?: string;
    processName: string;
    processId?: string;
    processType?: 'PRODUCTION' | 'INTERNAL_VERIFICATION' | 'EXTERNAL_VERIFICATION';
    technicianId?: string;
    doctorId?: string;
    sequence: number;
    isVerification?: boolean;
    status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  }>;
}

export interface QueryWorkOrdersParams {
  search?: string;
  branchId?: string;
  status?: string;
  doctorId?: string;
  page?: number;
  limit?: number;
}

export interface WorkOrdersResponse {
  data: WorkOrderListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const workOrderService = {
  getAll: async (params?: QueryWorkOrdersParams): Promise<WorkOrdersResponse> => {
    const res = await api.get('/lab/work-orders', { params });
    const items: WorkOrderListItem[] = Array.isArray(res.data)
      ? res.data
      : (res.data as any)?.data || [];
    const meta =
      (res as any).meta ||
      (res.data as any)?.meta || {
        total: items.length,
        page: params?.page || 1,
        limit: params?.limit || 10,
        totalPages: Math.ceil(items.length / (params?.limit || 10)) || 1,
      };
    return { data: items, meta };
  },

  getNextFolio: async (branchId?: string): Promise<{ folioNumber: string; branchId: string }> => {
    const res = await api.get('/lab/work-orders/next-folio', {
      params: branchId ? { branchId } : undefined,
    });
    return res.data;
  },

  getById: async (id: string): Promise<WorkOrderListItem> => {
    const res = await api.get(`/lab/work-orders/${id}`);
    return res.data;
  },

  create: async (payload: CreateWorkOrderPayload): Promise<WorkOrderListItem> => {
    const res = await api.post('/lab/work-orders', payload);
    return res.data;
  },

  update: async (id: string, payload: UpdateWorkOrderPayload): Promise<WorkOrderListItem> => {
    const res = await api.patch(`/lab/work-orders/${id}`, payload);
    return res.data;
  },

  addNote: async (workOrderId: string, note: string): Promise<WorkOrderNoteItem> => {
    const res = await api.post(`/lab/work-orders/${workOrderId}/notes`, { note });
    return res.data;
  },

  updateNote: async (workOrderId: string, noteId: string, note: string): Promise<WorkOrderNoteItem> => {
    const res = await api.patch(`/lab/work-orders/${workOrderId}/notes/${noteId}`, { note });
    return res.data;
  },

  deleteNote: async (workOrderId: string, noteId: string): Promise<{ success: boolean }> => {
    const res = await api.delete(`/lab/work-orders/${workOrderId}/notes/${noteId}`);
    return res.data;
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/lab/work-orders/${id}`);
    return res.data;
  },

  getTechnicianDashboard: async (): Promise<TechnicianDashboardData> => {
    const res = await api.get('/lab/work-orders/technician/dashboard');
    return res.data;
  },

  getTechnicianWorkOrders: async (params?: QueryWorkOrdersParams): Promise<WorkOrdersResponse> => {
    const res = await api.get('/lab/work-orders/technician/my-orders', { params });
    const items: WorkOrderListItem[] = Array.isArray(res.data)
      ? res.data
      : (res.data as any)?.data || [];
    const meta =
      (res as any).meta ||
      (res.data as any)?.meta || {
        total: items.length,
        page: params?.page || 1,
        limit: params?.limit || 20,
        totalPages: Math.ceil(items.length / (params?.limit || 20)) || 1,
      };
    return { data: items, meta };
  },

  startProcess: async (workOrderId: string, processId: string): Promise<WorkOrderListItem> => {
    const res = await api.post(`/lab/work-orders/${workOrderId}/processes/${processId}/start`);
    return res.data;
  },

  pauseProcess: async (workOrderId: string, processId: string): Promise<WorkOrderListItem> => {
    const res = await api.post(`/lab/work-orders/${workOrderId}/processes/${processId}/pause`);
    return res.data;
  },

  resumeProcess: async (workOrderId: string, processId: string): Promise<WorkOrderListItem> => {
    const res = await api.post(`/lab/work-orders/${workOrderId}/processes/${processId}/resume`);
    return res.data;
  },

  completeProcess: async (workOrderId: string, processId: string): Promise<WorkOrderListItem> => {
    const res = await api.post(`/lab/work-orders/${workOrderId}/processes/${processId}/complete`);
    return res.data;
  },
};
