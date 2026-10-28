import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import { SearchableSelect, SearchableSelectOption } from '../../components/common/SearchableSelect';
import { Tooltip } from '../../components/common/Tooltip';
import { Pagination } from '../../components/common/Pagination';
import {
  Wrench,
  Plus,
  Search,
  Building2,
  Trash2,
  Edit2,
  Eye,
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  DollarSign,
} from 'lucide-react';
import {
  clinicServiceService,
  ClinicServiceItem,
  ServiceStatus,
} from '../../services/clinicServiceService';

export const ClinicServicesPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, isTenantAdmin } = useAuth();
  const { toast } = useToast();

  const [services, setServices] = useState<ClinicServiceItem[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ServiceStatus>('ALL');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState(user?.activeBranchId || '');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<ClinicServiceItem | null>(null);
  const [viewingItem, setViewingItem] = useState<ClinicServiceItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<ClinicServiceItem | null>(null);

  // Form States
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    price: string;
    status: ServiceStatus;
    branchId: string;
  }>({
    name: '',
    description: '',
    price: '',
    status: 'ACTIVE',
    branchId: '',
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Fetch Clinic Branches
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

  // Fetch Services
  const fetchServices = async () => {
    setLoading(true);
    try {
      const activeBranch = selectedBranchFilter || user?.activeBranchId || branches[0]?.id;
      const params: any = {};
      if (activeBranch && activeBranch !== 'all') {
        params.branchId = activeBranch;
      }
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }

      const list = await clinicServiceService.getAll(params);
      setServices(list);
    } catch (err: any) {
      console.error('Failed to fetch services', err);
      toast.error(
        err?.response?.data?.message ||
          t('clinicServices.alerts.loadFailed', 'Failed to load clinic services'),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [selectedBranchFilter, statusFilter]);

  // Branch Options
  const branchFilterOptions: SearchableSelectOption[] = useMemo(() => {
    const opts: SearchableSelectOption[] = [
      { value: 'all', label: t('common.allBranches', 'All Branches') },
    ];
    branches.forEach((b) => {
      opts.push({ value: b.id, label: b.name });
    });
    return opts;
  }, [branches, t]);

  const branchFormOptions: SearchableSelectOption[] = useMemo(() => {
    return branches.map((b) => ({ value: b.id, label: b.name }));
  }, [branches]);

  // Status Options
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
      price: '',
      status: 'ACTIVE',
      branchId: selectedBranchFilter !== 'all' ? selectedBranchFilter : branches[0]?.id || '',
    });
    setFormErrors({});
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: ClinicServiceItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      price: String(item.price),
      status: item.status,
      branchId: item.branchId || branches[0]?.id || '',
    });
    setFormErrors({});
    setShowModal(true);
  };

  // Validate form
  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!formData.name.trim()) {
      errors.name = t('clinicServices.validation.nameRequired', 'Service name is required.');
    }
    const numPrice = parseFloat(formData.price);
    if (!formData.price.trim() || isNaN(numPrice) || numPrice < 0) {
      errors.price = t('clinicServices.validation.priceInvalid', 'A valid non-negative price is required.');
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
      const numPrice = parseFloat(formData.price);
      if (editingItem) {
        await clinicServiceService.update(editingItem.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          price: numPrice,
          status: formData.status,
          branchId: formData.branchId || undefined,
        });
        toast.success(
          t('clinicServices.alerts.updateSuccess', 'Service updated successfully.'),
        );
      } else {
        await clinicServiceService.create({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          price: numPrice,
          branchId: formData.branchId || undefined,
        });
        toast.success(
          t('clinicServices.alerts.createSuccess', 'Service created successfully.'),
        );
      }
      setShowModal(false);
      fetchServices();
    } catch (err: any) {
      console.error('Failed to save service', err);
      const msg =
        err?.response?.data?.message ||
        t('clinicServices.alerts.saveFailed', 'Failed to save service.');
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
      await clinicServiceService.delete(deletingItem.id);
      toast.success(
        t('clinicServices.alerts.deleteSuccess', 'Service removed successfully.'),
      );
      setDeletingItem(null);
      fetchServices();
    } catch (err: any) {
      console.error('Failed to delete service', err);
      toast.error(
        err?.response?.data?.message ||
          t('clinicServices.alerts.deleteFailed', 'Failed to delete service.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Format currency
  const formatPrice = (val: number | string) => {
    const num = Number(val);
    if (isNaN(num)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  // Filter & Pagination calculations
  const filteredServices = useMemo(() => {
    return services.filter((item) => {
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
  }, [services, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / pageSize));
  const paginatedServices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredServices.slice(start, start + pageSize);
  }, [filteredServices, currentPage, pageSize]);

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
            <Wrench size={22} />
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
              {t('clinicServices.title', 'Services')}
            </h1>
            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {t(
                'clinicServices.subtitle',
                'Manage clinic service offerings, treatment procedures, and pricing',
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
          <span>{t('clinicServices.addBtn', 'Add Service')}</span>
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
        {/* Branch filter */}
        {branches.length > 1 && (
          <div style={{ width: '220px', minWidth: '180px' }}>
            <SearchableSelect
              options={branchFilterOptions}
              value={selectedBranchFilter}
              onChange={(val) => {
                setSelectedBranchFilter(val);
                setCurrentPage(1);
              }}
              icon={<Building2 size={16} style={{ color: '#0284c7' }} />}
              placeholder={t('common.selectBranch', 'Filter Branch')}
            />
          </div>
        )}

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
            placeholder={t('clinicServices.searchPlaceholder', 'Search service by name or description...')}
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
                  {t('clinicServices.fields.name', 'Service Name')}
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                  {t('clinicServices.fields.description', 'Description')}
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                  {t('clinicServices.fields.price', 'Price')}
                </th>
                {branches.length > 1 && (
                  <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                    {t('clinicServices.fields.branch', 'Branch')}
                  </th>
                )}
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
                  <td colSpan={branches.length > 1 ? 6 : 5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    {t('common.loading', 'Loading services...')}
                  </td>
                </tr>
              ) : paginatedServices.length === 0 ? (
                <tr>
                  <td colSpan={branches.length > 1 ? 6 : 5} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
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
                      <Wrench size={24} />
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>
                      {t('clinicServices.noRecords', 'No services found')}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {search
                        ? t('clinicServices.empty.searchDesc', 'No services matched your search criteria.')
                        : t('clinicServices.noRecordsDesc', 'Create your first clinic service using the button above.')}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedServices.map((item) => (
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
                          <Wrench size={16} />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-heading)' }}>
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-muted)', maxWidth: '320px' }}>
                      {item.description || '—'}
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-heading)' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '14px' }}>{formatPrice(item.price)}</span>
                    </td>
                    {branches.length > 1 && (
                      <td style={{ padding: '14px 18px', color: 'var(--text-main)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Building2 size={14} style={{ color: '#0284c7' }} />
                          {item.branch?.name || t('common.allBranches', 'All Branches')}
                        </span>
                      </td>
                    )}
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
        {filteredServices.length > 0 && (
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
            totalItems={filteredServices.length}
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
                  <Wrench size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                    {viewingItem.name}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    {t('clinicServices.viewModal.subtitle', 'Service Procedure Details')}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    {t('clinicServices.fields.price', 'Price')}
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: '#0284c7', fontFamily: 'monospace' }}>
                    {formatPrice(viewingItem.price)}
                  </span>
                </div>
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
              </div>

              {viewingItem.branch && (
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                    {t('clinicServices.fields.branch', 'Clinic Branch')}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
                    <Building2 size={14} style={{ color: '#0284c7' }} />
                    <span>{viewingItem.branch.name}</span>
                  </div>
                </div>
              )}

              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  {t('clinicServices.fields.description', 'Description')}
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
                    ? t('clinicServices.modal.editTitle', 'Edit Service')
                    : t('clinicServices.modal.createTitle', 'Add New Service')}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {editingItem
                    ? t('clinicServices.modal.editSubtitle', 'Update service details, price, and status')
                    : t('clinicServices.modal.createSubtitle', 'Enter details for the new clinical dental service')}
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
                  {t('clinicServices.fields.name', 'Service Name')} *
                </label>
                <input
                  type="text"
                  className={`form-input ${formErrors.name ? 'is-invalid' : ''}`}
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                  }}
                  placeholder={t('clinicServices.fields.namePlaceholder', 'e.g., Dental Cleaning, Root Canal, Composite Filling')}
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
                  {t('clinicServices.fields.description', 'Description')}
                </label>
                <textarea
                  rows={2}
                  className="form-input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('clinicServices.fields.descPlaceholder', 'Optional summary or details of the procedure...')}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Field 3: Price */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                  {t('clinicServices.fields.price', 'Price')} ($) *
                </label>
                <div style={{ position: 'relative' }}>
                  <DollarSign
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
                    type="number"
                    step="0.01"
                    min="0"
                    className={`form-input ${formErrors.price ? 'is-invalid' : ''}`}
                    style={{ paddingLeft: '34px' }}
                    value={formData.price}
                    onChange={(e) => {
                      setFormData({ ...formData, price: e.target.value });
                      if (formErrors.price) setFormErrors({ ...formErrors, price: '' });
                    }}
                    placeholder="0.00"
                    required
                  />
                </div>
                {formErrors.price && (
                  <span style={{ fontSize: '11px', color: 'var(--rose-500)', marginTop: '4px', display: 'block' }}>
                    {formErrors.price}
                  </span>
                )}
              </div>

              {/* Optional Branch Field */}
              {branches.length > 1 && (
                <div>
                  <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                    {t('clinicServices.fields.branch', 'Clinic Branch')}
                  </label>
                  <SearchableSelect
                    options={branchFormOptions}
                    value={formData.branchId}
                    onChange={(val) => setFormData({ ...formData, branchId: val })}
                    placeholder={t('common.selectBranch', 'Select Branch')}
                    icon={<Building2 size={15} style={{ color: '#0284c7' }} />}
                  />
                </div>
              )}

              {/* Field 4: Status (Displayed ONLY when editing an existing record) */}
              {editingItem && (
                <div>
                  <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                    {t('common.status', 'Status')}
                  </label>
                  <SearchableSelect
                    options={statusFormOptions}
                    value={formData.status}
                    onChange={(val) => setFormData({ ...formData, status: val as ServiceStatus })}
                    placeholder={t('common.selectStatus', 'Select Status')}
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {t('clinicServices.modal.statusNotice', 'Status can only be modified for existing records.')}
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
                      : t('clinicServices.modal.createBtn', 'Create Service')}
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
                  {t('clinicServices.deleteModal.title', 'Delete Service')}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {t('clinicServices.deleteModal.warning', 'This action cannot be undone.')}
                </p>
              </div>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--text-main)', marginBottom: '20px' }}>
              {t(
                'clinicServices.deleteModal.confirmPrompt',
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

export default ClinicServicesPage;
