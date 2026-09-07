import api from './api';

export interface DoctorListItem {
  id: string;
  name: string;
  clinicName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  specialization?: string | null;
  type: 'LOCAL' | 'INTEGRATED';
  clinicId?: string | null;
  externalId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  branch?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
  listMembers?: Array<{
    doctorList: {
      id: string;
      name: string;
    };
  }>;
}

export interface DoctorGroupListItem {
  id: string;
  name: string;
  description?: string | null;
  branchId?: string | null;
  createdAt: string;
  updatedAt: string;
  branch?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
  _count: {
    members: number;
  };
  members?: Array<{
    doctor: {
      id: string;
      name: string;
      clinicName?: string | null;
      type: 'LOCAL' | 'INTEGRATED';
    };
  }>;
}

export interface DoctorGroupDetail extends DoctorGroupListItem {
  members: Array<{
    doctor: {
      id: string;
      name: string;
      clinicName?: string | null;
      email?: string | null;
      phone?: string | null;
      specialization?: string | null;
      type: 'LOCAL' | 'INTEGRATED';
      isActive: boolean;
    };
  }>;
}

export interface CreateDoctorPayload {
  name: string;
  clinicName?: string;
  email?: string;
  phone?: string;
  address?: string;
  specialization?: string;
  type?: 'LOCAL' | 'INTEGRATED';
}

export interface UpdateDoctorPayload {
  name?: string;
  clinicName?: string;
  email?: string;
  phone?: string;
  address?: string;
  specialization?: string;
  type?: 'LOCAL' | 'INTEGRATED';
  isActive?: boolean;
}

export interface CreateDoctorListPayload {
  name: string;
  description?: string;
  branchId?: string;
  doctorIds?: string[];
}

export interface UpdateDoctorListPayload {
  name?: string;
  description?: string;
  doctorIds?: string[];
}

export const doctorService = {
  getAll: async (params?: {
    branchId?: string;
    search?: string;
    status?: string;
    type?: string;
  }): Promise<DoctorListItem[]> => {
    const res = await api.get('/lab/doctors', { params });
    return res.data;
  },

  getById: async (id: string): Promise<DoctorListItem> => {
    const res = await api.get(`/lab/doctors/${id}`);
    return res.data;
  },

  create: async (payload: CreateDoctorPayload): Promise<DoctorListItem> => {
    const res = await api.post('/lab/doctors', payload);
    return res.data;
  },

  update: async (id: string, payload: UpdateDoctorPayload): Promise<DoctorListItem> => {
    const res = await api.patch(`/lab/doctors/${id}`, payload);
    return res.data;
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/lab/doctors/${id}`);
    return res.data;
  },

  getAllLists: async (branchId?: string): Promise<DoctorGroupListItem[]> => {
    const res = await api.get('/lab/doctors/lists/all', {
      params: branchId ? { branchId } : undefined,
    });
    return res.data;
  },

  getListById: async (id: string): Promise<DoctorGroupDetail> => {
    const res = await api.get(`/lab/doctors/lists/${id}`);
    return res.data;
  },

  createList: async (payload: CreateDoctorListPayload): Promise<DoctorGroupListItem> => {
    const res = await api.post('/lab/doctors/lists', payload);
    return res.data;
  },

  updateList: async (id: string, payload: UpdateDoctorListPayload): Promise<DoctorGroupListItem> => {
    const res = await api.patch(`/lab/doctors/lists/${id}`, payload);
    return res.data;
  },

  deleteList: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/lab/doctors/lists/${id}`);
    return res.data;
  },

  addListMembers: async (id: string, doctorIds: string[]): Promise<DoctorGroupDetail> => {
    const res = await api.post(`/lab/doctors/lists/${id}/members`, { doctorIds });
    return res.data;
  },

  removeListMember: async (
    listId: string,
    doctorId: string,
  ): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/lab/doctors/lists/${listId}/members/${doctorId}`);
    return res.data;
  },
};
