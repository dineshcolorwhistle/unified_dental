import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import { SearchableSelect, SearchableSelectOption } from '../../components/common/SearchableSelect';
import { Tooltip } from '../../components/common/Tooltip';
import { Pagination } from '../../components/common/Pagination';
import { formatDate, formatCurrency } from '../../core/utils/dateUtils';
import {
  Shapes,
  Plus,
  Search,
  Building2,
  Trash2,
  Edit2,
  X,
  Workflow,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ListOrdered,
  Layers,
  Sparkles,
} from 'lucide-react';

interface ProcessAssignment {
  id: string;
  sequence: number;
  process: {
    id: string;
    name: string;
    type: string;
    processArea?: {
      id: string;
      name: string;
    } | null;
  };
}

interface ProsthesisTypeRecord {
  id: string;
  name: string;
  description?: string | null;
  price: number | string;
  branchId?: string | null;
  createdAt: string;
  branch: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
  processAssignments: ProcessAssignment[];
}

export const LabProsthesisPage: React.FC = () => {
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

  const [types, setTypes] = useState<ProsthesisTypeRecord[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [availableProcesses, setAvailableProcesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingType, setEditingType] = useState<ProsthesisTypeRecord | null>(null);
  const [reorderingType, setReorderingType] = useState<ProsthesisTypeRecord | null>(null);
  const [deletingType, setDeletingType] = useState<ProsthesisTypeRecord | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    branchId: '',
    processIds: [] as string[],
  });

  const [selectedProcessToAdd, setSelectedProcessToAdd] = useState('');
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Reorder Modal State
  const [reorderStepIds, setReorderStepIds] = useState<string[]>([]);

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

  // Fetch available processes for active branch
  const activeBranchId = isTenantAdmin
    ? (formData.branchId || (selectedBranchFilter !== 'all' ? selectedBranchFilter : branches[0]?.id))
    : (user?.activeBranchId || user?.availableBranches?.[0]?.id);

  useEffect(() => {
    const fetchProcesses = async () => {
      try {
        const res = await api.get('/lab/processes', {
          params: activeBranchId ? { branchId: activeBranchId } : {},
        });
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setAvailableProcesses(list);
      } catch (err) {
        console.error('Failed to load processes for branch', err);
      }
    };
    if (activeBranchId || showCreateModal || editingType) {
      fetchProcesses();
    }
  }, [activeBranchId, showCreateModal, editingType]);

  // Fetch Prosthesis Types
  const fetchTypes = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (selectedBranchFilter && selectedBranchFilter !== 'all') {
        params.branchId = selectedBranchFilter;
      }
      if (search.trim()) {
        params.search = search.trim();
      }

      const res = await api.get('/lab/prosthesis-types', { params });
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setTypes(list);
    } catch (err: any) {
      console.error('Failed to fetch prosthesis types', err);
      toast.error(err?.response?.data?.message || t('labProsthesisTypes.alerts.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, [selectedBranchFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTypes();
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

  const modalBranchOptions: SearchableSelectOption[] = useMemo(() => {
    return branches.map((b) => ({ value: b.id, label: b.name }));
  }, [branches]);

  // Process Select Options for Recipe Builder
  const processSelectOptions: SearchableSelectOption[] = useMemo(() => {
    return availableProcesses.map((p) => ({
      value: p.id,
      label: `${p.name} (${p.processArea?.name || p.type})`,
    }));
  }, [availableProcesses]);

  // Client-side filtering & pagination
  const filteredTypes = useMemo(() => {
    let result = types;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [types, search]);

  const totalPages = Math.ceil(filteredTypes.length / pageSize) || 1;
  const paginatedTypes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTypes.slice(start, start + pageSize);
  }, [filteredTypes, currentPage, pageSize]);

  // Open Create
  const openCreateModal = () => {
    setFormData({
      name: '',
      description: '',
      price: 0,
      branchId: branches[0]?.id || '',
      processIds: [],
    });
    setSelectedProcessToAdd('');
    setFormErrors({});
    setShowCreateModal(true);
  };

  // Open Edit
  const openEditModal = (item: ProsthesisTypeRecord) => {
    setEditingType(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      price: Number(item.price) || 0,
      branchId: item.branchId || branches[0]?.id || '',
      processIds: item.processAssignments.map((a) => a.process.id),
    });
    setSelectedProcessToAdd('');
    setFormErrors({});
  };

  // Open Reorder Modal
  const openReorderModal = (item: ProsthesisTypeRecord) => {
    setReorderingType(item);
    setReorderStepIds(item.processAssignments.map((a) => a.process.id));
  };

  // Add process step
  const handleAddStep = () => {
    if (!selectedProcessToAdd) return;
    setFormData((prev) => ({
      ...prev,
      processIds: [...prev.processIds, selectedProcessToAdd],
    }));
    setSelectedProcessToAdd('');
  };

  // Remove step
  const handleRemoveStep = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      processIds: prev.processIds.filter((_, i) => i !== index),
    }));
  };

  // Move step up in form
  const handleMoveStepUp = (index: number) => {
    if (index === 0) return;
    setFormData((prev) => {
      const copy = [...prev.processIds];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return { ...prev, processIds: copy };
    });
  };

  // Move step down in form
  const handleMoveStepDown = (index: number) => {
    setFormData((prev) => {
      if (index >= prev.processIds.length - 1) return prev;
      const copy = [...prev.processIds];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return { ...prev, processIds: copy };
    });
  };

  // Validate form
  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!formData.name.trim()) {
      errors.name = t('labProsthesisTypes.modal.nameRequired', 'Prosthesis name is required');
    }
    if (formData.price < 0) {
      errors.price = 'Price cannot be negative';
    }
    if (isTenantAdmin && !formData.branchId) {
      errors.branchId = 'Branch selection is required';
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
        description: formData.description.trim() || undefined,
        price: Number(formData.price) || 0,
        processIds: formData.processIds,
      };
      if (isTenantAdmin && formData.branchId) {
        payload.branchId = formData.branchId;
      }

      await api.post('/lab/prosthesis-types', payload);
      toast.success(t('labProsthesisTypes.alerts.createSuccess', { name: formData.name }));
      setShowCreateModal(false);
      fetchTypes();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('labProsthesisTypes.alerts.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingType || !validateForm()) return;

    setSubmitting(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        price: Number(formData.price) || 0,
        processIds: formData.processIds,
      };
      if (isTenantAdmin && formData.branchId) {
        payload.branchId = formData.branchId;
      }

      await api.patch(`/lab/prosthesis-types/${editingType.id}`, payload);
      toast.success(t('labProsthesisTypes.alerts.updateSuccess', { name: formData.name }));
      setEditingType(null);
      fetchTypes();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('labProsthesisTypes.alerts.updateFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Reorder Submit
  const handleReorderSubmit = async () => {
    if (!reorderingType) return;

    setSubmitting(true);
    try {
      await api.put(`/lab/prosthesis-types/${reorderingType.id}/reorder`, {
        processIds: reorderStepIds,
      });
      toast.success(t('labProsthesisTypes.reorderModal.reorderSuccess'));
      setReorderingType(null);
      fetchTypes();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('labProsthesisTypes.reorderModal.reorderFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Confirm
  const handleDelete = async () => {
    if (!deletingType) return;

    setSubmitting(true);
    try {
      await api.delete(`/lab/prosthesis-types/${deletingType.id}`);
      toast.success(t('labProsthesisTypes.alerts.deleteSuccess', { name: deletingType.name }));
      setDeletingType(null);
      fetchTypes();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('labProsthesisTypes.alerts.deleteFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to get process by ID
  const getProcessById = (id: string) => {
    return availableProcesses.find((p) => p.id === id);
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = types.length;
    const configuredCount = types.filter((t) => (t.processAssignments?.length || 0) > 0).length;
    return { total, configuredCount };
  }, [types]);

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
              <Shapes size={20} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {t('labProsthesisTypes.pageTitle')}
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            {t('labProsthesisTypes.pageDesc')}
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={openCreateModal}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 600 }}
        >
          <Plus size={18} />
          <span>{t('labProsthesisTypes.createBtn')}</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'var(--badge-info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue-500)' }}>
            <Shapes size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('labProsthesisTypes.stats.totalTypes')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)' }}>
              {stats.total}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'var(--badge-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--emerald-500)' }}>
            <Workflow size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('labProsthesisTypes.stats.configuredRecipes')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)' }}>
              {stats.configuredCount}{' '}
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>
                / {stats.total}
              </span>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'var(--badge-warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber-500)' }}>
            <Building2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('labProsthesisTypes.stats.branchScope')}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)' }}>
              {isLabAdmin ? (types[0]?.branch?.name || 'Assigned Branch') : (selectedBranchFilter === 'all' ? t('labProcessAreas.allBranches') : branches.find((b) => b.id === selectedBranchFilter)?.name || 'Branch')}
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
              placeholder={t('labProsthesisTypes.searchPlaceholder')}
              style={{ paddingLeft: '38px', width: '100%' }}
            />
          </div>
        </form>

        {isTenantAdmin && branches.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '220px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {t('labProsthesisTypes.filterBranch')}:
            </span>
            <div style={{ width: '180px' }}>
              <SearchableSelect
                options={branchOptions}
                value={selectedBranchFilter}
                onChange={(val) => {
                  setSelectedBranchFilter(val);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--table-th-bg)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('labProsthesisTypes.table.name')}
                </th>
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('labProsthesisTypes.table.price')}
                </th>
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('labProsthesisTypes.table.workflowSequence')}
                </th>
                {isTenantAdmin && (
                  <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {t('labProsthesisTypes.table.branch')}
                  </th>
                )}
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('labProsthesisTypes.table.created')}
                </th>
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>
                  {t('labProsthesisTypes.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isTenantAdmin ? 6 : 5} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t('common.loading')}
                  </td>
                </tr>
              ) : paginatedTypes.length === 0 ? (
                <tr>
                  <td colSpan={isTenantAdmin ? 6 : 5} style={{ padding: '50px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <Shapes size={36} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)' }}>
                        {t('labProsthesisTypes.table.noTypesTitle')}
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '400px', margin: 0 }}>
                        {t('labProsthesisTypes.table.noTypesDesc')}
                      </p>
                      <button onClick={openCreateModal} className="btn btn-primary" style={{ marginTop: '10px' }}>
                        {t('labProsthesisTypes.table.createFirstBtn')}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTypes.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.15s ease' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: '13.5px' }}>
                          {item.name}
                        </div>
                        {item.description && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {item.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {formatCurrency(Number(item.price))}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {item.processAssignments.length === 0 ? (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          {t('labProsthesisTypes.table.noStepsConfigured')}
                        </span>
                      ) : (
                        <Tooltip
                          position="top"
                          content={
                            <div style={{ padding: '4px 2px', minWidth: '170px', maxWidth: '280px', whiteSpace: 'normal' }}>
                              <div
                                style={{
                                  fontWeight: 700,
                                  fontSize: '11px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                  color: '#93c5fd',
                                  borderBottom: '1px solid rgba(255,255,255,0.15)',
                                  paddingBottom: '4px',
                                  marginBottom: '6px',
                                }}
                              >
                                {t('labProsthesisTypes.table.assignedProcesses')} ({item.processAssignments.length})
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {item.processAssignments.map((assignment, idx) => (
                                  <div
                                    key={assignment.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: '6px',
                                      fontSize: '12px',
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '11px', minWidth: '16px' }}>
                                      {idx + 1}.
                                    </span>
                                    <span style={{ color: '#f8fafc' }}>
                                      {assignment.process.name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          }
                        >
                          <span
                            className="badge"
                            style={{
                              cursor: 'pointer',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 600,
                              backgroundColor: 'var(--badge-info-bg)',
                              color: 'var(--blue-500)',
                              border: '1px solid var(--border-color)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <Workflow size={13} />
                            <span>
                              {item.processAssignments.length}{' '}
                              {t(item.processAssignments.length === 1 ? 'labProsthesisTypes.table.step' : 'labProsthesisTypes.table.steps')}
                            </span>
                          </span>
                        </Tooltip>
                      )}
                    </td>
                    {isTenantAdmin && (
                      <td style={{ padding: '10px 12px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                          <Building2 size={14} style={{ color: 'var(--text-muted)' }} />
                          <span>{item.branch?.name || '—'}</span>
                        </div>
                      </td>
                    )}
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      {formatDate(item.createdAt)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        {/* Edit Button: Lab Admin & Tenant Admin */}
                        <Tooltip content={t('labProsthesisTypes.table.editTooltip')}>
                          <button
                            onClick={() => openEditModal(item)}
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

                        {/* Reorder Button */}
                        {item.processAssignments.length > 1 && (
                          <Tooltip content={t('labProsthesisTypes.table.reorderTooltip')}>
                            <button
                              onClick={() => openReorderModal(item)}
                              className="btn-icon"
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--badge-info-bg)',
                                color: 'var(--blue-500)',
                                cursor: 'pointer',
                              }}
                            >
                              <ListOrdered size={14} />
                            </button>
                          </Tooltip>
                        )}

                        {/* Delete Button: Tenant Admin ONLY */}
                        {isTenantAdmin && (
                          <Tooltip content={t('labProsthesisTypes.table.deleteTooltip')}>
                            <button
                              onClick={() => setDeletingType(item)}
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
        {filteredTypes.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredTypes.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        )}
      </div>

      {/* Create / Edit Modal with Recipe Builder */}
      {(showCreateModal || editingType) && (
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
              maxWidth: '640px',
              maxHeight: '90vh',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Modal Header */}
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
                  {editingType
                    ? t('labProsthesisTypes.modal.editTitle')
                    : t('labProsthesisTypes.modal.createTitle')}
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  {editingType
                    ? t('labProsthesisTypes.modal.editSubtitle')
                    : t('labProsthesisTypes.modal.createSubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingType(null);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form
              onSubmit={editingType ? handleEditSubmit : handleCreateSubmit}
              style={{ padding: '24px', overflowY: 'auto', flex: 1 }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                    {t('labProsthesisTypes.modal.name')} *
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t('labProsthesisTypes.modal.namePlaceholder')}
                    style={{ width: '100%', borderColor: formErrors.name ? 'var(--badge-danger-text)' : undefined }}
                  />
                  {formErrors.name && (
                    <span style={{ fontSize: '12px', color: 'var(--badge-danger-text)', marginTop: '4px', display: 'block' }}>
                      {formErrors.name}
                    </span>
                  )}
                </div>

                {/* Price */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                    {t('labProsthesisTypes.modal.price')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    placeholder={t('labProsthesisTypes.modal.pricePlaceholder')}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                    {t('labProsthesisTypes.modal.description')}
                  </label>
                  <textarea
                    className="input"
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t('labProsthesisTypes.modal.descriptionPlaceholder')}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>

                {/* Branch Selection (Tenant Admin) */}
                {isTenantAdmin && (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                      {t('labProsthesisTypes.modal.branch')} *
                    </label>
                    <SearchableSelect
                      options={modalBranchOptions}
                      value={formData.branchId}
                      onChange={(val) => setFormData({ ...formData, branchId: val })}
                      placeholder={t('labProsthesisTypes.modal.branchPlaceholder')}
                    />
                    {formErrors.branchId && (
                      <span style={{ fontSize: '12px', color: 'var(--badge-danger-text)', marginTop: '4px', display: 'block' }}>
                        {formErrors.branchId}
                      </span>
                    )}
                  </div>
                )}

                {/* ─── Workflow Recipe Builder Section ─── */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '18px', marginTop: '6px' }}>
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {t('labProsthesisTypes.modal.workflowRecipeTitle')}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {t('labProsthesisTypes.modal.workflowRecipeSubtitle')}
                    </div>
                  </div>

                  {/* Add Step Picker Row */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <SearchableSelect
                        options={processSelectOptions}
                        value={selectedProcessToAdd}
                        onChange={(val) => setSelectedProcessToAdd(val)}
                        placeholder={t('labProsthesisTypes.modal.selectProcessPlaceholder')}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddStep}
                      disabled={!selectedProcessToAdd}
                      className="btn btn-primary"
                      style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Plus size={16} />
                      {t('labProsthesisTypes.modal.addStepBtn')}
                    </button>
                  </div>

                  {/* Step List */}
                  {formData.processIds.length === 0 ? (
                    <div
                      style={{
                        padding: '24px',
                        textAlign: 'center',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-surface-muted)',
                        color: 'var(--text-muted)',
                        fontSize: '13px',
                      }}
                    >
                      {t('labProsthesisTypes.modal.noStepsAdded')}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {formData.processIds.map((procId, idx) => {
                        const proc = getProcessById(procId);
                        return (
                          <div
                            key={`${procId}-${idx}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 14px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-color)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '6px',
                                  backgroundColor: 'var(--badge-primary-bg)',
                                  color: 'var(--primary-600)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '12px',
                                  fontWeight: 800,
                                }}
                              >
                                {idx + 1}
                              </span>
                              <div>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                                  {proc?.name || procId}
                                </span>
                                {proc?.processArea && (
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                                    • {proc.processArea.name}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => handleMoveStepUp(idx)}
                                disabled={idx === 0}
                                className="btn-icon"
                                style={{
                                  padding: '4px',
                                  opacity: idx === 0 ? 0.3 : 1,
                                  cursor: idx === 0 ? 'default' : 'pointer',
                                }}
                              >
                                <ArrowUp size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveStepDown(idx)}
                                disabled={idx === formData.processIds.length - 1}
                                className="btn-icon"
                                style={{
                                  padding: '4px',
                                  opacity: idx === formData.processIds.length - 1 ? 0.3 : 1,
                                  cursor: idx === formData.processIds.length - 1 ? 'default' : 'pointer',
                                }}
                              >
                                <ArrowDown size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveStep(idx)}
                                className="btn-icon"
                                style={{
                                  padding: '4px',
                                  color: 'var(--rose-600, #e11d48)',
                                  cursor: 'pointer',
                                  marginLeft: '6px',
                                }}
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
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
                    setEditingType(null);
                  }}
                  disabled={submitting}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ minWidth: '130px' }}
                >
                  {submitting
                    ? t('labProsthesisTypes.modal.submitting')
                    : editingType
                    ? t('labProsthesisTypes.modal.submitEdit')
                    : t('labProsthesisTypes.modal.submitCreate')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dedicated Reorder Modal */}
      {reorderingType && (
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
              maxWidth: '520px',
              padding: 0,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
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
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                  {t('labProsthesisTypes.reorderModal.title')}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  {t('labProsthesisTypes.reorderModal.subtitle', { name: reorderingType.name })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReorderingType(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                {reorderStepIds.map((procId, idx) => {
                  const proc = getProcessById(procId) || reorderingType.processAssignments.find((a) => a.process.id === procId)?.process;
                  return (
                    <div
                      key={`reorder-${procId}-${idx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--badge-primary-bg)',
                            color: 'var(--primary-600)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '13px',
                            fontWeight: 800,
                          }}
                        >
                          {idx + 1}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-heading)' }}>
                          {proc?.name || procId}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (idx === 0) return;
                            const copy = [...reorderStepIds];
                            const temp = copy[idx - 1];
                            copy[idx - 1] = copy[idx];
                            copy[idx] = temp;
                            setReorderStepIds(copy);
                          }}
                          disabled={idx === 0}
                          className="btn-icon"
                          style={{ padding: '5px', opacity: idx === 0 ? 0.3 : 1, cursor: idx === 0 ? 'default' : 'pointer' }}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (idx >= reorderStepIds.length - 1) return;
                            const copy = [...reorderStepIds];
                            const temp = copy[idx + 1];
                            copy[idx + 1] = copy[idx];
                            copy[idx] = temp;
                            setReorderStepIds(copy);
                          }}
                          disabled={idx === reorderStepIds.length - 1}
                          className="btn-icon"
                          style={{ padding: '5px', opacity: idx === reorderStepIds.length - 1 ? 0.3 : 1, cursor: idx === reorderStepIds.length - 1 ? 'default' : 'pointer' }}
                        >
                          <ArrowDown size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setReorderingType(null)}
                  disabled={submitting}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleReorderSubmit}
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ minWidth: '140px' }}
                >
                  {submitting
                    ? t('labProsthesisTypes.reorderModal.reorderingBtn')
                    : t('labProsthesisTypes.reorderModal.saveReorderBtn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Tenant Admin Only) */}
      {deletingType && (
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
                  {t('labProsthesisTypes.deleteModal.title')}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  {t('labProsthesisTypes.deleteModal.confirm', { name: deletingType.name })}
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
              {t('labProsthesisTypes.deleteModal.warning')}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setDeletingType(null)}
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
                {submitting ? t('common.loading') : t('labProsthesisTypes.deleteModal.confirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
