import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import { SearchableSelect, SearchableSelectOption } from '../../components/common/SearchableSelect';
import { Tooltip } from '../../components/common/Tooltip';
import { Pagination } from '../../components/common/Pagination';
import {
  MessageSquare,
  Plus,
  Search,
  Building2,
  Trash2,
  Edit2,
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  Eye,
} from 'lucide-react';
import {
  clinicWhatsappTemplateService,
  ClinicWhatsappTemplateItem,
  WhatsappTemplateStatus,
} from '../../services/clinicWhatsappTemplateService';

interface PlaceholderItem {
  key: string;
  tag: string;
  label: string;
  description: string;
  sample: string;
}

const PLACEHOLDERS: PlaceholderItem[] = [
  {
    key: 'patient_name',
    tag: '{patient_name}',
    label: 'Patient Name',
    description: 'Patient full name',
    sample: 'John Doe',
  },
  {
    key: 'site_name',
    tag: '{site_name}',
    label: 'Site Name',
    description: 'Clinic / Practice name',
    sample: 'Smile Care Dental Clinic',
  },
  {
    key: 'phone',
    tag: '{phone}',
    label: 'Phone',
    description: 'Clinic contact phone number',
    sample: '+52 55 1234 5678',
  },
];

export const ClinicWhatsappTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, isTenantAdmin } = useAuth();
  const { toast } = useToast();

  const [templates, setTemplates] = useState<ClinicWhatsappTemplateItem[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | WhatsappTemplateStatus>('ALL');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState(user?.activeBranchId || '');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal & Form States
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<ClinicWhatsappTemplateItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<ClinicWhatsappTemplateItem | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<ClinicWhatsappTemplateItem | null>(null);

  // Form States
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    status: WhatsappTemplateStatus;
    branchId: string;
  }>({
    name: '',
    description: '',
    status: 'ACTIVE',
    branchId: '',
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Fetch Templates
  const fetchTemplates = async () => {
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
      if (search.trim()) {
        params.search = search.trim();
      }

      const list = await clinicWhatsappTemplateService.getAll(params);
      setTemplates(list);
    } catch (err: any) {
      console.error('Failed to fetch WhatsApp templates', err);
      toast.error(
        err?.response?.data?.message ||
          t('clinicWhatsapp.alerts.loadFailed', 'Failed to load clinic WhatsApp templates'),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
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

  // Insert placeholder at cursor position
  const handleInsertPlaceholder = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setFormData((prev) => ({
        ...prev,
        description: prev.description ? `${prev.description} ${tag}` : tag,
      }));
      return;
    }

    const start = textarea.selectionStart ?? formData.description.length;
    const end = textarea.selectionEnd ?? formData.description.length;
    const current = formData.description;
    const nextDesc = current.substring(0, start) + tag + current.substring(end);

    setFormData((prev) => ({ ...prev, description: nextDesc }));

    setTimeout(() => {
      textarea.focus();
      const newPos = start + tag.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      status: 'ACTIVE',
      branchId: selectedBranchFilter !== 'all' ? selectedBranchFilter : branches[0]?.id || '',
    });
    setFormErrors({});
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: ClinicWhatsappTemplateItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.message,
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
      errors.name = t('clinicWhatsapp.validation.nameRequired', 'Template name is required.');
    }
    if (!formData.description.trim()) {
      errors.description = t('clinicWhatsapp.validation.descRequired', 'Template message/description is required.');
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
        await clinicWhatsappTemplateService.update(editingItem.id, {
          name: formData.name.trim(),
          message: formData.description.trim(),
          status: formData.status,
          branchId: formData.branchId || undefined,
        });
        toast.success(
          t('clinicWhatsapp.alerts.updateSuccess', 'WhatsApp template updated successfully.'),
        );
      } else {
        await clinicWhatsappTemplateService.create({
          name: formData.name.trim(),
          message: formData.description.trim(),
          status: formData.status,
          branchId: formData.branchId || undefined,
        });
        toast.success(
          t('clinicWhatsapp.alerts.createSuccess', 'WhatsApp template created successfully.'),
        );
      }
      setShowModal(false);
      fetchTemplates();
    } catch (err: any) {
      console.error('Failed to save WhatsApp template', err);
      const msg =
        err?.response?.data?.message ||
        t('clinicWhatsapp.alerts.saveFailed', 'Failed to save WhatsApp template.');
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
      await clinicWhatsappTemplateService.delete(deletingItem.id);
      toast.success(
        t('clinicWhatsapp.alerts.deleteSuccess', 'WhatsApp template removed successfully.'),
      );
      setDeletingItem(null);
      fetchTemplates();
    } catch (err: any) {
      console.error('Failed to delete WhatsApp template', err);
      toast.error(
        err?.response?.data?.message ||
          t('clinicWhatsapp.alerts.deleteFailed', 'Failed to delete WhatsApp template.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Format preview with dynamic placeholders
  const renderResolvedPreview = (msg: string) => {
    let out = msg;
    PLACEHOLDERS.forEach((p) => {
      out = out.split(p.tag).join(p.sample);
    });
    return out;
  };

  // Filter & Pagination calculations
  const filteredTemplates = useMemo(() => {
    return templates.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.message.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [templates, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTemplates.length / pageSize));
  const paginatedTemplates = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTemplates.slice(start, start + pageSize);
  }, [filteredTemplates, currentPage, pageSize]);

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
              backgroundColor: 'rgba(37, 211, 102, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#25D366',
            }}
          >
            <MessageSquare size={22} />
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
              {t('clinicWhatsapp.title', 'WhatsApp Template')}
            </h1>
            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {t(
                'clinicWhatsapp.subtitle',
                'Configure automated messaging templates with dynamic placeholders for patients',
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
          <span>{t('clinicWhatsapp.addBtn', 'Add Template')}</span>
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
            placeholder={t('clinicWhatsapp.searchPlaceholder', 'Search template by name or description...')}
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
                  {t('clinicWhatsapp.fields.name', 'Template Name')}
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                  {t('clinicWhatsapp.fields.description', 'Description (Message)')}
                </th>
                {branches.length > 1 && (
                  <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                    {t('clinicWhatsapp.fields.branch', 'Branch')}
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
                  <td colSpan={branches.length > 1 ? 5 : 4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    {t('common.loading', 'Loading templates...')}
                  </td>
                </tr>
              ) : paginatedTemplates.length === 0 ? (
                <tr>
                  <td colSpan={branches.length > 1 ? 5 : 4} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(37, 211, 102, 0.1)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#25D366',
                        marginBottom: '12px',
                      }}
                    >
                      <MessageSquare size={24} />
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>
                      {t('clinicWhatsapp.noRecords', 'No WhatsApp templates found')}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {search
                        ? t('clinicWhatsapp.empty.searchDesc', 'No templates matched your search criteria.')
                        : t('clinicWhatsapp.noRecordsDesc', 'Create your first automated WhatsApp template using the button above.')}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTemplates.map((item) => (
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
                            backgroundColor: 'rgba(37, 211, 102, 0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#25D366',
                            flexShrink: 0,
                          }}
                        >
                          <MessageSquare size={16} />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-heading)' }}>
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-muted)', maxWidth: '420px' }}>
                      <p style={{ margin: 0, fontSize: '12.5px', lineHeight: '1.5', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {item.message}
                      </p>
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
                        <Tooltip content={t('clinicWhatsapp.preview', 'Live Preview')}>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => setPreviewTemplate(item)}
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-surface)',
                              color: '#059669',
                              cursor: 'pointer',
                            }}
                          >
                            <Eye size={14} />
                          </button>
                        </Tooltip>

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
        {filteredTemplates.length > 0 && (
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
            totalItems={filteredTemplates.length}
          />
        )}
      </div>

      {/* ─── CREATE / EDIT MODAL ─── */}
      {showModal && (
        <div className="modal-overlay" style={{ zIndex: 1070 }} onClick={() => !submitting && setShowModal(false)}>
          <div
            className="modal-content"
            style={{
              maxWidth: '560px',
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
                    ? t('clinicWhatsapp.modal.editTitle', 'Edit WhatsApp Template')
                    : t('clinicWhatsapp.modal.createTitle', 'Add WhatsApp Template')}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {t('clinicWhatsapp.modal.subtitle', 'Configure template name, body message, and placeholders')}
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
                  {t('clinicWhatsapp.fields.name', 'Template Name')} *
                </label>
                <input
                  type="text"
                  className={`form-input ${formErrors.name ? 'is-invalid' : ''}`}
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                  }}
                  placeholder={t('clinicWhatsapp.fields.namePlaceholder', 'e.g., Appointment Confirmation, Reminder, Follow-up')}
                  autoFocus
                  required
                />
                {formErrors.name && (
                  <span style={{ fontSize: '11px', color: 'var(--rose-500)', marginTop: '4px', display: 'block' }}>
                    {formErrors.name}
                  </span>
                )}
              </div>

              {/* Field 2: Description / Message with Dynamic Placeholders */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>
                    {t('clinicWhatsapp.fields.description', 'Description (Message)')} *
                  </label>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={12} style={{ color: '#f59e0b' }} />
                    <span>{t('clinicWhatsapp.clickToInsert', 'Click tags to insert')}</span>
                  </span>
                </div>

                {/* Placeholder Chips Bar */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface)',
                    marginBottom: '8px',
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginRight: '2px' }}>
                    {t('clinicWhatsapp.tags', 'Tags:')}
                  </span>
                  {PLACEHOLDERS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => handleInsertPlaceholder(p.tag)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: '#059669',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      title={`${p.label} - ${p.description}`}
                    >
                      <Plus size={11} />
                      <span>{p.tag}</span>
                    </button>
                  ))}
                </div>

                <textarea
                  ref={textareaRef}
                  rows={4}
                  className={`form-input ${formErrors.description ? 'is-invalid' : ''}`}
                  value={formData.description}
                  onChange={(e) => {
                    setFormData({ ...formData, description: e.target.value });
                    if (formErrors.description) setFormErrors({ ...formErrors, description: '' });
                  }}
                  placeholder={t(
                    'clinicWhatsapp.fields.descPlaceholder',
                    'Hello {patient_name}, your appointment at {site_name} is confirmed. If you have questions, please call us at {phone}.',
                  )}
                  style={{ resize: 'vertical', lineHeight: '1.5' }}
                  required
                />
                {formErrors.description && (
                  <span style={{ fontSize: '11px', color: 'var(--rose-500)', marginTop: '4px', display: 'block' }}>
                    {formErrors.description}
                  </span>
                )}
              </div>

              {/* Dynamic Live Resolved Preview */}
              {formData.description.trim() && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(37, 211, 102, 0.3)',
                    backgroundColor: 'rgba(37, 211, 102, 0.06)',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#059669', marginBottom: '4px' }}>
                    <Eye size={13} />
                    <span>{t('clinicWhatsapp.liveSamplePreview', 'Sample Resolved Preview:')}</span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                    {renderResolvedPreview(formData.description)}
                  </p>
                </div>
              )}

              {/* Optional Branch Field */}
              {branches.length > 1 && (
                <div>
                  <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                    {t('clinicWhatsapp.fields.branch', 'Clinic Branch')}
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

              {/* Field 3: Status */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                  {t('common.status', 'Status')}
                </label>
                <SearchableSelect
                  options={statusFormOptions}
                  value={formData.status}
                  onChange={(val) => setFormData({ ...formData, status: val as WhatsappTemplateStatus })}
                  placeholder={t('common.selectStatus', 'Select Status')}
                />
              </div>

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
                      : t('clinicWhatsapp.modal.createBtn', 'Create Template')}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── LIVE PREVIEW MODAL ─── */}
      {previewTemplate && (
        <div className="modal-overlay" style={{ zIndex: 1075 }} onClick={() => setPreviewTemplate(null)}>
          <div
            className="modal-content"
            style={{
              maxWidth: '460px',
              width: '100%',
              padding: '24px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontWeight: 700, fontSize: '14px' }}>
                <MessageSquare size={17} />
                <span>{previewTemplate.name}</span>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setPreviewTemplate(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Bubble style preview */}
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid rgba(37, 211, 102, 0.3)',
                backgroundColor: 'rgba(37, 211, 102, 0.08)',
                marginBottom: '14px',
                fontSize: '13.5px',
                lineHeight: '1.5',
              }}
            >
              <span style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#059669', display: 'block', marginBottom: '6px' }}>
                {t('clinicWhatsapp.sampleWhatsappMessage', 'WhatsApp Preview')}
              </span>
              <p style={{ margin: 0, color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
                {renderResolvedPreview(previewTemplate.message)}
              </p>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '18px' }}>
              <span style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                {t('clinicWhatsapp.templateRaw', 'Raw Template:')}
              </span>
              <p style={{ margin: 0, fontFamily: 'monospace', padding: '8px 10px', borderRadius: '6px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap', fontSize: '11.5px' }}>
                {previewTemplate.message}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setPreviewTemplate(null)}
              >
                {t('common.close', 'Close')}
              </button>
            </div>
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
                  {t('clinicWhatsapp.deleteModal.title', 'Delete WhatsApp Template')}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {t('clinicWhatsapp.deleteModal.warning', 'This action cannot be undone.')}
                </p>
              </div>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--text-main)', marginBottom: '20px' }}>
              {t(
                'clinicWhatsapp.deleteModal.confirmPrompt',
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

export default ClinicWhatsappTemplatesPage;
