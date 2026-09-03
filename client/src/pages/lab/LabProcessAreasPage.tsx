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
  Layers,
  Plus,
  Search,
  Building2,
  Trash2,
  Edit2,
  X,
  Workflow,
  AlertTriangle,
} from 'lucide-react';

interface ProcessAreaRecord {
  id: string;
  name: string;
  description?: string | null;
  branchId?: string | null;
  createdAt: string;
  branch: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
  _count: {
    processes: number;
  };
}

export const LabProcessAreasPage: React.FC = () => {
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

  const [areas, setAreas] = useState<ProcessAreaRecord[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingArea, setEditingArea] = useState<ProcessAreaRecord | null>(null);
  const [deletingArea, setDeletingArea] = useState<ProcessAreaRecord | null>(null);

  // Form States
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    branchId: '',
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Fetch branches (for Tenant Admin)
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

  // Fetch Process Areas
  const fetchAreas = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (selectedBranchFilter && selectedBranchFilter !== 'all') {
        params.branchId = selectedBranchFilter;
      }
      if (search.trim()) {
        params.search = search.trim();
      }

      const res = await api.get('/lab/process-areas', { params });
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setAreas(list);
    } catch (err: any) {
      console.error('Failed to fetch process areas', err);
      toast.error(err?.response?.data?.message || t('labProcessAreas.alerts.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAreas();
  }, [selectedBranchFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAreas();
  };

  // Branch Options for Select
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

  // Client-side filtering & pagination
  const filteredAreas = useMemo(() => {
    let result = areas;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.description && a.description.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [areas, search]);

  const totalPages = Math.ceil(filteredAreas.length / pageSize) || 1;
  const paginatedAreas = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAreas.slice(start, start + pageSize);
  }, [filteredAreas, currentPage, pageSize]);

  // Open Create Modal
  const openCreateModal = () => {
    setFormData({
      name: '',
      description: '',
      branchId: branches[0]?.id || '',
    });
    setFormErrors({});
    setShowCreateModal(true);
  };

  // Open Edit Modal
  const openEditModal = (area: ProcessAreaRecord) => {
    setEditingArea(area);
    setFormData({
      name: area.name,
      description: area.description || '',
      branchId: area.branchId || branches[0]?.id || '',
    });
    setFormErrors({});
  };

  // Validate form
  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!formData.name.trim()) {
      errors.name = 'Area name is required';
    }
    if (isTenantAdmin && !formData.branchId) {
      errors.branchId = 'Branch selection is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Create Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      };
      if (isTenantAdmin && formData.branchId) {
        payload.branchId = formData.branchId;
      }

      await api.post('/lab/process-areas', payload);
      toast.success(t('labProcessAreas.alerts.createSuccess', { name: formData.name }));
      setShowCreateModal(false);
      fetchAreas();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('labProcessAreas.alerts.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArea || !validateForm()) return;

    setSubmitting(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      };
      if (isTenantAdmin && formData.branchId) {
        payload.branchId = formData.branchId;
      }

      await api.patch(`/lab/process-areas/${editingArea.id}`, payload);
      toast.success(t('labProcessAreas.alerts.updateSuccess', { name: formData.name }));
      setEditingArea(null);
      fetchAreas();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('labProcessAreas.alerts.updateFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Confirm
  const handleDelete = async () => {
    if (!deletingArea) return;

    setSubmitting(true);
    try {
      await api.delete(`/lab/process-areas/${deletingArea.id}`);
      toast.success(t('labProcessAreas.alerts.deleteSuccess', { name: deletingArea.name }));
      setDeletingArea(null);
      fetchAreas();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('labProcessAreas.alerts.deleteFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Summary stats
  const totalLinkedProcesses = useMemo(() => {
    return areas.reduce((sum, a) => sum + (a._count?.processes || 0), 0);
  }, [areas]);

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
              <Layers size={20} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {t('labProcessAreas.pageTitle')}
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            {t('labProcessAreas.pageDesc')}
          </p>
        </div>

        {/* Action Button: Lab Admin and Tenant Admin can create */}
        <button
          onClick={openCreateModal}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 600 }}
        >
          <Plus size={18} />
          <span>{t('labProcessAreas.createBtn')}</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'var(--badge-info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue-500)' }}>
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('labProcessAreas.stats.totalAreas')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)' }}>
              {areas.length}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'var(--badge-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--emerald-500)' }}>
            <Workflow size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('labProcessAreas.stats.activeProcesses')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)' }}>
              {totalLinkedProcesses}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'var(--badge-warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber-500)' }}>
            <Building2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('labProcessAreas.stats.branchScope')}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)' }}>
              {isLabAdmin ? (areas[0]?.branch?.name || 'Assigned Branch') : (selectedBranchFilter === 'all' ? t('labProcessAreas.allBranches') : branches.find((b) => b.id === selectedBranchFilter)?.name || 'Branch')}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('labProcessAreas.searchPlaceholder')}
              style={{ paddingLeft: '38px', width: '100%' }}
            />
          </div>
        </form>

        {isTenantAdmin && branches.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '220px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {t('labProcessAreas.filterBranch')}:
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

      {/* Data Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--table-th-bg)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('labProcessAreas.table.name')}
                </th>
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('labProcessAreas.table.description')}
                </th>
                {isTenantAdmin && (
                  <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {t('labProcessAreas.table.branch')}
                  </th>
                )}
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('labProcessAreas.table.processesCount')}
                </th>
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('labProcessAreas.table.created')}
                </th>
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>
                  {t('labProcessAreas.table.actions')}
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
              ) : paginatedAreas.length === 0 ? (
                <tr>
                  <td colSpan={isTenantAdmin ? 6 : 5} style={{ padding: '50px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <Layers size={36} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)' }}>
                        {t('labProcessAreas.table.noAreasTitle')}
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '400px', margin: 0 }}>
                        {t('labProcessAreas.table.noAreasDesc')}
                      </p>
                      <button onClick={openCreateModal} className="btn btn-primary" style={{ marginTop: '10px' }}>
                        {t('labProcessAreas.table.createFirstBtn')}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedAreas.map((area) => (
                  <tr key={area.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.15s ease' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--badge-primary-bg)',
                            color: 'var(--primary-600)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '13px',
                          }}
                        >
                          {area.name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: '13.5px' }}>
                          {area.name}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '13px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {area.description || '—'}
                    </td>
                    {isTenantAdmin && (
                      <td style={{ padding: '10px 12px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                          <Building2 size={14} style={{ color: 'var(--text-muted)' }} />
                          <span>{area.branch?.name || '—'}</span>
                        </div>
                      </td>
                    )}
                    <td style={{ padding: '10px 12px', fontSize: '13px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 700,
                          backgroundColor: area._count.processes > 0 ? 'var(--badge-info-bg)' : 'var(--bg-surface-muted)',
                          color: area._count.processes > 0 ? 'var(--blue-500)' : 'var(--text-muted)',
                        }}
                      >
                        <Workflow size={12} />
                        {area._count.processes}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      {formatDate(area.createdAt)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        {/* Edit Button: Lab Admin & Tenant Admin */}
                        <Tooltip content={t('labProcessAreas.table.editTooltip')}>
                          <button
                            onClick={() => openEditModal(area)}
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
                          <Tooltip content={t('labProcessAreas.table.deleteTooltip')}>
                            <button
                              onClick={() => setDeletingArea(area)}
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

        {/* Pagination Bar */}
        {filteredAreas.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredAreas.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        )}
      </div>

      {/* Create / Edit Modal */}
      {(showCreateModal || editingArea) && (
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
              overflow: 'hidden',
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
                  {editingArea
                    ? t('labProcessAreas.modal.editTitle')
                    : t('labProcessAreas.modal.createTitle')}
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  {editingArea
                    ? t('labProcessAreas.modal.editSubtitle')
                    : t('labProcessAreas.modal.createSubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingArea(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={editingArea ? handleEditSubmit : handleCreateSubmit} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                    {t('labProcessAreas.modal.name')} *
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t('labProcessAreas.modal.namePlaceholder')}
                    style={{ width: '100%', borderColor: formErrors.name ? 'var(--badge-danger-text)' : undefined }}
                  />
                  {formErrors.name && (
                    <span style={{ fontSize: '12px', color: 'var(--badge-danger-text)', marginTop: '4px', display: 'block' }}>
                      {formErrors.name}
                    </span>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                    {t('labProcessAreas.modal.description')}
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t('labProcessAreas.modal.descriptionPlaceholder')}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>

                {/* Branch Selection (Tenant Admin only) */}
                {isTenantAdmin && (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                      {t('labProcessAreas.modal.branch')} *
                    </label>
                    <SearchableSelect
                      options={modalBranchOptions}
                      value={formData.branchId}
                      onChange={(val) => setFormData({ ...formData, branchId: val })}
                      placeholder={t('labProcessAreas.modal.branchPlaceholder')}
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
                    setEditingArea(null);
                  }}
                  disabled={submitting}
                >
                  {t('labProcessAreas.modal.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ minWidth: '120px' }}
                >
                  {submitting
                    ? t('labProcessAreas.modal.submitting')
                    : editingArea
                    ? t('labProcessAreas.modal.submitEdit')
                    : t('labProcessAreas.modal.submitCreate')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Tenant Admin Only) */}
      {deletingArea && (
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
                  {t('labProcessAreas.deleteModal.title')}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  {t('labProcessAreas.deleteModal.confirm', { name: deletingArea.name })}
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
              {t('labProcessAreas.deleteModal.warning')}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setDeletingArea(null)}
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
                {submitting ? t('common.loading') : t('labProcessAreas.deleteModal.confirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
