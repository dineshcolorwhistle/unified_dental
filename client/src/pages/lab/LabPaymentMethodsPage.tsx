import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { Tooltip } from '../../components/common/Tooltip';
import { Pagination } from '../../components/common/Pagination';
import { formatDate } from '../../core/utils/dateUtils';
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
} from 'lucide-react';
import {
  paymentMethodService,
  PaymentMethodItem,
} from '../../services/paymentMethodService';

export const LabPaymentMethodsPage: React.FC = () => {
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

  // Fetch branches (for Tenant Admin)
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await api.get('/branches', { params: { moduleKey: 'LAB' } });
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setBranches(list);
        if (list.length > 0 && !selectedBranchFilter) {
          const initBranch = user?.activeBranchId || list[0].id;
          setSelectedBranchFilter(initBranch);
        }
      } catch (err) {
        console.error('Failed to load branches', err);
      }
    };

    fetchBranches();
  }, [user?.activeBranchId, selectedBranchFilter]);

  // Fetch Payment Methods
  const fetchMethods = async () => {
    setLoading(true);
    try {
      const activeBranch = selectedBranchFilter || user?.activeBranchId || branches[0]?.id;
      const params: any = {};
      if (activeBranch) {
        params.branchId = activeBranch;
      }
      if (search.trim()) {
        params.search = search.trim();
      }

      const list = await paymentMethodService.getAll(params);
      setMethods(list);
    } catch (err: any) {
      console.error('Failed to fetch payment methods', err);
      toast.error(err?.response?.data?.message || t('labPaymentMethods.alerts.loadFailed', 'Failed to load payment methods'));
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
      errors.name = t('labPaymentMethods.errors.nameRequired', 'Payment method name is required');
    }
    if (isTenantAdmin && !formData.branchId) {
      errors.branchId = t('labPaymentMethods.errors.branchRequired', 'Branch is required');
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
        isActive: formData.isActive,
      };
      if (isTenantAdmin && formData.branchId) {
        payload.branchId = formData.branchId;
      }

      await paymentMethodService.create(payload);
      toast.success(t('labPaymentMethods.alerts.createSuccess', { name: formData.name, defaultValue: `Payment method "${formData.name}" created successfully` }));
      setShowCreateModal(false);
      fetchMethods();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('labPaymentMethods.alerts.createFailed', 'Failed to create payment method'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Edit Submit
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

      await paymentMethodService.update(editingMethod.id, payload);
      toast.success(t('labPaymentMethods.alerts.updateSuccess', { name: formData.name, defaultValue: `Payment method "${formData.name}" updated successfully` }));
      setEditingMethod(null);
      fetchMethods();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('labPaymentMethods.alerts.updateFailed', 'Failed to update payment method'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Confirm
  const handleDelete = async () => {
    if (!deletingMethod) return;

    setSubmitting(true);
    try {
      const res = await paymentMethodService.delete(deletingMethod.id);
      toast.success(res.message || t('labPaymentMethods.alerts.deleteSuccess', { name: deletingMethod.name, defaultValue: `Payment method "${deletingMethod.name}" deleted` }));
      setDeletingMethod(null);
      fetchMethods();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('labPaymentMethods.alerts.deleteFailed', 'Failed to delete payment method'));
    } finally {
      setSubmitting(false);
    }
  };

  // Filter & Paginate
  const filteredMethods = useMemo(() => {
    if (!search.trim()) return methods;
    const term = search.toLowerCase();
    return methods.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        (m.description && m.description.toLowerCase().includes(term)),
    );
  }, [methods, search]);

  const totalPages = Math.ceil(filteredMethods.length / pageSize) || 1;
  const paginatedMethods = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMethods.slice(start, start + pageSize);
  }, [filteredMethods, currentPage, pageSize]);

  const branchOptions = useMemo(() => {
    return branches.map((b) => ({
      value: b.id,
      label: b.code ? `${b.name} (${b.code})` : b.name,
    }));
  }, [branches]);

  const modalBranchOptions = useMemo(() => {
    return branches.map((b) => ({
      value: b.id,
      label: b.code ? `${b.name} (${b.code})` : b.name,
    }));
  }, [branches]);

  return (
    <div className="page-container">
      {/* ─── PAGE HEADER ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-600)',
              }}
            >
              <CreditCard size={20} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {t('labPaymentMethods.title', 'Payment Methods')}
            </h1>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                color: 'var(--primary-600)',
              }}
            >
              {filteredMethods.length}
            </span>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            {t(
              'labPaymentMethods.subtitle',
              'Configure payment methods available for lab branches and transactions',
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
        >
          <Plus size={16} />
          <span>{t('labPaymentMethods.addBtn', 'Add Payment Method')}</span>
        </button>
      </div>

      {/* ─── FILTERS & SEARCH BAR ─── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '14px',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          backgroundColor: 'var(--bg-card)',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', flex: 1, minWidth: '260px' }}>
          {isTenantAdmin && (
            <div style={{ width: '220px' }}>
              <SearchableSelect
                options={branchOptions}
                value={selectedBranchFilter}
                onChange={(val) => {
                  setSelectedBranchFilter(val);
                  setCurrentPage(1);
                }}
                placeholder={t('common.selectBranch', 'Select Branch')}
              />
            </div>
          )}

          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: 1, maxWidth: '380px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type="text"
                className="form-input"
                placeholder={t('labPaymentMethods.searchPlaceholder', 'Search payment methods...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '34px' }}
              />
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
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
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* ─── TABLE VIEW ─── */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)' }}>
                {t('labPaymentMethods.columns.name', 'Method Name')}
              </th>
              <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)' }}>
                {t('labPaymentMethods.columns.description', 'Description')}
              </th>
              <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)' }}>
                {t('labPaymentMethods.columns.branch', 'Branch')}
              </th>
              <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>
                {t('labPaymentMethods.columns.status', 'Status')}
              </th>
              <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)' }}>
                {t('labPaymentMethods.columns.createdAt', 'Created At')}
              </th>
              <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>
                {t('common.actions', 'Actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  {t('common.loading', 'Loading...')}
                </td>
              </tr>
            ) : paginatedMethods.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <CreditCard size={32} style={{ opacity: 0.4, marginBottom: '8px' }} />
                  <div>{t('labPaymentMethods.noRecords', 'No payment methods found.')}</div>
                </td>
              </tr>
            ) : (
              paginatedMethods.map((m) => (
                <tr
                  key={m.id}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(37, 99, 235, 0.1)',
                          color: 'var(--primary-600)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <CreditCard size={16} />
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--text-heading)', fontSize: '14px' }}>
                        {m.name}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>
                    {m.description || '—'}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    {m.branch ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-color)',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                        <span>{m.branch.code ? `${m.branch.name} (${m.branch.code})` : m.branch.name}</span>
                      </span>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: m.isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: m.isActive ? '#10b981' : '#ef4444',
                        border: m.isActive ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
                      }}
                    >
                      {m.isActive ? (
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
                  <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>
                    {formatDate(m.createdAt)}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Tooltip content={t('common.edit', 'Edit')}>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => handleOpenEditModal(m)}
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

                      <Tooltip content={t('common.delete', 'Delete')}>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => setDeletingMethod(m)}
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
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {filteredMethods.length > pageSize && (
          <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-color)' }}>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(p) => setCurrentPage(p)}
              pageSize={pageSize}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setCurrentPage(1);
              }}
              totalItems={filteredMethods.length}
            />
          </div>
        )}
      </div>

      {/* ─── CREATE MODAL ─── */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ zIndex: 1070 }}>
          <div
            className="modal-content"
            style={{
              maxWidth: '480px',
              padding: '24px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                  {t('labPaymentMethods.modals.createTitle', 'Add Payment Method')}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {t('labPaymentMethods.modals.createSubtitle', 'Define a payment method for transactions and expenses')}
                </p>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowCreateModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px' }}>
                  {t('labPaymentMethods.fields.name', 'Method Name')} *
                </label>
                <input
                  type="text"
                  className={`form-input ${formErrors.name ? 'is-invalid' : ''}`}
                  placeholder={t('labPaymentMethods.placeholders.name', 'e.g. BBVA Transfer, Stripe, Cash')}
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  autoFocus
                />
                {formErrors.name && (
                  <span style={{ fontSize: '11px', color: 'var(--rose-500)', marginTop: '4px', display: 'block' }}>
                    {formErrors.name}
                  </span>
                )}
              </div>

              {isTenantAdmin && (
                <div>
                  <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px' }}>
                    {t('labPaymentMethods.fields.branch', 'Branch (Optional)')}
                  </label>
                  <SearchableSelect
                    options={modalBranchOptions}
                    value={formData.branchId}
                    onChange={(val) => setFormData((p) => ({ ...p, branchId: val }))}
                    placeholder={t('labPaymentMethods.placeholders.branch', 'Select branch or leave for all')}
                  />
                </div>
              )}

              <div>
                <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px' }}>
                  {t('labPaymentMethods.fields.description', 'Description (Optional)')}
                </label>
                <textarea
                  rows={2}
                  className="form-input"
                  placeholder={t('labPaymentMethods.placeholders.description', 'Account numbers, notes, instructions...')}
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="create-isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary-600)', cursor: 'pointer' }}
                />
                <label htmlFor="create-isActive" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
                  {t('labPaymentMethods.fields.isActive', 'Active (Available for payment selection)')}
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
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
                  {t('common.save', 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT MODAL ─── */}
      {editingMethod && (
        <div className="modal-overlay" style={{ zIndex: 1070 }}>
          <div
            className="modal-content"
            style={{
              maxWidth: '480px',
              padding: '24px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                  {t('labPaymentMethods.modals.editTitle', 'Edit Payment Method')}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {t('labPaymentMethods.modals.editSubtitle', 'Modify details and status for this payment method')}
                </p>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setEditingMethod(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px' }}>
                  {t('labPaymentMethods.fields.name', 'Method Name')} *
                </label>
                <input
                  type="text"
                  className={`form-input ${formErrors.name ? 'is-invalid' : ''}`}
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                />
                {formErrors.name && (
                  <span style={{ fontSize: '11px', color: 'var(--rose-500)', marginTop: '4px', display: 'block' }}>
                    {formErrors.name}
                  </span>
                )}
              </div>

              {isTenantAdmin && (
                <div>
                  <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px' }}>
                    {t('labPaymentMethods.fields.branch', 'Branch (Optional)')}
                  </label>
                  <SearchableSelect
                    options={modalBranchOptions}
                    value={formData.branchId}
                    onChange={(val) => setFormData((p) => ({ ...p, branchId: val }))}
                  />
                </div>
              )}

              <div>
                <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px' }}>
                  {t('labPaymentMethods.fields.description', 'Description (Optional)')}
                </label>
                <textarea
                  rows={2}
                  className="form-input"
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="edit-isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary-600)', cursor: 'pointer' }}
                />
                <label htmlFor="edit-isActive" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
                  {t('labPaymentMethods.fields.isActive', 'Active (Available for payment selection)')}
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
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
                  {t('common.saveChanges', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE MODAL ─── */}
      {deletingMethod && (
        <div className="modal-overlay" style={{ zIndex: 1070 }}>
          <div
            className="modal-content"
            style={{
              maxWidth: '440px',
              padding: '24px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', color: 'var(--rose-500)' }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                {t('labPaymentMethods.modals.deleteTitle', 'Delete Payment Method')}
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.5, margin: '0 0 16px' }}>
              {t(
                'labPaymentMethods.modals.deleteConfirm',
                { name: deletingMethod.name, defaultValue: `Are you sure you want to delete payment method "${deletingMethod.name}"? If it has linked transactions, it will be safely deactivated.` },
              )}
            </p>

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
                onClick={handleDelete}
                disabled={submitting}
                style={{ fontWeight: 700 }}
              >
                {t('common.delete', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
