import api from './api';

export type SupportTicketStatus = 'CREATED' | 'IN_PROGRESS' | 'COMPLETED';

export interface TicketImage {
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  message: string;
  attachments?: any[];
  createdAt: string;
  sender: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    isSuperAdmin: boolean;
  };
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  status: SupportTicketStatus;
  images: TicketImage[];
  moduleKey: string;
  tenantId: string;
  branchId?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  branch?: {
    id: string;
    name: string;
    code?: string;
  } | null;
  createdBy: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  messages?: SupportTicketMessage[];
  _count?: {
    messages: number;
  };
}

export interface TicketQuery {
  status?: SupportTicketStatus;
  tenantId?: string;
  branchId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface SupportTicketsResponse {
  items: SupportTicket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SupportMetrics {
  total: number;
  createdCount: number;
  inProgressCount: number;
  completedCount: number;
}

export interface CreateSupportTicketInput {
  title: string;
  description: string;
  images?: TicketImage[];
  branchId?: string;
}

export interface UpdateSupportTicketInput {
  title?: string;
  description?: string;
  images?: TicketImage[];
}

export const supportService = {
  async getMetrics(tenantId?: string): Promise<SupportMetrics> {
    const res = await api.get('/support/metrics', {
      params: tenantId ? { tenantId } : undefined,
    });
    return res.data;
  },

  async getTickets(query?: TicketQuery): Promise<SupportTicketsResponse> {
    const res = await api.get('/support/tickets', { params: query });
    return res.data;
  },

  async getTicketById(id: string): Promise<SupportTicket> {
    const res = await api.get(`/support/tickets/${id}`);
    return res.data;
  },

  async createTicket(input: CreateSupportTicketInput): Promise<SupportTicket> {
    const res = await api.post('/support/tickets', input);
    return res.data;
  },

  async updateTicket(id: string, input: UpdateSupportTicketInput): Promise<SupportTicket> {
    const res = await api.patch(`/support/tickets/${id}`, input);
    return res.data;
  },

  async updateStatus(id: string, status: SupportTicketStatus): Promise<SupportTicket> {
    const res = await api.patch(`/support/tickets/${id}/status`, { status });
    return res.data;
  },

  async deleteTicket(id: string): Promise<{ success: boolean; message: string }> {
    const res = await api.delete(`/support/tickets/${id}`);
    return res.data;
  },

  async addMessage(
    ticketId: string,
    message: string,
    attachments?: any[],
  ): Promise<SupportTicketMessage> {
    const res = await api.post(`/support/tickets/${ticketId}/messages`, {
      message,
      attachments,
    });
    return res.data;
  },

  async uploadImage(file: File): Promise<TicketImage> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('resourceType', 'SUPPORT_TICKET_ATTACHMENT');
    formData.append('moduleKey', 'LAB');

    const res = await api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const fileRecord = res.data;
    return {
      name: file.name,
      url: `/api/files/${fileRecord.id}/download`,
      size: file.size,
      mimeType: file.type,
    };
  },
};
