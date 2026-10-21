import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import { SearchableSelect, SearchableSelectOption } from '../../components/common/SearchableSelect';
import { Tooltip } from '../../components/common/Tooltip';
import { Pagination } from '../../components/common/Pagination';
import { formatDate } from '../../core/utils/dateUtils';
import {
  MessageSquare,
  Plus,
  Search,
  Building2,
  Trash2,
  Edit2,
  X,
  Copy,
  Save,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  AlertTriangle,
  Clipboard,
  Calendar,
  User as UserIcon,
} from 'lucide-react';
import {
  whatsappTemplateService,
  WhatsappTemplateItem,
  WhatsappTemplateStatus,
} from '../../services/whatsappTemplateService';

interface PlaceholderTagConfig {
  key: string;
  tagKey: string;
  defaultTag: string;
  hintKey: string;
  defaultHint: string;
}

const PLACEHOLDER_CONFIGS: PlaceholderTagConfig[] = [
  {
    key: 'doctorName',
    tagKey: 'labWhatsappTemplates.placeholders.doctorName',
    defaultTag: '{doctor_name}',
    hintKey: 'labWhatsappTemplates.placeholders.doctorNameHint',
    defaultHint: 'Doctor Name',
  },
  {
    key: 'workorderNumber',
    tagKey: 'labWhatsappTemplates.placeholders.workorderNumber',
    defaultTag: '{workorder_number}',
    hintKey: 'labWhatsappTemplates.placeholders.workorderNumberHint',
    defaultHint: 'Work Order Number',
  },
  {
    key: 'folioNumber',
    tagKey: 'labWhatsappTemplates.placeholders.folioNumber',
    defaultTag: '{folio_number}',
    hintKey: 'labWhatsappTemplates.placeholders.folioNumberHint',
    defaultHint: 'Folio Number',
  },
  {
    key: 'boxNumber',
    tagKey: 'labWhatsappTemplates.placeholders.boxNumber',
    defaultTag: '{boxnumber}',
    hintKey: 'labWhatsappTemplates.placeholders.boxNumberHint',
    defaultHint: 'Box Number',
  },
  {
    key: 'verificationLink',
    tagKey: 'labWhatsappTemplates.placeholders.verificationLink',
    defaultTag: '{verification_link}',
    hintKey: 'labWhatsappTemplates.placeholders.verificationLinkHint',
    defaultHint: 'Verification Link',
  },
];

const ALL_SUPPORTED_PLACEHOLDERS = [
  '{doctor_name}',
  '{nombre_doctor}',
  '{workorder_number}',
  '{numero_orden_trabajo}',
  '{numero_orden}',
  '{folio_number}',
  '{numero_folio}',
  '{boxnumber}',
  '{numero_caja}',
  '{caja}',
  '{verification_link}',
  '{enlace_verificacion}',
  '{link_verificacion}',
];

export const LabWhatsappTemplatesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, isTenantAdmin } = useAuth();
  const { toast } = useToast();

  const [templates, setTemplates] = useState<WhatsappTemplateItem[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | WhatsappTemplateStatus>('ALL');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');

  // Form & View State
  const [showFormCard, setShowFormCard] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsappTemplateItem | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<WhatsappTemplateItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // Form fields
  const [formData, setFormData] = useState<{
    name: string;
    status: WhatsappTemplateStatus;
    message: string;
    branchId: string;
  }>({
    name: '',
    status: 'ACTIVE',
    message: '',
    branchId: '',
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Delete modal state (Tenant Admin only)
  const [deletingTemplate, setDeletingTemplate] = useState<WhatsappTemplateItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const formCardRef = useRef<HTMLDivElement | null>(null);

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

  // Fetch Templates
  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (isTenantAdmin && selectedBranchFilter && selectedBranchFilter !== 'all') {
        params.branchId = selectedBranchFilter;
      }
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      if (search.trim()) {
        params.search = search.trim();
      }

      const list = await whatsappTemplateService.getAll(params);
      setTemplates(list);
    } catch (err: any) {
      console.error('Failed to fetch WhatsApp templates', err);
      toast.error(
        err?.response?.data?.message ||
          t('labWhatsappTemplates.alerts.loadFailed', 'Failed to load WhatsApp templates'),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [selectedBranchFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTemplates();
  };

  const handleResetSearch = () => {
    setSearch('');
    setTimeout(() => fetchTemplates(), 0);
  };

  // Branch Options for Select
  const branchOptions: SearchableSelectOption[] = useMemo(() => {
    const options: SearchableSelectOption[] = [
      { value: 'all', label: t('labWhatsappTemplates.allBranches', 'All Branches') },
    ];
    branches.forEach((b) => {
      options.push({ value: b.id, label: b.name });
    });
    return options;
  }, [branches, t]);

  // Status Options for SearchableSelect
  const statusFilterOptions: SearchableSelectOption[] = useMemo(() => [
    { value: 'ALL', label: t('labWhatsappTemplates.allStatuses', 'All Statuses') },
    { value: 'ACTIVE', label: t('labWhatsappTemplates.active', 'Active') },
    { value: 'INACTIVE', label: t('labWhatsappTemplates.inactive', 'Inactive') },
  ], [t]);

  const statusFormOptions: SearchableSelectOption[] = useMemo(() => [
    { value: 'ACTIVE', label: t('labWhatsappTemplates.active', 'Active') },
    { value: 'INACTIVE', label: t('labWhatsappTemplates.inactive', 'Inactive') },
  ], [t]);

  // Open Create Form
  const handleOpenCreateForm = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      status: 'ACTIVE',
      message: '',
      branchId: branches[0]?.id || '',
    });
    setFormErrors({});
    setShowFormCard(true);
    setTimeout(() => {
      formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Open Edit Form
  const handleOpenEditForm = (item: WhatsappTemplateItem) => {
    setEditingTemplate(item);
    setFormData({
      name: item.name,
      status: item.status,
      message: item.message,
      branchId: item.branchId || branches[0]?.id || '',
    });
    setFormErrors({});
    setShowFormCard(true);
    setTimeout(() => {
      formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Active localized placeholders for insertion
  const activePlaceholders = useMemo(() => {
    return PLACEHOLDER_CONFIGS.map((cfg) => ({
      tag: t(cfg.tagKey, cfg.defaultTag),
      hint: t(cfg.hintKey, cfg.defaultHint),
    }));
  }, [t]);

  // Duplicate Template
  const handleDuplicate = (item: WhatsappTemplateItem) => {
    setEditingTemplate(null);
    setFormData({
      name: `${item.name} (${t('labWhatsappTemplates.copySuffix', 'Copy')})`,
      status: item.status,
      message: item.message,
      branchId: item.branchId || branches[0]?.id || '',
    });
    setFormErrors({});
    setShowFormCard(true);
    setTimeout(() => {
      formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Cancel Form
  const handleCancelForm = () => {
    setShowFormCard(false);
    setEditingTemplate(null);
    setFormErrors({});
  };

  // Insert placeholder tag at cursor location in textarea
  const handleInsertPlaceholder = (placeholderTag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setFormData((prev) => ({
        ...prev,
        message: prev.message ? `${prev.message} ${placeholderTag}` : placeholderTag,
      }));
      return;
    }

    const start = textarea.selectionStart ?? formData.message.length;
    const end = textarea.selectionEnd ?? formData.message.length;
    const current = formData.message;
    const nextMessage = current.substring(0, start) + placeholderTag + current.substring(end);

    setFormData((prev) => ({ ...prev, message: nextMessage }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholderTag.length, start + placeholderTag.length);
    }, 0);
  };

  // Form Validation
  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!formData.name.trim()) {
      errors.name = t('labWhatsappTemplates.errors.nameRequired', 'Template name is required');
    }
    if (!formData.message.trim()) {
      errors.message = t('labWhatsappTemplates.errors.messageRequired', 'Message body is required');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Form Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        status: formData.status,
        message: formData.message.trim(),
      };
      if (isTenantAdmin && formData.branchId) {
        payload.branchId = formData.branchId;
      }

      if (editingTemplate) {
        await whatsappTemplateService.update(editingTemplate.id, payload);
        toast.success(
          t('labWhatsappTemplates.alerts.updateSuccess', {
            name: formData.name,
            defaultValue: `WhatsApp template "${formData.name}" updated successfully`,
          }),
        );
      } else {
        await whatsappTemplateService.create(payload);
        toast.success(
          t('labWhatsappTemplates.alerts.createSuccess', {
            name: formData.name,
            defaultValue: `WhatsApp template "${formData.name}" created successfully`,
          }),
        );
      }

      setShowFormCard(false);
      setEditingTemplate(null);
      fetchTemplates();
    } catch (err: any) {
      console.error('Template save failed', err);
      toast.error(
        err?.response?.data?.message ||
          (editingTemplate
            ? t('labWhatsappTemplates.alerts.updateFailed', 'Failed to update WhatsApp template')
            : t('labWhatsappTemplates.alerts.createFailed', 'Failed to create WhatsApp template')),
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete (Tenant Admin Only)
  const handleDeleteConfirm = async () => {
    if (!deletingTemplate) return;
    setDeleting(true);
    try {
      await whatsappTemplateService.delete(deletingTemplate.id);
      toast.success(
        t('labWhatsappTemplates.alerts.deleteSuccess', {
          name: deletingTemplate.name,
          defaultValue: `WhatsApp template "${deletingTemplate.name}" deleted successfully`,
        }),
      );
      setDeletingTemplate(null);
      fetchTemplates();
    } catch (err: any) {
      console.error('Delete failed', err);
      toast.error(
        err?.response?.data?.message ||
          t('labWhatsappTemplates.alerts.deleteFailed', 'Failed to delete template'),
      );
    } finally {
      setDeleting(false);
    }
  };

  // Copy message to clipboard
  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(
      t('labWhatsappTemplates.viewModal.messageCopied', 'Message copied to clipboard'),
    );
  };

  // Filtered & Paginated list
  const filteredTemplates = useMemo(() => {
    let result = templates;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.message.toLowerCase().includes(q),
      );
    }
    return result;
  }, [templates, search]);

  const totalPages = Math.ceil(filteredTemplates.length / pageSize) || 1;
  const paginatedTemplates = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTemplates.slice(start, start + pageSize);
  }, [filteredTemplates, currentPage, pageSize]);

  // Helper to generate live simulated WhatsApp preview
  const getSimulatedPreviewText = (text: string) => {
    if (!text) return '';
    const isEs = i18n.language?.startsWith('es');
    return text
      .replace(/{doctor_name}|{nombre_doctor}/gi, isEs ? 'Dra. Sarah Jenkins' : 'Dr. Sarah Jenkins')
      .replace(/{workorder_number}|{numero_orden_trabajo}|{numero_orden}/gi, 'WO-2026-089')
      .replace(/{folio_number}|{numero_folio}/gi, 'FOL-7841')
      .replace(/{boxnumber}|{numero_caja}|{caja}/gi, isEs ? 'CAJA-04' : 'BOX-04')
      .replace(/{verification_link}|{enlace_verificacion}|{link_verificacion}/gi, `${window.location.origin}/qr/sample-token`);
  };

  // Helper to highlight placeholder tags in raw message display
  const renderHighlightedMessage = (text: string) => {
    if (!text) return null;
    const parts = text.split(/({[a-zA-Z0-9_áéíóúñÁÉÍÓÚÑ]+})/g);
    return parts.map((part, idx) => {
      const lower = part.toLowerCase();
      if (ALL_SUPPORTED_PLACEHOLDERS.some((p) => p.toLowerCase() === lower)) {
        return (
          <span
            key={idx}
            style={{
              backgroundColor: '#dbeafe',
              color: '#1d4ed8',
              padding: '1px 6px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontWeight: 600,
              fontSize: '12.5px',
              margin: '0 2px',
              display: 'inline-block',
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div>
      {/* ─── PAGE HEADER ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'var(--badge-primary-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-600)',
              }}
            >
              <MessageSquare size={20} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {t('labWhatsappTemplates.title', 'WhatsApp Templates')}
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            {t(
              'labWhatsappTemplates.description',
              'Design and customize automated WhatsApp notification templates for cases and alerts.',
            )}
          </p>
        </div>

        {!showFormCard && (
          <button
            onClick={handleOpenCreateForm}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontWeight: 600,
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
            }}
          >
            <Plus size={18} />
            <span>{t('labWhatsappTemplates.createNew', 'Create New Template')}</span>
          </button>
        )}
      </div>

      {/* ─── CREATE / EDIT TEMPLATE CARD (Matching Mockup) ─── */}
      {showFormCard && (
        <div
          ref={formCardRef}
          className="card"
          style={{
            marginBottom: '28px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.08)',
            backgroundColor: 'var(--bg-card)',
            padding: '24px',
            animation: 'fadeIn 0.2s ease-in-out',
          }}
        >
          {/* Card Title */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text-heading)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ color: 'var(--primary-600)', fontSize: '20px' }}>
                {editingTemplate ? '✎' : '+'}
              </span>
              <span>
                {editingTemplate
                  ? t('labWhatsappTemplates.editTemplate', 'Edit Template')
                  : t('labWhatsappTemplates.createNew', 'Create New Template')}
              </span>
            </h2>

            <button
              type="button"
              onClick={handleCancelForm}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleFormSubmit}>
            {/* Row 1: Template Name & Status */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isTenantAdmin
                  ? 'repeat(auto-fit, minmax(220px, 1fr))'
                  : 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '20px',
                marginBottom: '20px',
              }}
            >
              {/* Template Name */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--text-heading)',
                    marginBottom: '8px',
                  }}
                >
                  {t('labWhatsappTemplates.templateName', 'Template Name')}{' '}
                  <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={t(
                    'labWhatsappTemplates.templateNamePlaceholder',
                    'e.g. External Verification Reminder',
                  )}
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    borderColor: formErrors.name ? '#ef4444' : undefined,
                  }}
                />
                {formErrors.name && (
                  <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', margin: 0 }}>
                    {formErrors.name}
                  </p>
                )}
              </div>

              {/* Status */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--text-heading)',
                    marginBottom: '8px',
                  }}
                >
                  {t('labWhatsappTemplates.status', 'Status')}{' '}
                  <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <SearchableSelect
                  options={statusFormOptions}
                  value={formData.status}
                  onChange={(val) =>
                    setFormData({ ...formData, status: val as WhatsappTemplateStatus })
                  }
                  placeholder={t('labWhatsappTemplates.status', 'Status')}
                />
              </div>

              {/* Branch (Tenant Admin only) */}
              {isTenantAdmin && (
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: 'var(--text-heading)',
                      marginBottom: '8px',
                    }}
                  >
                    {t('labWhatsappTemplates.branch', 'Branch')}
                  </label>
                  <select
                    className="form-input"
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Row 2: Message Textarea */}
            <div style={{ marginBottom: '18px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <label
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--text-heading)',
                    margin: 0,
                  }}
                >
                  {t('labWhatsappTemplates.message', 'Message')}{' '}
                  <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {t('labWhatsappTemplates.charCount', {
                    count: formData.message.length,
                    defaultValue: `Characters: ${formData.message.length}`,
                  })}
                </span>
              </div>

              <textarea
                ref={textareaRef}
                rows={5}
                className="form-input"
                placeholder={t(
                  'labWhatsappTemplates.messagePlaceholder',
                  'Type your WhatsApp notification message here...',
                )}
                value={formData.message}
                onChange={(e) => {
                  setFormData({ ...formData, message: e.target.value });
                  if (formErrors.message) setFormErrors({ ...formErrors, message: '' });
                }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  borderColor: formErrors.message ? '#ef4444' : undefined,
                }}
              />
              {formErrors.message && (
                <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', margin: 0 }}>
                  {formErrors.message}
                </p>
              )}
            </div>

            {/* Row 3: Placeholders Box (Matching the screenshot pixel-for-pixel) */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '14px 18px',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                  marginBottom: '10px',
                  fontWeight: 500,
                }}
              >
                <strong style={{ color: 'var(--text-heading)', fontWeight: 700 }}>
                  {t('labWhatsappTemplates.placeholdersTitle', 'Placeholders:')}
                </strong>{' '}
                <em>
                  ({t('labWhatsappTemplates.placeholdersHint', 'Click any tag to insert into message')})
                </em>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {activePlaceholders.map(({ tag, hint }) => (
                  <button
                    key={tag}
                    type="button"
                    title={hint}
                    onClick={() => handleInsertPlaceholder(tag)}
                    style={{
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      border: '1px solid #bfdbfe',
                      color: '#2563eb',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#eff6ff';
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)';
                      e.currentTarget.style.borderColor = '#bfdbfe';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Live WhatsApp Chat Bubble Preview */}
            {formData.message.trim() && (
              <div style={{ marginBottom: '24px' }}>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary-600)',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: 0,
                    marginBottom: '10px',
                  }}
                >
                  {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>
                    {showPreview
                      ? t('labWhatsappTemplates.hidePreview', 'Hide Live WhatsApp Preview')
                      : t('labWhatsappTemplates.livePreview', 'WhatsApp Live Preview')}
                  </span>
                </button>

                {showPreview && (
                  <div
                    style={{
                      backgroundColor: '#e5ddd5',
                      backgroundImage:
                        'radial-gradient(#cfc6bc 1px, transparent 1px), radial-gradient(#cfc6bc 1px, #e5ddd5 1px)',
                      backgroundSize: '20px 20px',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      border: '1px solid #d1d5db',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: '#dcf8c6',
                        color: '#111827',
                        padding: '10px 14px',
                        borderRadius: '10px 10px 2px 10px',
                        maxWidth: '540px',
                        marginLeft: 'auto',
                        fontSize: '13.5px',
                        lineHeight: '1.5',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                        position: 'relative',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {getSimulatedPreviewText(formData.message)}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '3px',
                          marginTop: '6px',
                          fontSize: '11px',
                          color: '#6b7280',
                        }}
                      >
                        <span>12:45 PM</span>
                        <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>✓✓</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons (Matching Screenshot) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '12px',
              }}
            >
              {/* Cancel Button (Red button with X) */}
              <button
                type="button"
                onClick={handleCancelForm}
                disabled={submitting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  transition: 'background-color 0.15s ease',
                  boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)',
                }}
                onMouseEnter={(e) => {
                  if (!submitting) e.currentTarget.style.backgroundColor = '#dc2626';
                }}
                onMouseLeave={(e) => {
                  if (!submitting) e.currentTarget.style.backgroundColor = '#ef4444';
                }}
              >
                <X size={16} />
                <span>{t('labWhatsappTemplates.cancel', 'Cancel')}</span>
              </button>

              {/* Submit Button (Blue button with Save icon) */}
              <button
                type="submit"
                disabled={submitting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 22px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  transition: 'background-color 0.15s ease',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                }}
                onMouseEnter={(e) => {
                  if (!submitting) e.currentTarget.style.backgroundColor = '#1d4ed8';
                }}
                onMouseLeave={(e) => {
                  if (!submitting) e.currentTarget.style.backgroundColor = '#2563eb';
                }}
              >
                <Save size={16} />
                <span>
                  {submitting
                    ? t('labWhatsappTemplates.saving', 'Saving...')
                    : editingTemplate
                    ? t('labWhatsappTemplates.saveChanges', 'Save Changes')
                    : t('labWhatsappTemplates.createButton', 'Create New Template')}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── SEARCH & FILTER BAR ─── */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          {/* Search Box */}
          <form
            onSubmit={handleSearchSubmit}
            style={{
              position: 'relative',
              flex: '1 1 280px',
              maxWidth: '450px',
            }}
          >
            <input
              type="text"
              className="form-input"
              placeholder={t(
                'labWhatsappTemplates.searchPlaceholder',
                'Search templates by name or content...',
              )}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: '36px',
                paddingRight: search ? '32px' : '14px',
                borderRadius: '8px',
                fontSize: '13.5px',
              }}
            />
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
          </form>

          {/* Filters on Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {t('labWhatsappTemplates.status', 'Status')}:
              </span>
              <div style={{ width: '160px', minWidth: '140px' }}>
                <SearchableSelect
                  options={statusFilterOptions}
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val as any)}
                  placeholder={t('labWhatsappTemplates.allStatuses', 'All Statuses')}
                />
              </div>
            </div>

            {/* Branch Filter (Tenant Admin only) */}
            {isTenantAdmin && (
              <div style={{ width: '200px' }}>
                <SearchableSelect
                  options={branchOptions}
                  value={selectedBranchFilter}
                  onChange={(val) => setSelectedBranchFilter(val)}
                  placeholder={t('labWhatsappTemplates.allBranches', 'All Branches')}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── DATA TABLE ─── */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13.5px',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)' }}>
                  {t('labWhatsappTemplates.templateName', 'Template Name')}
                </th>
                <th
                  style={{
                    padding: '14px 18px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    width: '120px',
                  }}
                >
                  {t('labWhatsappTemplates.status', 'Status')}
                </th>
                <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)' }}>
                  {t('labWhatsappTemplates.message', 'Message')}
                </th>
                {isTenantAdmin && (
                  <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)' }}>
                    {t('labWhatsappTemplates.branch', 'Branch')}
                  </th>
                )}
                <th
                  style={{
                    padding: '14px 18px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    width: '150px',
                  }}
                >
                  {t('labWhatsappTemplates.lastUpdated', 'Last Updated')}
                </th>
                <th
                  style={{
                    padding: '14px 18px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textAlign: 'right',
                    width: isTenantAdmin ? '160px' : '120px',
                  }}
                >
                  {t('labWhatsappTemplates.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={isTenantAdmin ? 6 : 5}
                    style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}
                  >
                    {t('common.loading', 'Loading...')}
                  </td>
                </tr>
              ) : paginatedTemplates.length === 0 ? (
                <tr>
                  <td
                    colSpan={isTenantAdmin ? 6 : 5}
                    style={{
                      textAlign: 'center',
                      padding: '50px 20px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <MessageSquare size={36} style={{ opacity: 0.35, marginBottom: '10px' }} />
                    <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-heading)' }}>
                      {t('labWhatsappTemplates.noTemplates', 'No WhatsApp templates found')}
                    </div>
                    <p style={{ fontSize: '13px', margin: '6px 0 16px', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' }}>
                      {t(
                        'labWhatsappTemplates.noTemplatesDesc',
                        'Create your first automated message template to send status updates and verification alerts.',
                      )}
                    </p>
                    {!showFormCard && (
                      <button
                        onClick={handleOpenCreateForm}
                        className="btn-primary"
                        style={{
                          padding: '8px 16px',
                          fontSize: '13px',
                          borderRadius: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Plus size={16} />
                        <span>{t('labWhatsappTemplates.createNew', 'Create New Template')}</span>
                      </button>
                    )}
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
                    {/* Name (Clickable to view) */}
                    <td style={{ padding: '14px 18px', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--badge-primary-bg)',
                            color: 'var(--primary-600)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '12px',
                            flexShrink: 0,
                          }}
                        >
                          WA
                        </div>
                        <button
                          type="button"
                          onClick={() => setViewingTemplate(item)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            font: 'inherit',
                            fontWeight: 600,
                            color: 'var(--text-heading)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'color 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--primary-600)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-heading)';
                          }}
                        >
                          {item.name}
                        </button>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 700,
                          backgroundColor:
                            item.status === 'ACTIVE'
                              ? 'var(--badge-success-bg, #dcfce7)'
                              : 'var(--bg-surface-muted, #f1f5f9)',
                          color:
                            item.status === 'ACTIVE'
                              ? 'var(--badge-success-text, #166534)'
                              : 'var(--text-muted)',
                        }}
                      >
                        {item.status === 'ACTIVE' ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <XCircle size={12} />
                        )}
                        <span>
                          {item.status === 'ACTIVE'
                            ? t('labWhatsappTemplates.active', 'Active')
                            : t('labWhatsappTemplates.inactive', 'Inactive')}
                        </span>
                      </span>
                    </td>

                    {/* Message Preview */}
                    <td
                      style={{
                        padding: '14px 18px',
                        color: 'var(--text-main)',
                        maxWidth: '380px',
                      }}
                    >
                      <div
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          lineHeight: '1.45',
                          fontSize: '13px',
                        }}
                      >
                        {item.message}
                      </div>
                    </td>

                    {/* Branch (Tenant Admin only) */}
                    {isTenantAdmin && (
                      <td style={{ padding: '14px 18px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Building2 size={14} />
                          <span>{item.branch?.name || t('labWhatsappTemplates.allBranches', 'All Branches')}</span>
                        </div>
                      </td>
                    )}

                    {/* Last Updated */}
                    <td style={{ padding: '14px 18px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      {formatDate(item.updatedAt || item.createdAt)}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '6px',
                        }}
                      >
                        {/* 1. View Template */}
                        <Tooltip content={t('labWhatsappTemplates.viewTemplate', 'View Template')}>
                          <button
                            type="button"
                            onClick={() => setViewingTemplate(item)}
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
                              color: 'var(--primary-600)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Eye size={14} />
                          </button>
                        </Tooltip>

                        {/* 2. Edit Template */}
                        <Tooltip content={t('common.edit', 'Edit')}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditForm(item)}
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
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Edit2 size={14} />
                          </button>
                        </Tooltip>

                        {/* 3. Duplicate Template */}
                        <Tooltip content={t('common.duplicate', 'Duplicate')}>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(item)}
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
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Copy size={14} />
                          </button>
                        </Tooltip>

                        {/* 4. Delete Template (TENANT ADMIN ONLY) */}
                        {isTenantAdmin && (
                          <Tooltip content={t('common.delete', 'Delete')}>
                            <button
                              type="button"
                              onClick={() => setDeletingTemplate(item)}
                              className="btn-icon"
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid var(--badge-danger-border, #fecdd3)',
                                backgroundColor: 'var(--badge-danger-bg, #fff1f2)',
                                color: 'var(--badge-danger-text, #e11d48)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
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
        {filteredTemplates.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredTemplates.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        )}
      </div>

      {/* ─── VIEW TEMPLATE MODAL ─── */}
      {viewingTemplate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '20px',
          }}
          onClick={() => setViewingTemplate(null)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '16px',
              padding: '26px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '16px',
                borderBottom: '1px solid var(--border-color)',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--badge-primary-bg)',
                    color: 'var(--primary-600)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: 'var(--text-heading)',
                      margin: 0,
                    }}
                  >
                    {viewingTemplate.name}
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {t('labWhatsappTemplates.viewModal.title', 'Template Details')}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingTemplate(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Meta Info Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '12px',
                marginBottom: '20px',
                padding: '14px 16px',
                backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
              }}
            >
              {/* Status */}
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>
                  {t('labWhatsappTemplates.viewModal.status', 'Status')}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginTop: '4px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    backgroundColor:
                      viewingTemplate.status === 'ACTIVE'
                        ? 'var(--badge-success-bg, #dcfce7)'
                        : 'var(--bg-surface-muted, #f1f5f9)',
                    color:
                      viewingTemplate.status === 'ACTIVE'
                        ? 'var(--badge-success-text, #166534)'
                        : 'var(--text-muted)',
                  }}
                >
                  {viewingTemplate.status === 'ACTIVE' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                  <span>
                    {viewingTemplate.status === 'ACTIVE'
                      ? t('labWhatsappTemplates.active', 'Active')
                      : t('labWhatsappTemplates.inactive', 'Inactive')}
                  </span>
                </span>
              </div>

              {/* Branch */}
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>
                  {t('labWhatsappTemplates.branch', 'Branch')}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                  <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                  <span>{viewingTemplate.branch?.name || t('labWhatsappTemplates.allBranches', 'All Branches')}</span>
                </div>
              </div>

              {/* Last Updated */}
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>
                  {t('labWhatsappTemplates.lastUpdated', 'Last Updated')}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', fontSize: '12.5px', color: 'var(--text-main)' }}>
                  <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                  <span>{formatDate(viewingTemplate.updatedAt || viewingTemplate.createdAt)}</span>
                </div>
              </div>

              {/* Created By */}
              {viewingTemplate.createdBy && (
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>
                    {t('labWhatsappTemplates.viewModal.createdBy', 'Created By')}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', fontSize: '12.5px', color: 'var(--text-main)' }}>
                    <UserIcon size={13} style={{ color: 'var(--text-muted)' }} />
                    <span>{viewingTemplate.createdBy.name}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Message Body Section */}
            <div style={{ marginBottom: '22px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                  {t('labWhatsappTemplates.viewModal.messageContent', 'Message Content')}
                </label>
                <button
                  type="button"
                  onClick={() => handleCopyMessage(viewingTemplate.message)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    color: 'var(--primary-600)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  <Clipboard size={13} />
                  <span>{t('labWhatsappTemplates.viewModal.copyMessage', 'Copy Message')}</span>
                </button>
              </div>

              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  fontSize: '13.5px',
                  lineHeight: '1.6',
                  color: 'var(--text-heading)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {renderHighlightedMessage(viewingTemplate.message)}
              </div>
            </div>

            {/* WhatsApp Simulated Live Preview */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '8px' }}>
                {t('labWhatsappTemplates.viewModal.simulatedPreview', 'Simulated WhatsApp Preview')}
              </label>

              <div
                style={{
                  backgroundColor: '#e5ddd5',
                  backgroundImage:
                    'radial-gradient(#cfc6bc 1px, transparent 1px), radial-gradient(#cfc6bc 1px, #e5ddd5 1px)',
                  backgroundSize: '20px 20px',
                  borderRadius: '12px',
                  padding: '18px 20px',
                  border: '1px solid #d1d5db',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <div
                  style={{
                    backgroundColor: '#dcf8c6',
                    color: '#111827',
                    padding: '12px 16px',
                    borderRadius: '10px 10px 2px 10px',
                    maxWidth: '520px',
                    marginLeft: 'auto',
                    fontSize: '13.5px',
                    lineHeight: '1.5',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                    position: 'relative',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {getSimulatedPreviewText(viewingTemplate.message)}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '3px',
                      marginTop: '6px',
                      fontSize: '11px',
                      color: '#6b7280',
                    }}
                  >
                    <span>12:45 PM</span>
                    <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>✓✓</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Placeholders Detected */}
            <div style={{ marginBottom: '24px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
                {t('labWhatsappTemplates.viewModal.placeholdersDetected', 'Placeholders In Use')}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {ALL_SUPPORTED_PLACEHOLDERS.filter((p) =>
                  viewingTemplate.message.toLowerCase().includes(p.toLowerCase()),
                ).map((tag) => (
                  <span
                    key={tag}
                    style={{
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: '#2563eb',
                      padding: '3px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                    }}
                  >
                    {tag}
                  </span>
                ))}
                {ALL_SUPPORTED_PLACEHOLDERS.filter((p) =>
                  viewingTemplate.message.toLowerCase().includes(p.toLowerCase()),
                ).length === 0 && (
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {t('labWhatsappTemplates.viewModal.noneDetected', 'No placeholders detected')}
                  </span>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-color)',
              }}
            >
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setViewingTemplate(null)}
                style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13.5px' }}
              >
                {t('labWhatsappTemplates.viewModal.close', 'Close')}
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const target = viewingTemplate;
                  setViewingTemplate(null);
                  handleOpenEditForm(target);
                }}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Edit2 size={14} />
                <span>{t('labWhatsappTemplates.viewModal.edit', 'Edit Template')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRMATION MODAL (Tenant Admin Only) ─── */}
      {isTenantAdmin && deletingTemplate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
              borderRadius: '14px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              backgroundColor: 'var(--bg-card)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--badge-danger-bg, #fff1f2)',
                  color: 'var(--badge-danger-text, #e11d48)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>
                  {t('labWhatsappTemplates.deleteModal.title', 'Delete WhatsApp Template')}
                </h3>
              </div>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 24px' }}>
              {t('labWhatsappTemplates.deleteModal.message', {
                name: deletingTemplate.name,
                defaultValue: `Are you sure you want to delete template "${deletingTemplate.name}"? This action cannot be undone.`,
              })}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeletingTemplate(null)}
                disabled={deleting}
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13.5px' }}
              >
                {t('labWhatsappTemplates.deleteModal.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                style={{
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Trash2 size={15} />
                <span>
                  {deleting
                    ? t('labWhatsappTemplates.deleteModal.deleting', 'Deleting...')
                    : t('labWhatsappTemplates.deleteModal.confirm', 'Delete Template')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
