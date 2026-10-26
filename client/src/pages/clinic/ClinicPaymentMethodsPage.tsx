import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { Tooltip } from '../../components/common/Tooltip';
import { Pagination } from '../../components/common/Pagination';
import {
  CreditCard,
  Plus,
  Search,
  Building2,
  Trash2,
  Edit2,
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import {
  paymentMethodService,
  PaymentMethodItem,
} from '../../services/paymentMethodService';

export const ClinicPaymentMethodsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, isTenantAdmin } = useAuth();
  const { toast } = useToast();

  const [methods, setMethods] = useState<PaymentMethodItem[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState(user?.activeBranchId || '');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethodItem | null>(null);
  const [deletingMethod, setDeletingMethod] = useState<PaymentMethodItem | null>(null);

  // Form States
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    branchId: '',
    isActive: true,
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Fetch clinic branches
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await api.get('/branches', { params: { moduleKey: 'CLINIC' } });
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        const activeBranches = list.filter((b: any) => b.status === 'ACTIVE');
        setBranches(activeBranches);
        if (activeBranches.length > 0 && !selectedBranchFilter) {
          const initBranch = user?.activeBranchId || activeBranches[0].id;
          setSelectedBranchFilter(initBranch);
        }
      } catch (err) {
        console.error('Failed to load clinic branches', err);
      }
    };

    fetchBranches();
  }, [user?.activeBranchId, selectedBranchFilter]);

  // Fetch Clinic Payment Methods
  const fetchMethods = async () => {
    setLoading(true);
    try {
      const activeBranch = selectedBranchFilter || user?.activeBranchId || branches[0]?.id;
      const params: any = {
        moduleKey: 'CLINIC',
      };
      if (activeBranch) {
        params.branchId = activeBranch;
      }
      if (search.trim()) {
        params.search = search.trim();
      }

      const list = await paymentMethodService.getAll(params);
      setMethods(list);
    } catch (err: any) {
      console.error('Failed to fetch clinic payment methods', err);
      toast.error(
        err?.response?.data?.message ||
          t('clinicPaymentMethods.alerts.loadFailed', 'Failed to load clinic payment methods'),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMethods();
  }, [selectedBranchFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMethods();
  };

  const handleResetSearch = () => {
    setSearch('');
    setTimeout(() => fetchMethods(), 0);
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormData({
      name: '',
      description: '',
      branchId: selectedBranchFilter || user?.activeBranchId || branches[0]?.id || '',
      isActive: true,
    });
    setFormErrors({});
    setShowCreateModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: PaymentMethodItem) => {
    setEditingMethod(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      branchId: item.branchId || '',
      isActive: item.isActive,
    });
    setFormErrors({});
  };

  // Validate form
  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!formData.name.trim()) {
      errors.name = t('clinicPaymentMethods.errors.nameRequired', 'Payment method name is required');
    }
    if (isTenantAdmin && !formData.branchId) {
      errors.branchId = t('clinicPaymentMethods.errors.branchRequired', 'Clinic branch is required');
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
        isActive: formData.isActive,
      };

      if (isTenantAdmin && formData.branchId) {
        payload.branchId = formData.branchId;
      }

      await paymentMethodService.create(payload, 'CLINIC');
      toast.success(
        t('clinicPaymentMethods.alerts.createSuccess', 'Clinic payment method created successfully'),
      );
      setShowCreateModal(false);
      fetchMethods();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t('clinicPaymentMethods.alerts.createFailed', 'Failed to create clinic payment method'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMethod || !validateForm()) return;

    setSubmitting(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        isActive: formData.isActive,
      };

      if (isTenantAdmin && formData.branchId) {
        payload.branchId = formData.branchId;
      }

      await paymentMethodService.update(editingMethod.id, payload, 'CLINIC');
      toast.success(
        t('clinicPaymentMethods.alerts.updateSuccess', 'Clinic payment method updated successfully'),
      );
      setEditingMethod(null);
      fetchMethods();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t('clinicPaymentMethods.alerts.updateFailed', 'Failed to update clinic payment method'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Confirm (Tenant Admin ONLY)
  const handleDeleteConfirm = async () => {
    if (!deletingMethod) return;

    setSubmitting(true);
    try {
      const res = await paymentMethodService.delete(deletingMethod.id, 'CLINIC');
      toast.success(
        res.message ||
          t('clinicPaymentMethods.alerts.deleteSuccess', 'Payment method removed successfully'),
      );
      setDeletingMethod(null);
      fetchMethods();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t('clinicPaymentMethods.alerts.deleteFailed', 'Failed to remove clinic payment method'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Filter & Pagination
  const filteredMethods = useMemo(() => {
    return methods.filter((m) => {
      const matchSearch =
        search === '' ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        (m.description && m.description.toLowerCase().includes(search.toLowerCase()));
      return matchSearch;
    });
  }, [methods, search]);

  const totalPages = Math.max(1, Math.ceil(filteredMethods.length / pageSize));
  const paginatedMethods = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMethods.slice(start, start + pageSize);
  }, [filteredMethods, currentPage, pageSize]);

  return (
    <div style={{ paddingBottom: '60px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0284c7',
            }}
          >
            <CreditCard size={22} />
          </div>
          <div>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 800,
                color: 'var(--text-heading)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              {t('clinicPaymentMethods.title', 'Clinic Payment Methods')}
            </h1>
            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {t(
                'clinicPaymentMethods.subtitle',
                'Configure accepted clinic payment methods (Cash, Cards, Transfers) used across expenses and patient billing.',
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleOpenCreateModal}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} />
          <span>{t('clinicPaymentMethods.actions.addMethod', 'Add Payment Method')}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: '16px',
          marginBottom: '20px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          {/* Branch Selector for Tenant Admin */}
          {isTenantAdmin && branches.length > 0 && (
            <div style={{ width: '240px', minWidth: '180px' }}>
              <SearchableSelect
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
                value={selectedBranchFilter}
                onChange={(val) => {
                  setSelectedBranchFilter(val);
                  setCurrentPage(1);
                }}
                icon={<Building2 size={16} style={{ color: '#0284c7' }} />}
                placeholder={t('clinicPaymentMethods.filters.selectBranch', 'Filter by branch')}
              />
            </div>
          )}

          {/* Search Input */}
          <form
            onSubmit={handleSearchSubmit}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px', flex: 1, maxWidth: '400px' }}
          >
            <div style={{ position: 'relative', width: '100%' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '36px', height: '38px', fontSize: '13px', width: '100%' }}
                placeholder={t('clinicPaymentMethods.filters.searchPlaceholder', 'Search by name or description...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={handleResetSearch}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </form>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={fetchMethods}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '38px' }}
        >
          <RotateCcw size={14} />
          <span>{t('common.refresh', 'Refresh')}</span>
        </button>
      </div>

      {/* Main Content: Table View */}
      <div
        className="card"
        style={{
          padding: 0,
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
        }}
      >
        <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
          <table className="table" style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                  {t('clinicPaymentMethods.table.methodName', 'Method Name')}
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                  {t('clinicPaymentMethods.table.description', 'Description')}
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                  {t('clinicPaymentMethods.table.branch', 'Clinic Branch')}
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px', textAlign: 'center' }}>
                  {t('clinicPaymentMethods.table.status', 'Status')}
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px', textAlign: 'right' }}>
                  {t('clinicPaymentMethods.table.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    {t('common.loading', 'Loading payment methods...')}
                  </td>
                </tr>
              ) : paginatedMethods.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(56, 189, 248, 0.1)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#0284c7',
                        marginBottom: '12px',
                      }}
                    >
                      <CreditCard size={24} />
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>
                      {t('clinicPaymentMethods.empty.title', 'No payment methods found')}
                    </div>
                    <div style={{ fontSize: '13px' }}>
                      {search
                        ? t('clinicPaymentMethods.empty.searchDesc', 'No payment methods matched your search criteria.')
                        : t('clinicPaymentMethods.empty.desc', 'Click "Add Payment Method" to configure acceptable payment options for this clinic branch.')}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedMethods.map((pm) => (
                  <tr
                    key={pm.id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            backgroundColor: pm.isActive ? 'rgba(56, 189, 248, 0.1)' : 'var(--badge-neutral-bg, #f1f5f9)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: pm.isActive ? '#0284c7' : 'var(--text-muted)',
                            flexShrink: 0,
                          }}
                        >
                          <CreditCard size={16} />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-heading)' }}>
                          {pm.name}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-muted)', maxWidth: '320px' }}>
                      {pm.description || '—'}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-main)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Building2 size={14} style={{ color: '#0284c7' }} />
                        {pm.branch?.name || t('clinicPaymentMethods.table.allBranches', 'Clinic Branch')}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          backgroundColor: pm.isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: pm.isActive ? '#10b981' : '#ef4444',
                          border: pm.isActive ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
                        }}
                      >
                        {pm.isActive ? (
                          <>
                            <CheckCircle2 size={12} />
                            <span>{t('common.active', 'Active')}</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={12} />
                            <span>{t('common.inactive', 'Inactive')}</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Tooltip content={t('common.edit', 'Edit')}>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => handleOpenEditModal(pm)}
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-main)',
                              cursor: 'pointer',
                            }}
                          >
                            <Edit2 size={14} />
                          </button>
                        </Tooltip>

                        {/* Delete: Tenant Admin ONLY */}
                        {isTenantAdmin && (
                          <Tooltip content={t('common.delete', 'Delete')}>
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() => setDeletingMethod(pm)}
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-surface)',
                                color: 'var(--rose-500)',
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

        {/* Pagination Footer */}
        {filteredMethods.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            totalItems={filteredMethods.length}
          />
        )}
      </div>

      {/* ─── CREATE MODAL ─── */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ zIndex: 1070 }} onClick={() => !submitting && setShowCreateModal(false)}>
          <div
            className="modal-content"
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                  {t('clinicPaymentMethods.modals.addTitle', 'New Clinic Payment Method')}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {t('clinicPaymentMethods.modals.addSubtitle', 'Define accepted payment option for clinic operations')}
                </p>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowCreateModal(false)}
                disabled={submitting}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Method Name */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                  {t('clinicPaymentMethods.form.nameLabel', 'Payment Method Name')} *
                </label>
                <input
                  type="text"
                  className={`form-input ${formErrors.name ? 'is-invalid' : ''}`}
                  placeholder={t('clinicPaymentMethods.form.namePlaceholder', 'e.g. Cash, Credit Card, SPEI')}
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  autoFocus
                  required
                />
                {formErrors.name && (
                  <span style={{ fontSize: '11px', color: 'var(--rose-500)', marginTop: '4px', display: 'block' }}>
                    {formErrors.name}
                  </span>
                )}
              </div>

              {/* Branch Selector (if Tenant Admin) */}
              {isTenantAdmin && (
                <div>
                  <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                    {t('clinicPaymentMethods.form.branchLabel', 'Clinic Branch')} *
                  </label>
                  <SearchableSelect
                    options={branches.map((b) => ({ value: b.id, label: b.name }))}
                    value={formData.branchId}
                    onChange={(val) => setFormData((p) => ({ ...p, branchId: val }))}
                    placeholder={t('clinicPaymentMethods.form.selectBranch', 'Select Clinic Branch')}
                    icon={<Building2 size={15} style={{ color: '#0284c7' }} />}
                  />
                  {formErrors.branchId && (
                    <span style={{ fontSize: '11px', color: 'var(--rose-500)', marginTop: '4px', display: 'block' }}>
                      {formErrors.branchId}
                    </span>
                  )}
                </div>
              )}

              {/* Description */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                  {t('clinicPaymentMethods.form.descriptionLabel', 'Description / Instructions')}
                </label>
                <textarea
                  rows={2}
                  className="form-input"
                  placeholder={t('clinicPaymentMethods.form.descriptionPlaceholder', 'Terminal details, bank account, or cashier instructions...')}
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Active Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="clinic-pm-active"
                  checked={formData.isActive}
                  onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
                  style={{ width: '16px', height: '16px', accentColor: '#0284c7', cursor: 'pointer' }}
                />
                <label htmlFor="clinic-pm-active" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
                  {t('clinicPaymentMethods.form.activeLabel', 'Active (Available for payment selection)')}
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ fontWeight: 700 }}
                >
                  {submitting ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT MODAL ─── */}
      {editingMethod && (
        <div className="modal-overlay" style={{ zIndex: 1070 }} onClick={() => !submitting && setEditingMethod(null)}>
          <div
            className="modal-content"
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                  {t('clinicPaymentMethods.modals.editTitle', 'Edit Clinic Payment Method')}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {t('clinicPaymentMethods.modals.editSubtitle', 'Modify payment method details or status')}
                </p>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setEditingMethod(null)}
                disabled={submitting}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Method Name */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                  {t('clinicPaymentMethods.form.nameLabel', 'Payment Method Name')} *
                </label>
                <input
                  type="text"
                  className={`form-input ${formErrors.name ? 'is-invalid' : ''}`}
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  required
                />
                {formErrors.name && (
                  <span style={{ fontSize: '11px', color: 'var(--rose-500)', marginTop: '4px', display: 'block' }}>
                    {formErrors.name}
                  </span>
                )}
              </div>

              {/* Branch Selector (Tenant Admin) */}
              {isTenantAdmin && (
                <div>
                  <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                    {t('clinicPaymentMethods.form.branchLabel', 'Clinic Branch')}
                  </label>
                  <SearchableSelect
                    options={branches.map((b) => ({ value: b.id, label: b.name }))}
                    value={formData.branchId}
                    onChange={(val) => setFormData((p) => ({ ...p, branchId: val }))}
                    placeholder={t('clinicPaymentMethods.form.selectBranch', 'Select Clinic Branch')}
                    icon={<Building2 size={15} style={{ color: '#0284c7' }} />}
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                  {t('clinicPaymentMethods.form.descriptionLabel', 'Description / Instructions')}
                </label>
                <textarea
                  rows={2}
                  className="form-input"
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Active Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="clinic-pm-active-edit"
                  checked={formData.isActive}
                  onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
                  style={{ width: '16px', height: '16px', accentColor: '#0284c7', cursor: 'pointer' }}
                />
                <label htmlFor="clinic-pm-active-edit" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
                  {t('clinicPaymentMethods.form.activeLabel', 'Active (Available for payment selection)')}
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingMethod(null)}
                  disabled={submitting}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ fontWeight: 700 }}
                >
                  {submitting ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRMATION MODAL (Tenant Admin ONLY) ─── */}
      {deletingMethod && (
        <div className="modal-overlay" style={{ zIndex: 1070 }} onClick={() => !submitting && setDeletingMethod(null)}>
          <div
            className="modal-content"
            style={{
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--rose-500)',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--text-heading)' }}>
                  {t('clinicPaymentMethods.modals.deleteTitle', 'Remove Payment Method')}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  {t(
                    'clinicPaymentMethods.modals.deleteConfirm',
                    'Are you sure you want to remove "{{name}}"? If this payment method has existing records in expenses or invoices, it will be deactivated safely instead of permanently deleted.',
                    { name: deletingMethod.name },
                  )}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingMethod(null)}
                disabled={submitting}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteConfirm}
                disabled={submitting}
                style={{ fontWeight: 700 }}
              >
                {submitting ? t('common.processing', 'Processing...') : t('common.delete', 'Remove Method')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
