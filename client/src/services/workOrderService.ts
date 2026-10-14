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
  reworkCount?: number;
  reworkActive?: boolean;
  technician?: { id: string; name: string } | null;
  doctor?: { id: string; name: string; clinicName?: string | null } | null;
  activityLogs?: ProcessActivityLogItem[];
}

export interface ReworkCycleItem {
  processId: string;
  processName: string;
  reworkCount: number;
  initiatedBy: string;
  initiatedById?: string;
  initiationDateTime: string;
  triggeringStage: string;
  assignedTechnician: string;
  assignedTechnicianId?: string;
  completionDateTime: string | null;
  approvalDateTime: string | null;
  status: 'Completed' | 'In Progress' | 'Not Started' | 'Approved';
}

export interface TechnicianQueueItem {
  workOrderId: string;
  folioNumber: string;
  patient?: string | null;
  prosthesisTypeName: string;
  boxNumber?: string | null;
  specification?: string;
  color?: string;
  notes?: string | null;
  workOrderStatus?: string;
  deliveryDate?: string | null;
  currentProcessId: string;
  currentStepSequence: number;
  currentStepName: string;
  currentStepStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED';
  isReadyToStart: boolean;
  reworkActive?: boolean;
  reworkCount?: number;
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

export interface WorkOrderPaymentItem {
  id: string;
  workOrderId: string;
  amount: number | string;
  notes?: string | null;
  reference?: string | null;
  paymentMethod?: string | null;
  status: string;
  recordedById?: string | null;
  recordedBy?: {
    id: string;
    name: string;
    email?: string;
  } | null;
  createdAt: string;
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
  reworkCount?: number;
  reworkActive?: boolean;
  reworkCycles?: ReworkCycleItem[];
  myProcess?: WorkOrderProcessItem | null;
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
  payments?: WorkOrderPaymentItem[];
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
  payments?: Array<{
    amount: number;
    paymentMethod?: string;
    notes?: string;
    reference?: string;
  }>;
  paymentReferenceNumbers?: string[];
  action: 'create' | 'createAndAssign';
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
  myRequestedOnly?: boolean;
  hasUnreadChat?: boolean;
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

  // ─── Lab Admin Dashboard ───

  getLabAdminDashboard: async (): Promise<LabAdminDashboardData> => {
    const res = await api.get('/lab/work-orders/admin/dashboard');
    return res.data;
  },

  evaluateVerification: async (
    workOrderId: string,
    processId: string,
    payload: { outcome: 'SUCCESS' | 'REPETITION'; notes?: string },
  ): Promise<WorkOrderListItem> => {
    const res = await api.post(
      `/lab/work-orders/${workOrderId}/processes/${processId}/verification-evaluate`,
      payload,
    );
    return res.data;
  },

  initiateRework: async (
    workOrderId: string,
    payload: { processIds: string[]; notes?: string; verificationProcessId?: string },
  ): Promise<WorkOrderListItem> => {
    const res = await api.post(`/lab/work-orders/${workOrderId}/rework`, payload);
    return res.data;
  },

  recordPayment: async (
    workOrderId: string,
    payload: { amount: number; notes?: string; reference?: string; paymentMethod?: string; paymentDate?: string },
  ): Promise<WorkOrderListItem> => {
    const res = await api.post(`/lab/work-orders/${workOrderId}/payments`, payload);
    return res.data;
  },

  // ─── Work Order Dedicated Chat ───

  getChat: async (workOrderId: string): Promise<WorkOrderChatData> => {
    const res = await api.get(`/lab/work-orders/${workOrderId}/chat`);
    return res.data;
  },

  sendChatMessage: async (workOrderId: string, message: string): Promise<WorkOrderChatMessageItem> => {
    const res = await api.post(`/lab/work-orders/${workOrderId}/chat`, { message });
    return res.data;
  },

  uploadChatImages: async (
    workOrderId: string,
    files: File[],
    message?: string,
  ): Promise<{ message: WorkOrderChatMessageItem; storageUsage: TenantStorageUsage }> => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    if (message && message.trim()) {
      formData.append('message', message.trim());
    }
    const res = await api.post(`/lab/work-orders/${workOrderId}/chat/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  getChatStorageUsage: async (workOrderId: string): Promise<TenantStorageUsage> => {
    const res = await api.get(`/lab/work-orders/${workOrderId}/chat/storage-usage`);
    return res.data;
  },

  markChatRead: async (workOrderId: string): Promise<{ success: boolean }> => {
    const res = await api.post(`/lab/work-orders/${workOrderId}/chat/read`);
    return res.data;
  },

  getUnreadChatCounts: async (workOrderIds?: string[]): Promise<Record<string, number>> => {
    const params = workOrderIds && workOrderIds.length > 0 ? { workOrderIds: workOrderIds.join(',') } : {};
    const res = await api.get('/lab/work-orders/chat/unread-counts', { params });
    return res.data;
  },
};

// ─── Dedicated Chat Types ───

export interface WorkOrderChatAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface TenantStorageUsage {
  usedBytes: number;
  usedMb: number;
  limitBytes: number;
  limitMb: number;
  remainingBytes: number;
  remainingMb: number;
  percentageUsed: number;
}

export interface WorkOrderChatParticipant {
  id: string;
  name: string;
  email?: string;
  role: 'Administrator' | 'Technician' | 'Doctor';
  branchName?: string;
  clinicName?: string;
}

export interface WorkOrderChatMessageItem {
  id: string;
  workOrderId: string;
  senderId: string;
  message: string | null;
  attachments?: WorkOrderChatAttachment[];
  createdAt: string;
  sender: {
    id: string;
    name: string;
    email?: string;
    role: string;
    branchName?: string;
  };
}

export interface WorkOrderChatData {
  workOrder: {
    id: string;
    folioNumber: string;
    boxNumber?: string | null;
  };
  participants: WorkOrderChatParticipant[];
  messages: WorkOrderChatMessageItem[];
  unreadCount: number;
}


// ─── Lab Admin Dashboard Types ───

export interface LabAdminVerificationAlertItem {
  workOrderId: string;
  folioNumber: string;
  patient?: string | null;
  processId: string;
  processName: string;
  processType: 'PRODUCTION' | 'INTERNAL_VERIFICATION' | 'EXTERNAL_VERIFICATION';
  isVerification: boolean;
  evaluatorId?: string | null;
  evaluatorName?: string | null;
  doctorName?: string | null;
  doctorType?: string | null;
  prosthesisName?: string | null;
  status: string;
  startedAt?: string | null;
  totalActiveDuration?: number;
}

export interface LabAdminProductionTaskItem {
  workOrderId: string;
  folioNumber: string;
  boxNumber?: string | null;
  patient?: string | null;
  doctorName?: string | null;
  clinicName?: string | null;
  prosthesisName?: string | null;
  processId: string;
  processName: string;
  sequence: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | string;
  isReadyToStart: boolean;
  reworkActive?: boolean;
  reworkCount?: number;
  startedAt?: string | null;
  totalActiveDuration?: number;
  deliveryDate?: string | null;
  color?: string | null;
}

export interface LabAdminInProgressItem {
  workOrderId: string;
  folioNumber: string;
  boxNumber?: string | null;
  patient?: string | null;
  doctorName?: string | null;
  prosthesisName?: string | null;
  currentStepId: string;
  currentStepName: string;
  currentStepStatus: string;
  currentStepSequence: number;
  technicianName?: string | null;
  technicianId?: string | null;
  isAssignedToMe?: boolean;
}

export interface LabAdminVerificationItem {
  workOrderId: string;
  folioNumber: string;
  patient?: string | null;
  processId: string;
  processName: string;
  processType: 'PRODUCTION' | 'INTERNAL_VERIFICATION' | 'EXTERNAL_VERIFICATION';
  isVerification: boolean;
  stepStatus: string;
  evaluatorId?: string | null;
  evaluatorName?: string | null;
  doctorName?: string | null;
  doctorType?: string | null;
  prosthesisName?: string | null;
  startedAt?: string | null;
  totalActiveDuration?: number;
}

export interface LabAdminDashboardData {
  stats: {
    activeOrders: number;
    pendingVerifications: number;
    pendingTechSteps: number;
    completedToday: number;
    myProductionTasksCount?: number;
  };
  isDefaultAdmin?: boolean;
  pendingVerificationAlerts: LabAdminVerificationAlertItem[];
  myProductionTasks?: LabAdminProductionTaskItem[];
  inProgressOrders: LabAdminInProgressItem[];
  verificationOrders: LabAdminVerificationItem[];
}

