import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import { SearchableSelect, SearchableSelectOption } from '../../components/common/SearchableSelect';
import { Tooltip } from '../../components/common/Tooltip';
import { Pagination } from '../../components/common/Pagination';
import { formatDate } from '../../core/utils/dateUtils';
import {
  Workflow,
  Plus,
  Search,
  Building2,
  Trash2,
  Edit2,
  X,
  Layers,
  AlertTriangle,
  UserCheck,
  ShieldCheck,
  Stethoscope,
  Info,
} from 'lucide-react';

type ProcessType = 'PRODUCTION' | 'INTERNAL_VERIFICATION' | 'EXTERNAL_VERIFICATION';

interface ProcessRecord {
  id: string;
  name: string;
  type: ProcessType;
  processAreaId?: string | null;
  defaultTechnicianId?: string | null;
  branchId?: string | null;
  createdAt: string;
  branch: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
  processArea?: {
    id: string;
    name: string;
  } | null;
  defaultTechnician?: {
    id: string;
    name: string;
    email: string;
  } | null;
  _count?: {
    prosthesisTypeAssignments: number;
  };
}

export const LabProcessesPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, isTenantAdmin } = useAuth();
  const { toast } = useToast();

  const isLabAdmin = Boolean(
    !isTenantAdmin &&
      user?.roles?.some((r) => {
        const lower = r.toLowerCase();
        return lower === 'lab admin' || lower === 'lab-admin';
      }),
  );

  const [processes, setProcesses] = useState<ProcessRecord[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [processAreas, setProcessAreas] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Filters
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingProcess, setEditingProcess] = useState<ProcessRecord | null>(null);
  const [deletingProcess, setDeletingProcess] = useState<ProcessRecord | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    type: 'PRODUCTION' as ProcessType,
    processAreaId: '',
    defaultTechnicianId: '',
    branchId: '',
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await api.get('/branches', { params: { moduleKey: 'LAB' } });
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setBranches(list);
      } catch (err) {
        console.error('Failed to load branches', err);
      }
    };
    fetchBranches();
  }, []);

  // Fetch process areas for active branch
  const activeBranchId = isTenantAdmin
    ? (selectedBranchFilter !== 'all' ? selectedBranchFilter : branches[0]?.id)
    : (user?.activeBranchId || user?.availableBranches?.[0]?.id);

  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const res = await api.get('/lab/process-areas', {
          params: activeBranchId ? { branchId: activeBranchId } : {},
        });
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setProcessAreas(list);
      } catch (err) {
        console.error('Failed to load process areas', err);
      }
    };
    fetchAreas();
  }, [activeBranchId]);

  // Fetch technicians & lab admins for modal assignment (strictly scoped to branch)
  useEffect(() => {
    const fetchAssignees = async () => {
      try {
        const branchForModal = formData.branchId || branches[0]?.id || user?.activeBranchId || user?.availableBranches?.[0]?.id;

        if (!branchForModal) return;

        const [techsRes, adminsRes] = await Promise.all([
          api.get('/lab/users/technicians', {
            params: { branchId: branchForModal },
          }),
          api.get('/lab/users/admin', {
            params: { branchId: branchForModal },
          }),
        ]);

        const rawTechs = Array.isArray(techsRes.data) ? techsRes.data : techsRes.data?.data || [];
        const rawAdmins = Array.isArray(adminsRes.data) ? adminsRes.data : adminsRes.data?.data || [];

        const combined: { id: string; name: string; email: string; roleType: 'admin' | 'technician' }[] = [];
        const seenIds = new Set<string>();

        // Lab admins of this branch
        rawAdmins.forEach((a: any) => {
          if (!seenIds.has(a.id)) {
            seenIds.add(a.id);
            combined.push({
              id: a.id,
              name: a.name,
              email: a.email,
              roleType: 'admin',
            });
          }
        });

        // Technicians of this branch
        rawTechs.forEach((t: any) => {
          if (!seenIds.has(t.id)) {
            seenIds.add(t.id);
            combined.push({
              id: t.id,
              name: t.name,
              email: t.email,
              roleType: 'technician',
            });
          }
        });

        setTechnicians(combined);
      } catch (err) {
        console.error('Failed to load assignees for branch', err);
      }
    };
    if (showCreateModal || editingProcess) {
      fetchAssignees();
    }
  }, [showCreateModal, editingProcess, formData.branchId, isTenantAdmin, branches, user]);

  // Fetch Processes
  const fetchProcesses = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (selectedBranchFilter && selectedBranchFilter !== 'all') {
        params.branchId = selectedBranchFilter;
      }
      if (selectedAreaFilter && selectedAreaFilter !== 'all') {
        params.processAreaId = selectedAreaFilter;
      }
      if (selectedTypeFilter && selectedTypeFilter !== 'all') {
        params.type = selectedTypeFilter;
      }
      if (search.trim()) {
        params.search = search.trim();
      }

      const res = await api.get('/lab/processes', { params });
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setProcesses(list);
    } catch (err: any) {
      console.error('Failed to fetch processes', err);
      toast.error(err?.response?.data?.message || t('labProcesses.alerts.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcesses();
  }, [selectedBranchFilter, selectedAreaFilter, selectedTypeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProcesses();
  };

  // Branch Options
  const branchOptions: SearchableSelectOption[] = useMemo(() => {
    const options: SearchableSelectOption[] = [
      { value: 'all', label: t('labProcessAreas.allBranches') },
    ];
    branches.forEach((b) => {
      options.push({ value: b.id, label: b.name });
    });
    return options;
  }, [branches, t]);

  // Area Options for Filter
  const areaFilterOptions: SearchableSelectOption[] = useMemo(() => {
    const options: SearchableSelectOption[] = [
      { value: 'all', label: t('labProcesses.allAreas') },
    ];
    processAreas.forEach((a) => {
      options.push({ value: a.id, label: a.name });
    });
    return options;
  }, [processAreas, t]);

  // Type Options for Filter
  const typeFilterOptions: SearchableSelectOption[] = [
    { value: 'all', label: t('labProcesses.allTypes') },
    { value: 'PRODUCTION', label: t('labProcesses.types.PRODUCTION') },
    { value: 'INTERNAL_VERIFICATION', label: t('labProcesses.types.INTERNAL_VERIFICATION') },
    { value: 'EXTERNAL_VERIFICATION', label: t('labProcesses.types.EXTERNAL_VERIFICATION') },
  ];

  // Process Type Options for Modal
  const processTypeModalOptions: SearchableSelectOption[] = [
    { value: 'PRODUCTION', label: t('labProcesses.types.PRODUCTION') },
    { value: 'INTERNAL_VERIFICATION', label: t('labProcesses.types.INTERNAL_VERIFICATION') },
    { value: 'EXTERNAL_VERIFICATION', label: t('labProcesses.types.EXTERNAL_VERIFICATION') },
  ];

  const modalAreaOptions: SearchableSelectOption[] = useMemo(() => {
    return processAreas.map((a) => ({ value: a.id, label: a.name }));
  }, [processAreas]);

  // Modal Assignee Options:
  // - PRODUCTION: displays both Admin and Technician
  // - INTERNAL_VERIFICATION: displays ONLY Admin
  const modalTechOptions: SearchableSelectOption[] = useMemo(() => {
    let list = technicians;
    if (formData.type === 'INTERNAL_VERIFICATION') {
      list = technicians.filter((item) => item.roleType === 'admin');
    }

    return list.map((item) => ({
      value: item.id,
      label: `${item.name} (${item.roleType === 'admin' ? t('labProcesses.roles.admin', 'Admin') : t('labProcesses.roles.technician', 'Technician')})`,
    }));
  }, [technicians, formData.type, t]);

  const modalBranchOptions: SearchableSelectOption[] = useMemo(() => {
    return branches.map((b) => ({ value: b.id, label: b.name }));
  }, [branches]);

  // Client-side filtering & pagination
  const filteredProcesses = useMemo(() => {
    let result = processes;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.processArea && p.processArea.name.toLowerCase().includes(q)) ||
          (p.defaultTechnician && p.defaultTechnician.name.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [processes, search]);

  const totalPages = Math.ceil(filteredProcesses.length / pageSize) || 1;
  const paginatedProcesses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProcesses.slice(start, start + pageSize);
  }, [filteredProcesses, currentPage, pageSize]);

  // Handle type change with instant select value correction
  const handleTypeChange = (newType: ProcessType) => {
    setFormData((prev) => {
      let nextAssigneeId = prev.defaultTechnicianId;

      if (newType === 'EXTERNAL_VERIFICATION') {
        nextAssigneeId = '';
      } else if (newType === 'INTERNAL_VERIFICATION') {
        // Must be an admin
        const currentAssignee = technicians.find((t) => t.id === prev.defaultTechnicianId);
        if (!currentAssignee || currentAssignee.roleType !== 'admin') {
          const firstAdmin = technicians.find((t) => t.roleType === 'admin');
          nextAssigneeId = firstAdmin ? firstAdmin.id : '';
        }
      } else if (newType === 'PRODUCTION') {
        // If empty, auto-select first available assignee
        if (!nextAssigneeId) {
          nextAssigneeId = technicians[0]?.id || '';
        }
      }

      return {
        ...prev,
        type: newType,
        defaultTechnicianId: nextAssigneeId,
      };
    });

    if (formErrors.defaultTechnicianId) {
      setFormErrors((prev) => ({ ...prev, defaultTechnicianId: '' }));
    }
  };

  // Handle branch change with instant state reset
  const handleBranchChange = (newBranchId: string) => {
    setFormData((prev) => ({
      ...prev,
      branchId: newBranchId,
      processAreaId: '',
      defaultTechnicianId: '',
    }));
    if (formErrors.branchId) {
      setFormErrors((prev) => ({ ...prev, branchId: '' }));
    }
  };

  // Auto-select assignee when technicians finish loading in create modal
  useEffect(() => {
    if (showCreateModal && !formData.defaultTechnicianId && technicians.length > 0) {
      if (formData.type === 'INTERNAL_VERIFICATION') {
        const admin = technicians.find((t) => t.roleType === 'admin');
        if (admin) setFormData((prev) => ({ ...prev, defaultTechnicianId: admin.id }));
      } else if (formData.type === 'PRODUCTION') {
        setFormData((prev) => ({ ...prev, defaultTechnicianId: technicians[0]?.id || '' }));
      }
    }
  }, [technicians, showCreateModal, formData.type]);

  // Open Create
  const openCreateModal = () => {
    const defaultBranch = branches[0]?.id || user?.activeBranchId || '';
    const initialAdmin = technicians.find((t) => t.roleType === 'admin')?.id;
    const initialTech = technicians[0]?.id;

    setFormData({
      name: '',
      type: 'PRODUCTION',
      processAreaId: processAreas[0]?.id || '',
      defaultTechnicianId: initialTech || initialAdmin || '',
      branchId: defaultBranch,
    });
    setFormErrors({});
    setShowCreateModal(true);
  };

  // Open Edit
  const openEditModal = (proc: ProcessRecord) => {
    setEditingProcess(proc);
    setFormData({
      name: proc.name,
      type: proc.type,
      processAreaId: proc.processAreaId || processAreas[0]?.id || '',
      defaultTechnicianId: proc.defaultTechnicianId || '',
      branchId: proc.branchId || branches[0]?.id || '',
    });
    setFormErrors({});
  };

  // Validate form
  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!formData.name.trim()) {
      errors.name = t('labProcesses.errors.nameRequired', 'Process name is required');
    }
    if (!formData.processAreaId) {
      errors.processAreaId = t('labProcesses.errors.areaRequired', 'Process area is mandatory');
    }
    if (formData.type === 'INTERNAL_VERIFICATION') {
      if (!formData.defaultTechnicianId) {
        errors.defaultTechnicianId = t('labProcesses.errors.adminAssigneeRequired', 'Internal verification requires a Lab Administrator');
      } else {
        const assigned = technicians.find((t) => t.id === formData.defaultTechnicianId);
        if (assigned && assigned.roleType !== 'admin') {
          errors.defaultTechnicianId = t('labProcesses.errors.adminAssigneeRequired', 'Internal verification requires a Lab Administrator');
        }
      }
    } else if (formData.type === 'PRODUCTION') {
      if (!formData.defaultTechnicianId) {
        errors.defaultTechnicianId = t('labProcesses.errors.assigneeRequired', 'Default technician or lab admin is mandatory');
      }
    }
    if (isTenantAdmin && !formData.branchId) {
      errors.branchId = t('labProcesses.modal.branchRequired', 'Branch selection is required');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Create Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        type: formData.type,
        processAreaId: formData.processAreaId || undefined,
        defaultTechnicianId: formData.type === 'EXTERNAL_VERIFICATION' ? undefined : (formData.defaultTechnicianId || undefined),
      };
      if (isTenantAdmin && formData.branchId) {
        payload.branchId = formData.branchId;
      }

      await api.post('/lab/processes', payload);
      toast.success(t('labProcesses.alerts.createSuccess', { name: formData.name }));
      setShowCreateModal(false);
      fetchProcesses();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('labProcesses.alerts.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProcess || !validateForm()) return;

    setSubmitting(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        type: formData.type,
        processAreaId: formData.processAreaId || null,
        defaultTechnicianId: formData.type === 'EXTERNAL_VERIFICATION' ? null : (formData.defaultTechnicianId || null),
      };
      if (isTenantAdmin && formData.branchId) {
        payload.branchId = formData.branchId;
      }

      await api.patch(`/lab/processes/${editingProcess.id}`, payload);
      toast.success(t('labProcesses.alerts.updateSuccess', { name: formData.name }));
      setEditingProcess(null);
      fetchProcesses();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('labProcesses.alerts.updateFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Confirm
  const handleDelete = async () => {
    if (!deletingProcess) return;

    setSubmitting(true);
    try {
      await api.delete(`/lab/processes/${deletingProcess.id}`);
      toast.success(t('labProcesses.alerts.deleteSuccess', { name: deletingProcess.name }));
      setDeletingProcess(null);
      fetchProcesses();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('labProcesses.alerts.deleteFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = processes.length;
    const prod = processes.filter((p) => p.type === 'PRODUCTION').length;
    const verif = total - prod;
    return { total, prod, verif };
  }, [processes]);

  // Render Type Badge
  const renderTypeBadge = (type: ProcessType) => {
    switch (type) {
      case 'PRODUCTION':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: 'var(--badge-info-bg)',
              color: 'var(--blue-500)',
            }}
          >
            <Workflow size={12} />
            {t('labProcesses.types.PRODUCTION')}
          </span>
        );
      case 'INTERNAL_VERIFICATION':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: 'var(--badge-warning-bg)',
              color: 'var(--amber-500)',
            }}
          >
            <ShieldCheck size={12} />
            {t('labProcesses.types.INTERNAL_VERIFICATION')}
          </span>
        );
      case 'EXTERNAL_VERIFICATION':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: 'var(--badge-primary-bg)',
              color: 'var(--primary-600)',
            }}
          >
            <Stethoscope size={12} />
            {t('labProcesses.types.EXTERNAL_VERIFICATION')}
          </span>
        );
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'var(--badge-primary-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-600)',
              }}
            >
              <Workflow size={20} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {t('labProcesses.pageTitle')}
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            {t('labProcesses.pageDesc')}
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={openCreateModal}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 600 }}
        >
          <Plus size={18} />
          <span>{t('labProcesses.createBtn')}</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'var(--badge-info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue-500)' }}>
            <Workflow size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('labProcesses.stats.totalProcesses')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)' }}>
              {stats.total}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'var(--badge-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--emerald-500)' }}>
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('labProcesses.stats.productionSteps')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)' }}>
              {stats.prod}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'var(--badge-warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber-500)' }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('labProcesses.stats.verificationSteps')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)' }}>
              {stats.verif}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('labProcesses.searchPlaceholder')}
              style={{ paddingLeft: '38px', width: '100%' }}
            />
          </div>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Branch Filter (Tenant Admin) */}
          {isTenantAdmin && branches.length > 0 && (
            <div style={{ width: '160px' }}>
              <SearchableSelect
                options={branchOptions}
                value={selectedBranchFilter}
                onChange={(val) => {
                  setSelectedBranchFilter(val);
                  setCurrentPage(1);
                }}
              />
            </div>
          )}

          {/* Area Filter */}
          <div style={{ width: '160px' }}>
            <SearchableSelect
              options={areaFilterOptions}
              value={selectedAreaFilter}
              onChange={(val) => {
                setSelectedAreaFilter(val);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Type Filter */}
          <div style={{ width: '170px' }}>
            <SearchableSelect
              options={typeFilterOptions}
              value={selectedTypeFilter}
              onChange={(val) => {
                setSelectedTypeFilter(val);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--table-th-bg)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('labProcesses.table.name')}
                </th>
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('labProcesses.table.type')}
                </th>
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('labProcesses.table.area')}
                </th>
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('labProcesses.table.assignee')}
                </th>
                {isTenantAdmin && (
                  <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {t('labProcesses.table.branch')}
                  </th>
                )}
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('labProcesses.table.created')}
                </th>
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>
                  {t('labProcesses.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isTenantAdmin ? 7 : 6} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t('common.loading')}
                  </td>
                </tr>
              ) : paginatedProcesses.length === 0 ? (
                <tr>
                  <td colSpan={isTenantAdmin ? 7 : 6} style={{ padding: '50px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <Workflow size={36} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)' }}>
                        {t('labProcesses.table.noProcessesTitle')}
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '400px', margin: 0 }}>
                        {t('labProcesses.table.noProcessesDesc')}
                      </p>
                      <button onClick={openCreateModal} className="btn btn-primary" style={{ marginTop: '10px' }}>
                        {t('labProcesses.table.createFirstBtn')}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProcesses.map((proc) => (
                  <tr key={proc.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.15s ease' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: '13.5px' }}>
                        {proc.name}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {renderTypeBadge(proc.type)}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '13px' }}>
                      {proc.processArea ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                          <Layers size={14} style={{ color: 'var(--text-muted)' }} />
                          <span>{proc.processArea.name}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '13px' }}>
                      {proc.type === 'EXTERNAL_VERIFICATION' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--primary-600)', fontWeight: 600 }}>
                          <Stethoscope size={14} />
                          {t('labProcesses.table.externalDocBadge')}
                        </span>
                      ) : proc.defaultTechnician ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                          <UserCheck size={14} style={{ color: 'var(--emerald-500)' }} />
                          <span>{proc.defaultTechnician.name}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                          {t('labProcesses.table.unassignedBadge')}
                        </span>
                      )}
                    </td>
                    {isTenantAdmin && (
                      <td style={{ padding: '10px 12px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                          <Building2 size={14} style={{ color: 'var(--text-muted)' }} />
                          <span>{proc.branch?.name || '—'}</span>
                        </div>
                      </td>
                    )}
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      {formatDate(proc.createdAt)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        {/* Edit Button: Lab Admin & Tenant Admin */}
                        <Tooltip content={t('labProcesses.table.editTooltip')}>
                          <button
                            onClick={() => openEditModal(proc)}
                            className="btn-icon"
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-main)',
                              cursor: 'pointer',
                            }}
                          >
                            <Edit2 size={14} />
                          </button>
                        </Tooltip>

                        {/* Delete Button: Tenant Admin ONLY */}
                        {isTenantAdmin && (
                          <Tooltip content={t('labProcesses.table.deleteTooltip')}>
                            <button
                              onClick={() => setDeletingProcess(proc)}
                              className="btn-icon"
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid var(--badge-danger-border, #fecdd3)',
                                backgroundColor: 'var(--badge-danger-bg)',
                                color: 'var(--badge-danger-text)',
                                cursor: 'pointer',
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredProcesses.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredProcesses.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        )}
      </div>

      {/* Create / Edit Modal */}
      {(showCreateModal || editingProcess) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '540px',
              padding: 0,
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                  {editingProcess ? t('labProcesses.modal.editTitle') : t('labProcesses.modal.createTitle')}
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  {editingProcess ? t('labProcesses.modal.editSubtitle') : t('labProcesses.modal.createSubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingProcess(null);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={editingProcess ? handleEditSubmit : handleCreateSubmit} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Process Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                    {t('labProcesses.modal.name')} *
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t('labProcesses.modal.namePlaceholder')}
                    style={{ width: '100%', borderColor: formErrors.name ? 'var(--badge-danger-text)' : undefined }}
                  />
                  {formErrors.name && (
                    <span style={{ fontSize: '12px', color: 'var(--badge-danger-text)', marginTop: '4px', display: 'block' }}>
                      {formErrors.name}
                    </span>
                  )}
                </div>

                {/* Process Type */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                    {t('labProcesses.modal.type')} *
                  </label>
                  <SearchableSelect
                    options={processTypeModalOptions}
                    value={formData.type}
                    onChange={(val) => handleTypeChange(val as ProcessType)}
                  />
                </div>

                {/* Process Area — Always displayed & strictly mandatory */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                    {t('labProcesses.modal.area')} *
                  </label>
                  <SearchableSelect
                    options={modalAreaOptions}
                    value={formData.processAreaId}
                    onChange={(val) => setFormData({ ...formData, processAreaId: val })}
                    placeholder={t('labProcesses.modal.areaPlaceholder')}
                  />
                  {formErrors.processAreaId && (
                    <span style={{ fontSize: '12px', color: 'var(--badge-danger-text)', marginTop: '4px', display: 'block' }}>
                      {formErrors.processAreaId}
                    </span>
                  )}
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    {t('labProcesses.modal.areaHelp')}
                  </span>
                </div>

                {/* If External Verification: Show prescribing doctor banner */}
                {formData.type === 'EXTERNAL_VERIFICATION' ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--badge-primary-bg)',
                      color: 'var(--primary-700)',
                      fontSize: '13px',
                      lineHeight: 1.5,
                    }}
                  >
                    <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{t('labProcesses.modal.externalVerificationHelp')}</span>
                  </div>
                ) : (
                  /* Default Technician / Lab Admin:
                     - Internal Verification: Displays ONLY Lab Admins
                     - Production: Displays both Lab Admins and Technicians
                  */
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                      {formData.type === 'INTERNAL_VERIFICATION'
                        ? `${t('labProcesses.modal.assigneeAdmin', 'Default Assignee (Lab Admin)')} *`
                        : `${t('labProcesses.modal.assigneeProduction', 'Default Assignee (Admin / Technician)')} *`
                      }
                    </label>
                    <SearchableSelect
                      options={modalTechOptions}
                      value={formData.defaultTechnicianId}
                      onChange={(val) => {
                        setFormData({ ...formData, defaultTechnicianId: val });
                        if (formErrors.defaultTechnicianId) {
                          setFormErrors({ ...formErrors, defaultTechnicianId: '' });
                        }
                      }}
                      placeholder={formData.type === 'INTERNAL_VERIFICATION'
                        ? t('labProcesses.modal.assigneeAdminPlaceholder', 'Select lab admin...')
                        : t('labProcesses.modal.assigneePlaceholder', 'Select technician or admin...')
                      }
                    />
                    {formErrors.defaultTechnicianId && (
                      <span style={{ fontSize: '12px', color: 'var(--badge-danger-text)', marginTop: '4px', display: 'block' }}>
                        {formErrors.defaultTechnicianId}
                      </span>
                    )}
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      {formData.type === 'INTERNAL_VERIFICATION'
                        ? t('labProcesses.modal.assigneeAdminHelp', 'Internal verification must be verified by a Lab Administrator in this branch')
                        : t('labProcesses.modal.assigneeHelp', 'Assigns this production step to a technician or lab administrator in this branch')
                      }
                    </span>
                  </div>
                )}

                {/* Branch Selection (Tenant Admin only) */}
                {isTenantAdmin && (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                      {t('labProcesses.modal.branch')} *
                    </label>
                    <SearchableSelect
                      options={modalBranchOptions}
                      value={formData.branchId}
                      onChange={(val) => handleBranchChange(val)}
                      placeholder={t('labProcesses.modal.branchPlaceholder')}
                    />
                    {formErrors.branchId && (
                      <span style={{ fontSize: '12px', color: 'var(--badge-danger-text)', marginTop: '4px', display: 'block' }}>
                        {formErrors.branchId}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '28px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingProcess(null);
                  }}
                  disabled={submitting}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ minWidth: '120px' }}
                >
                  {submitting
                    ? t('labProcesses.modal.submitting')
                    : editingProcess
                    ? t('labProcesses.modal.submitEdit')
                    : t('labProcesses.modal.submitCreate')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Tenant Admin Only) */}
      {deletingProcess && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--badge-danger-bg)',
                  color: 'var(--badge-danger-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                  {t('labProcesses.deleteModal.title')}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  {t('labProcesses.deleteModal.confirm', { name: deletingProcess.name })}
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-surface-muted)',
                padding: '12px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'var(--text-muted)',
                marginBottom: '24px',
                lineHeight: 1.5,
              }}
            >
              {t('labProcesses.deleteModal.warning')}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setDeletingProcess(null)}
                disabled={submitting}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="btn"
                style={{
                  backgroundColor: 'var(--rose-600, #e11d48)',
                  color: '#ffffff',
                  fontWeight: 600,
                }}
              >
                {submitting ? t('common.loading') : t('labProcesses.deleteModal.confirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
