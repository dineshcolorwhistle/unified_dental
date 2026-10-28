import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import { SearchableSelect, SearchableSelectOption } from '../../components/common/SearchableSelect';
import { Tooltip } from '../../components/common/Tooltip';
import { Pagination } from '../../components/common/Pagination';
import {
  Award,
  Plus,
  Search,
  Trash2,
  Edit2,
  Eye,
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  specializationService,
  SpecializationItem,
  SpecializationStatus,
} from '../../services/specializationService';

export const ClinicSpecializationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { isTenantAdmin } = useAuth();
  const { toast } = useToast();

  const [specializations, setSpecializations] = useState<SpecializationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SpecializationStatus>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<SpecializationItem | null>(null);
  const [viewingItem, setViewingItem] = useState<SpecializationItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<SpecializationItem | null>(null);

  // Form States
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    status: SpecializationStatus;
  }>({
    name: '',
    description: '',
    status: 'ACTIVE',
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const fetchSpecializations = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const list = await specializationService.getAll(params);
      setSpecializations(list);
    } catch (err: any) {
      console.error('Failed to fetch specializations', err);
      toast.error(
        err?.response?.data?.message ||
          t('clinicSpecializations.alerts.loadFailed', 'Failed to load specializations'),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecializations();
  }, [statusFilter]);

  // Status Filter Options
  const statusFilterOptions: SearchableSelectOption[] = useMemo(
    () => [
      { value: 'ALL', label: t('common.allStatuses', 'All Statuses') },
      { value: 'ACTIVE', label: t('common.active', 'Active') },
      { value: 'INACTIVE', label: t('common.inactive', 'Inactive') },
    ],
    [t],
  );

  const statusFormOptions: SearchableSelectOption[] = useMemo(
    () => [
      { value: 'ACTIVE', label: t('common.active', 'Active') },
      { value: 'INACTIVE', label: t('common.inactive', 'Inactive') },
    ],
    [t],
  );

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      status: 'ACTIVE',
    });
    setFormErrors({});
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: SpecializationItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      status: item.status,
    });
    setFormErrors({});
    setShowModal(true);
  };

  // Validate form
  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!formData.name.trim()) {
      errors.name = t('clinicSpecializations.validation.nameRequired', 'Specialization name is required.');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Submit Create / Edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      if (editingItem) {
        await specializationService.update(editingItem.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          status: formData.status,
        });
        toast.success(
          t('clinicSpecializations.alerts.updateSuccess', 'Specialization updated successfully.'),
        );
      } else {
        await specializationService.create({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
        });
        toast.success(
          t('clinicSpecializations.alerts.createSuccess', 'Specialization created successfully.'),
        );
      }
      setShowModal(false);
      fetchSpecializations();
    } catch (err: any) {
      console.error('Failed to save specialization', err);
      const msg =
        err?.response?.data?.message ||
        t('clinicSpecializations.alerts.saveFailed', 'Failed to save specialization.');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete
  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    setSubmitting(true);
    try {
      await specializationService.delete(deletingItem.id);
      toast.success(
        t('clinicSpecializations.alerts.deleteSuccess', 'Specialization removed successfully.'),
      );
      setDeletingItem(null);
      fetchSpecializations();
    } catch (err: any) {
      console.error('Failed to delete specialization', err);
      toast.error(
        err?.response?.data?.message ||
          t('clinicSpecializations.alerts.deleteFailed', 'Failed to delete specialization.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Filter & Pagination calculations
  const filteredSpecializations = useMemo(() => {
    return specializations.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [specializations, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSpecializations.length / pageSize));
  const paginatedSpecializations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSpecializations.slice(start, start + pageSize);
  }, [filteredSpecializations, currentPage, pageSize]);

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
            <Award size={22} />
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
              {t('clinicSpecializations.title', 'Specializations')}
            </h1>
            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {t(
                'clinicSpecializations.subtitle',
                'Manage clinical dental specializations for practitioners and services',
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
          <span>{t('clinicSpecializations.addBtn', 'Add Specialization')}</span>
        </button>
      </div>

      {/* Filter Bar (No redundant search button) */}
      <div
        className="card"
        style={{
          padding: '16px',
          marginBottom: '20px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Status filter */}
        <div style={{ width: '170px', minWidth: '140px' }}>
          <SearchableSelect
            options={statusFilterOptions}
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val as any);
              setCurrentPage(1);
            }}
            placeholder={t('common.status', 'Status')}
          />
        </div>

        {/* Live Search Input */}
        <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '36px', paddingRight: search ? '32px' : '12px', height: '38px', fontSize: '13px', width: '100%' }}
            placeholder={t('clinicSpecializations.searchPlaceholder', 'Search specialization by name or description...')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCurrentPage(1);
              }}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div
        className="card"
        style={{
          padding: 0,
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-card)',
        }}
      >
        <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
          <table className="table" style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', margin: 0 }}>
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--table-th-bg)',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                  {t('clinicSpecializations.fields.name', 'Specialization Name')}
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                  {t('clinicSpecializations.fields.description', 'Description')}
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px', textAlign: 'center' }}>
                  {t('common.status', 'Status')}
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px', textAlign: 'right' }}>
                  {t('common.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    {t('common.loading', 'Loading specializations...')}
                  </td>
                </tr>
              ) : paginatedSpecializations.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
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
                      <Award size={24} />
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>
                      {t('clinicSpecializations.noRecords', 'No specializations found')}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {search
                        ? t('clinicSpecializations.empty.searchDesc', 'No specializations matched your search criteria.')
                        : t('clinicSpecializations.noRecordsDesc', 'Create your first dental specialization using the button above.')}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedSpecializations.map((item) => (
                  <tr
                    key={item.id}
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
                            backgroundColor: item.status === 'ACTIVE' ? 'rgba(56, 189, 248, 0.1)' : 'var(--badge-neutral-bg, #f1f5f9)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: item.status === 'ACTIVE' ? '#0284c7' : 'var(--text-muted)',
                            flexShrink: 0,
                          }}
                        >
                          <Award size={16} />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-heading)' }}>
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-muted)', maxWidth: '400px' }}>
                      {item.description || '—'}
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
                          backgroundColor:
                            item.status === 'ACTIVE'
                              ? 'rgba(16, 185, 129, 0.12)'
                              : 'rgba(239, 68, 68, 0.12)',
                          color: item.status === 'ACTIVE' ? '#10b981' : '#ef4444',
                          border:
                            item.status === 'ACTIVE'
                              ? '1px solid rgba(16, 185, 129, 0.25)'
                              : '1px solid rgba(239, 68, 68, 0.25)',
                        }}
                      >
                        {item.status === 'ACTIVE' ? (
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
                        {/* View Option */}
                        <Tooltip content={t('common.view', 'View Details')}>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => setViewingItem(item)}
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
                            <Eye size={14} />
                          </button>
                        </Tooltip>

                        {/* Edit Option */}
                        <Tooltip content={t('common.edit', 'Edit')}>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => handleOpenEditModal(item)}
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

                        {/* Delete Option (Tenant Admin only) */}
                        {isTenantAdmin && (
                          <Tooltip content={t('common.delete', 'Delete')}>
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() => setDeletingItem(item)}
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

        {/* Rule 11: Mandatory Table Pagination */}
        {filteredSpecializations.length > 0 && (
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
            totalItems={filteredSpecializations.length}
          />
        )}
      </div>

      {/* ─── VIEW DETAILS MODAL ─── */}
      {viewingItem && (
        <div className="modal-overlay" style={{ zIndex: 1070 }} onClick={() => setViewingItem(null)}>
          <div
            className="modal-content"
            style={{
              maxWidth: '500px',
              width: '100%',
              padding: '24px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(56, 189, 248, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0284c7',
                  }}
                >
                  <Award size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                    {viewingItem.name}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    {t('clinicSpecializations.viewModal.subtitle', 'Specialization Details')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setViewingItem(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  {t('common.status', 'Status')}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 700,
                    backgroundColor:
                      viewingItem.status === 'ACTIVE'
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'rgba(239, 68, 68, 0.12)',
                    color: viewingItem.status === 'ACTIVE' ? '#10b981' : '#ef4444',
                    border:
                      viewingItem.status === 'ACTIVE'
                        ? '1px solid rgba(16, 185, 129, 0.25)'
                        : '1px solid rgba(239, 68, 68, 0.25)',
                  }}
                >
                  {viewingItem.status === 'ACTIVE' ? (
                    <>
                      <CheckCircle2 size={13} />
                      <span>{t('common.active', 'Active')}</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={13} />
                      <span>{t('common.inactive', 'Inactive')}</span>
                    </>
                  )}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  {t('clinicSpecializations.fields.description', 'Description')}
                </span>
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    fontSize: '13px',
                    color: viewingItem.description ? 'var(--text-main)' : 'var(--text-muted)',
                    lineHeight: '1.5',
                  }}
                >
                  {viewingItem.description || t('common.noDescription', 'No description provided.')}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '4px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                    {t('common.created', 'Created')}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-main)' }}>
                    {new Date(viewingItem.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                    {t('common.updated', 'Last Updated')}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-main)' }}>
                    {new Date(viewingItem.updatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewingItem(null)}
              >
                {t('common.close', 'Close')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const item = viewingItem;
                  setViewingItem(null);
                  handleOpenEditModal(item);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Edit2 size={14} />
                <span>{t('common.edit', 'Edit')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CREATE / EDIT MODAL ─── */}
      {showModal && (
        <div className="modal-overlay" style={{ zIndex: 1070 }} onClick={() => !submitting && setShowModal(false)}>
          <div
            className="modal-content"
            style={{
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                  {editingItem
                    ? t('clinicSpecializations.modal.editTitle', 'Edit Specialization')
                    : t('clinicSpecializations.modal.createTitle', 'Add New Specialization')}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {editingItem
                    ? t('clinicSpecializations.modal.editSubtitle', 'Update specialization details and status')
                    : t('clinicSpecializations.modal.createSubtitle', 'Enter details for the new clinical specialization')}
                </p>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowModal(false)}
                disabled={submitting}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Field 1: Name */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                  {t('clinicSpecializations.fields.name', 'Specialization Name')} *
                </label>
                <input
                  type="text"
                  className={`form-input ${formErrors.name ? 'is-invalid' : ''}`}
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                  }}
                  placeholder={t('clinicSpecializations.fields.namePlaceholder', 'e.g., Orthodontics, Endodontics, Periodontics')}
                  autoFocus
                  required
                />
                {formErrors.name && (
                  <span style={{ fontSize: '11px', color: 'var(--rose-500)', marginTop: '4px', display: 'block' }}>
                    {formErrors.name}
                  </span>
                )}
              </div>

              {/* Field 2: Description */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                  {t('clinicSpecializations.fields.description', 'Description')}
                </label>
                <textarea
                  rows={2}
                  className="form-input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('clinicSpecializations.fields.descPlaceholder', 'Optional summary or details for this dental specialization...')}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Field 3: Status (Displayed ONLY when editing an existing record) */}
              {editingItem && (
                <div>
                  <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                    {t('common.status', 'Status')}
                  </label>
                  <SearchableSelect
                    options={statusFormOptions}
                    value={formData.status}
                    onChange={(val) => setFormData({ ...formData, status: val as SpecializationStatus })}
                    placeholder={t('common.selectStatus', 'Select Status')}
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {t('clinicSpecializations.modal.statusNotice', 'Status can only be modified for existing records.')}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting && (
                    <div className="spinner-border spinner-border-sm" role="status" style={{ width: '14px', height: '14px' }} />
                  )}
                  <span>
                    {editingItem
                      ? t('common.saveChanges', 'Save Changes')
                      : t('clinicSpecializations.modal.createBtn', 'Create Specialization')}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRMATION MODAL ─── */}
      {deletingItem && (
        <div className="modal-overlay" style={{ zIndex: 1080 }} onClick={() => !submitting && setDeletingItem(null)}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--rose-500)', marginBottom: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(244, 63, 94, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-heading)' }}>
                  {t('clinicSpecializations.deleteModal.title', 'Delete Specialization')}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {t('clinicSpecializations.deleteModal.warning', 'This action cannot be undone.')}
                </p>
              </div>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--text-main)', marginBottom: '20px' }}>
              {t(
                'clinicSpecializations.deleteModal.confirmPrompt',
                'Are you sure you want to permanently delete "{{name}}"?',
                { name: deletingItem.name },
              )}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingItem(null)}
                disabled={submitting}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteConfirm}
                disabled={submitting}
              >
                {submitting && (
                  <div className="spinner-border spinner-border-sm" role="status" style={{ width: '14px', height: '14px' }} />
                )}
                <span>{t('common.delete', 'Delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClinicSpecializationsPage;
