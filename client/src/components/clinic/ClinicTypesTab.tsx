import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useToast } from '../../core/context/ToastContext';
import { formatDate } from '../../core/utils/dateUtils';
import {
  Stethoscope,
  Eye,
  Activity,
  HeartPulse,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Check,
  X,
  ShieldCheck,
  AlertCircle,
  Building2,
  Sparkles,
  Lock,
  Sliders,
  Layers,
  Info,
} from 'lucide-react';

export interface ClinicType {
  id: string;
  name: string;
  code: string;
  description: string | null;
  icon: string | null;
  features: string[];
  isDefault: boolean;
  isActive: boolean;
  tenantCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureDefinition {
  key: string;
  name: string;
  i18nKey?: string;
  description: string;
}

export interface ConfigurableClinicMenu {
  key: string;
  name: string;
  i18nKey?: string;
  description: string;
}

export const CONFIGURABLE_CLINIC_MENUS: ConfigurableClinicMenu[] = [
  {
    key: 'finance',
    name: 'Finance',
    i18nKey: 'nav.finance',
    description: 'Financial accounts, payment methods, and cash flow ledger',
  },
  {
    key: 'reminders',
    name: 'Reminder',
    i18nKey: 'nav.reminder',
    description: 'Automated appointment reminders, recalls, and notifications',
  },
  {
    key: 'inventory',
    name: 'Inventory',
    i18nKey: 'nav.inventory',
    description: 'Supplies, consumables, stock levels, and low-stock alerts',
  },
  {
    key: 'expenses',
    name: 'Expense',
    i18nKey: 'nav.expenses',
    description: 'Operational practice expenses, vendor receipts, and category reports',
  },
  {
    key: 'clinic_users',
    name: 'Users',
    i18nKey: 'nav.clinicUsers',
    description: 'Management of Clinic Admins, Staff/Assistants, and Attending Doctors',
  },
  {
    key: 'patients',
    name: 'Patient',
    i18nKey: 'nav.patient',
    description: 'Patient demographics, medical history, clinical files, and emergency contacts',
  },
  {
    key: 'appointments',
    name: 'Appointment',
    i18nKey: 'nav.appointment',
    description: 'Doctor chair calendar, slot booking, statuses, and front-desk check-in',
  },
  {
    key: 'income',
    name: 'Income',
    i18nKey: 'nav.income',
    description: 'Procedure fees, consultation invoices, and collection receipts',
  },
];

const DEFAULT_CONFIGURABLE_MENU_KEYS = CONFIGURABLE_CLINIC_MENUS.map((f) => f.key);

function nameToCode(name: string): string {
  return name
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9\s_]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');
}

export const ClinicTypesTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();

  const [clinicTypes, setClinicTypes] = useState<ClinicType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [viewingType, setViewingType] = useState<ClinicType | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<ClinicType | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    icon: 'Stethoscope',
    features: [...DEFAULT_CONFIGURABLE_MENU_KEYS],
    isDefault: false,
    isActive: true,
  });
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete protection modal state
  const [deletingType, setDeletingType] = useState<ClinicType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchClinicTypes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/clinic-types?all=true');
      setClinicTypes(res.data || []);
    } catch (e: any) {
      console.error('Failed to load clinic types:', e);
      if (e?.response?.status === 404) {
        setClinicTypes([]);
      } else {
        toast.error(e?.response?.data?.message || 'Failed to load clinic types from server');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClinicTypes();
  }, []);

  const handleOpenCreate = () => {
    setEditingType(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      icon: 'Stethoscope',
      features: [...DEFAULT_CONFIGURABLE_MENU_KEYS],
      isDefault: false,
      isActive: true,
    });
    setCodeManuallyEdited(false);
    setShowModal(true);
  };

  const handleOpenEdit = (ct: ClinicType) => {
    setEditingType(ct);
    const existingFeatures = (ct.features || []).filter((f) =>
      CONFIGURABLE_CLINIC_MENUS.some((opt) => opt.key === f)
    );
    setFormData({
      name: ct.name,
      code: ct.code,
      description: ct.description || '',
      icon: ct.icon || 'Stethoscope',
      features: existingFeatures.length > 0 ? existingFeatures : [...DEFAULT_CONFIGURABLE_MENU_KEYS],
      isDefault: ct.isDefault,
      isActive: ct.isActive,
    });
    setCodeManuallyEdited(true);
    setShowModal(true);
  };

  const handleNameChange = (name: string) => {
    const next = { ...formData, name };
    if (!editingType && !codeManuallyEdited) {
      next.code = nameToCode(name);
    }
    setFormData(next);
  };

  const handleToggleFeature = (featureKey: string) => {
    setFormData((prev) => {
      const exists = prev.features.includes(featureKey);
      if (exists) {
        return { ...prev, features: prev.features.filter((f) => f !== featureKey) };
      } else {
        return { ...prev, features: [...prev.features, featureKey] };
      }
    });
  };

  const handleSelectAllFeatures = () => {
    setFormData((prev) => ({
      ...prev,
      features: [...DEFAULT_CONFIGURABLE_MENU_KEYS],
    }));
  };

  const handleDeselectAllFeatures = () => {
    setFormData((prev) => ({
      ...prev,
      features: [],
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.warning('Clinic type name is required');
      return;
    }

    try {
      setSaving(true);
      // Ensure dashboard is always present
      const featuresToSave = Array.from(new Set(['dashboard', ...formData.features]));

      if (editingType) {
        await api.patch(`/clinic-types/${editingType.id}`, {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          icon: formData.icon,
          features: featuresToSave,
          isDefault: formData.isDefault,
          isActive: formData.isActive,
        });
        toast.success(`Clinic type '${formData.name}' updated successfully`);
      } else {
        await api.post('/clinic-types', {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          description: formData.description.trim() || null,
          icon: formData.icon,
          features: featuresToSave,
          isDefault: formData.isDefault,
          isActive: formData.isActive,
        });
        toast.success(`Clinic type '${formData.name}' created successfully`);
      }

      setShowModal(false);
      await fetchClinicTypes();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Failed to save clinic type';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingType) return;

    // Safety checks on client
    if (deletingType.isDefault) {
      toast.error('Cannot delete the default clinic type');
      return;
    }
    if (deletingType.tenantCount && deletingType.tenantCount > 0) {
      toast.error(`Cannot delete clinic type because it is actively assigned to ${deletingType.tenantCount} organization(s).`);
      return;
    }

    try {
      setDeleting(true);
      await api.delete(`/clinic-types/${deletingType.id}`);
      toast.success(`Clinic type '${deletingType.name}' deleted successfully`);
      setDeletingType(null);
      await fetchClinicTypes();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete clinic type';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const filteredTypes = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return clinicTypes;
    return clinicTypes.filter(
      (ct) =>
        ct.name.toLowerCase().includes(q) ||
        ct.code.toLowerCase().includes(q) ||
        (ct.description && ct.description.toLowerCase().includes(q))
    );
  }, [clinicTypes, search]);

  const activeCount = clinicTypes.filter((c) => c.isActive).length;
  const totalTenantsUsing = clinicTypes.reduce((acc, c) => acc + (c.tenantCount || 0), 0);

  const renderIcon = (iconName: string | null, size = 20) => {
    switch (iconName) {
      case 'Eye':
        return <Eye size={size} />;
      case 'Activity':
        return <Activity size={size} />;
      case 'HeartPulse':
        return <HeartPulse size={size} />;
      case 'Stethoscope':
      default:
        return <Stethoscope size={size} />;
    }
  };

  return (
    <div>
      {/* Top Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
            {t('clinicTypes.title', 'Clinic Specialization Types')}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '3px 0 0 0' }}>
            {t(
              'clinicTypes.subtitle',
              'Define clinic specialization profiles (e.g. Dental Clinic) and configure which menus are available in the sidebar.'
            )}
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 16px', borderRadius: '10px' }}
        >
          <Plus size={16} />
          <span>{t('clinicTypes.createBtn', 'New Clinic Type')}</span>
        </button>
      </div>

      {/* Mini Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
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
            <Sliders size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {t('clinicTypes.totalTypes', 'Clinic Types')}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)' }}>
              {clinicTypes.length}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'var(--badge-success-bg)',
              color: 'var(--badge-success-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {t('clinicTypes.activeSpecializations', 'Active Profiles')}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)' }}>
              {activeCount}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'var(--badge-info-bg, rgba(14, 165, 233, 0.12))',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Building2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {t('clinicTypes.organizationsAssigned', 'Assigned Organizations')}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)' }}>
              {totalTenantsUsing}
            </div>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ position: 'relative', maxWidth: '380px' }}>
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
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('clinicTypes.searchPlaceholder', 'Search clinic types by name or code...')}
            style={{ paddingLeft: '36px', height: '40px', borderRadius: '10px' }}
          />
        </div>
      </div>

      {/* Clinic Types Cards Grid */}
      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading clinic specialization types...
        </div>
      ) : filteredTypes.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'var(--badge-primary-bg)',
              color: 'var(--primary-600)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
            }}
          >
            <Sliders size={24} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-heading)' }}>
            {t('clinicTypes.noTypesFound', 'No clinic types found')}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
            {search ? 'Try clearing your search query' : 'Create your first clinic specialization type to get started.'}
          </p>
          <button onClick={handleOpenCreate} className="btn btn-primary" style={{ borderRadius: '9px' }}>
            <Plus size={16} /> {t('clinicTypes.createFirst', 'Create Clinic Type')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '18px' }}>
          {filteredTypes.map((ct) => {
            const hasTenants = (ct.tenantCount || 0) > 0;
            const canDelete = !ct.isDefault && !hasTenants;

            return (
              <div
                key={ct.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '20px',
                  borderRadius: '12px',
                  position: 'relative',
                  border: ct.isDefault ? '2px solid var(--primary-500, #0d9488)' : '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '11px',
                        backgroundColor: ct.isDefault ? 'var(--badge-primary-bg)' : 'var(--bg-surface-hover)',
                        color: ct.isDefault ? 'var(--primary-600)' : 'var(--text-heading)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {renderIcon(ct.icon, 22)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-heading)' }}>
                          {ct.name}
                        </h3>
                        {ct.isDefault && (
                          <span
                            className="badge badge-primary"
                            style={{ fontSize: '10px', padding: '2px 6px', fontWeight: 700 }}
                          >
                            {t('clinicTypes.defaultBadge', 'Default')}
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          backgroundColor: 'var(--bg-surface-hover)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          marginTop: '3px',
                          display: 'inline-block',
                        }}
                      >
                        {ct.code}
                      </span>
                    </div>
                  </div>

                  {/* Status & Assigned Badge */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span className={ct.isActive ? 'badge badge-success' : 'badge badge-secondary'} style={{ fontSize: '11px' }}>
                      {ct.isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: hasTenants ? 'var(--primary-600)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title={`${ct.tenantCount || 0} organization(s) using this clinic type`}
                    >
                      <Building2 size={12} />
                      {ct.tenantCount || 0} org(s)
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                    margin: '0 0 14px 0',
                    lineHeight: '1.45',
                    minHeight: '38px',
                  }}
                >
                  {ct.description || t('clinicTypes.noDescription', 'No description provided.')}
                </p>

                {/* Feature Tags Preview */}
                <div style={{ marginTop: 'auto', marginBottom: '16px' }}>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{t('clinicTypes.activeFeatures', 'Enabled Menus')}</span>
                    <span style={{ color: 'var(--primary-600)' }}>
                      {(ct.features || []).filter((f) => CONFIGURABLE_CLINIC_MENUS.some((o) => o.key === f)).length} enabled
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxHeight: '72px', overflow: 'hidden' }}>
                    {(ct.features || [])
                      .filter((fKey) => CONFIGURABLE_CLINIC_MENUS.some((o) => o.key === fKey))
                      .map((fKey) => {
                        const def = CONFIGURABLE_CLINIC_MENUS.find((opt) => opt.key === fKey);
                        const label = def ? (def.i18nKey ? t(def.i18nKey, def.name) : def.name) : fKey;
                        return (
                          <span
                            key={fKey}
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'var(--bg-surface-hover)',
                              color: 'var(--text-heading)',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              border: '1px solid var(--border-color)',
                            }}
                          >
                            {label}
                          </span>
                        );
                      })}
                  </div>
                </div>

                {/* Actions Footer */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '12px',
                    gap: '8px',
                  }}
                >
                  <button
                    onClick={() => setViewingType(ct)}
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '7px' }}
                  >
                    {t('common.viewDetails', 'Details')}
                  </button>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleOpenEdit(ct)}
                      className="btn btn-secondary"
                      style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '7px' }}
                    >
                      <Edit2 size={13} /> {t('common.edit', 'Edit')}
                    </button>

                    {/* Safe Delete Button */}
                    <button
                      onClick={() => setDeletingType(ct)}
                      disabled={!canDelete}
                      className={canDelete ? 'btn btn-danger' : 'btn btn-secondary'}
                      style={{
                        fontSize: '12px',
                        padding: '6px 10px',
                        borderRadius: '7px',
                        opacity: canDelete ? 1 : 0.45,
                        cursor: canDelete ? 'pointer' : 'not-allowed',
                      }}
                      title={
                        ct.isDefault
                          ? 'Default clinic type cannot be deleted'
                          : hasTenants
                          ? `Cannot delete: Assigned to ${ct.tenantCount} organization(s)`
                          : 'Delete clinic type'
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ───────────────── Create / Edit Modal ───────────────── */}
      {showModal && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div
            className="modal-dialog"
            style={{
              maxWidth: '720px',
              width: '95%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-modal, #ffffff)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-xl, 0 25px 50px -12px rgba(0, 0, 0, 0.25))',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              className="modal-header"
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-modal, #ffffff)',
                flexShrink: 0,
              }}
            >
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-heading)' }}>
                  {editingType ? t('clinicTypes.modalEditTitle', 'Edit Clinic Type') : t('clinicTypes.modalCreateTitle', 'Create Clinic Type')}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  {t('clinicTypes.modalSubtitle', 'Configure clinic specialization profile and toggle available menus')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn-icon"
                style={{ borderRadius: '8px' }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div
                className="modal-body"
                style={{
                  padding: '22px 24px',
                  overflowY: 'auto',
                  flex: 1,
                  maxHeight: 'calc(90vh - 145px)',
                  backgroundColor: 'var(--bg-modal, #ffffff)',
                }}
              >
                {/* Basic Info Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label className="label">
                      {t('clinicTypes.formName', 'Clinic Type Name')} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="e.g. Dental Clinic"
                      required
                    />
                  </div>

                  <div>
                    <label className="label">
                      {t('clinicTypes.formCode', 'Code Identifier')} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={formData.code}
                      onChange={(e) => {
                        setCodeManuallyEdited(true);
                        setFormData({ ...formData, code: nameToCode(e.target.value) });
                      }}
                      placeholder="e.g. DENTAL"
                      disabled={Boolean(editingType)}
                      required
                      style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                    />
                  </div>
                </div>

                {/* Description */}
                <div style={{ marginBottom: '16px' }}>
                  <label className="label">{t('clinicTypes.formDesc', 'Description')}</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of clinical workflows, scope, and services..."
                    style={{ resize: 'vertical' }}
                  />
                </div>

                {/* Active Status Toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 18px',
                    backgroundColor: 'var(--bg-surface-hover, #f8fafc)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '20px',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--text-heading)',
                        margin: 0,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        style={{ accentColor: 'var(--primary-600, #0d9488)', cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                      <span>{t('clinicTypes.isActiveLabel', 'Active Status')}</span>
                    </label>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', marginLeft: '24px' }}>
                      Available for tenant provisioning
                    </span>
                  </div>

                  <span
                    className={formData.isActive ? 'badge badge-success' : 'badge badge-secondary'}
                    style={{ fontSize: '11px', padding: '3px 8px', fontWeight: 700 }}
                  >
                    {formData.isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
                  </span>
                </div>

                {/* FEATURE & MENU SELECTION MATRIX */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-heading)' }}>
                        {t('clinicTypes.featureMatrixTitle', 'Menu Configuration')}
                      </h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                        {t(
                          'clinicTypes.featureMatrixSubtitle',
                          'Select which Clinic module menus should appear in the sidebar for organizations using this clinic type.'
                        )}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: 'var(--primary-700, #0f766e)',
                          backgroundColor: 'var(--primary-50, rgba(13, 148, 136, 0.12))',
                          border: '1px solid var(--primary-200, rgba(13, 148, 136, 0.3))',
                          padding: '4px 10px',
                          borderRadius: '12px',
                        }}
                      >
                        {formData.features.length} / {CONFIGURABLE_CLINIC_MENUS.length} selected
                      </span>
                      <button
                        type="button"
                        onClick={formData.features.length === CONFIGURABLE_CLINIC_MENUS.length ? handleDeselectAllFeatures : handleSelectAllFeatures}
                        className="btn btn-secondary"
                        style={{ fontSize: '11px', padding: '4px 10px', height: '28px', borderRadius: '6px' }}
                      >
                        {formData.features.length === CONFIGURABLE_CLINIC_MENUS.length ? t('common.clearAll', 'Deselect All') : t('common.selectAll', 'Select All')}
                      </button>
                    </div>
                  </div>

                  {/* Informational banner about default menus */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-surface-hover, #f8fafc)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      marginBottom: '14px',
                    }}
                  >
                    <Info size={15} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                    <span>
                      <strong>Dashboard</strong> and <strong>Branch Management</strong> are standard base menus available by default to every tenant owner.
                    </span>
                  </div>

                  {/* Configurable Menus Grid (Matches Screenshot 3) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                    {CONFIGURABLE_CLINIC_MENUS.map((feat) => {
                      const isChecked = formData.features.includes(feat.key);

                      return (
                        <div
                          key={feat.key}
                          onClick={() => handleToggleFeature(feat.key)}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '14px',
                            padding: '16px 18px',
                            borderRadius: '12px',
                            border: isChecked ? '1.5px solid #0d9488' : '1px solid var(--border-color, #e2e8f0)',
                            backgroundColor: isChecked ? 'rgba(13, 148, 136, 0.04)' : 'var(--bg-surface, #ffffff)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            boxShadow: isChecked ? '0 1px 3px rgba(13, 148, 136, 0.08)' : 'none',
                          }}
                        >
                          {/* Styled Checkbox matching Screenshot 3 */}
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              backgroundColor: isChecked ? '#0d9488' : 'transparent',
                              border: isChecked ? 'none' : '2px solid #cbd5e1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginTop: '2px',
                              flexShrink: 0,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {isChecked && <Check size={13} color="#ffffff" strokeWidth={3} />}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading, #0f172a)' }}>
                              {feat.name}
                            </div>
                            <p style={{ fontSize: '12.5px', color: 'var(--text-muted, #64748b)', margin: '4px 0 0 0', lineHeight: '1.45' }}>
                              {feat.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                className="modal-footer"
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  backgroundColor: 'var(--bg-modal-footer, var(--bg-surface, #ffffff))',
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                  disabled={saving}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? t('common.saving', 'Saving...') : editingType ? t('common.saveChanges', 'Save Changes') : t('clinicTypes.createBtn', 'New Clinic Type')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────── Details Modal ───────────────── */}
      {viewingType && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div
            className="modal-dialog"
            style={{
              maxWidth: '580px',
              width: '95%',
              backgroundColor: 'var(--bg-modal, #ffffff)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--badge-primary-bg)',
                    color: 'var(--primary-600)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {renderIcon(viewingType.icon, 22)}
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-heading)' }}>
                    {viewingType.name}
                  </h3>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {viewingType.code}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingType(null)}
                className="btn-icon"
                style={{ borderRadius: '8px' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              {viewingType.description || 'No description provided.'}
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                padding: '12px 16px',
                backgroundColor: 'var(--bg-surface-hover)',
                borderRadius: '10px',
                marginBottom: '18px',
                fontSize: '13px',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'block' }}>Status:</span>
                <span style={{ fontWeight: 700, color: viewingType.isActive ? 'var(--emerald-500)' : 'var(--rose-500)' }}>
                  {viewingType.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'block' }}>Type Mode:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-heading)' }}>
                  {viewingType.isDefault ? 'Default Clinic Type' : 'Custom Specialization'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'block' }}>Organizations Using:</span>
                <span style={{ fontWeight: 700, color: 'var(--primary-600)' }}>
                  {viewingType.tenantCount || 0} organizations
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'block' }}>Created:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
                  {formatDate(viewingType.createdAt)}
                </span>
              </div>
            </div>

            <h4 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 10px 0', color: 'var(--text-heading)' }}>
              {t('clinicTypes.activeFeatures', 'Enabled Menus')} ({(viewingType.features || []).filter((f) => CONFIGURABLE_CLINIC_MENUS.some((o) => o.key === f)).length})
            </h4>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
              {(viewingType.features || [])
                .filter((fKey) => CONFIGURABLE_CLINIC_MENUS.some((o) => o.key === fKey))
                .map((fKey) => {
                  const def = CONFIGURABLE_CLINIC_MENUS.find((opt) => opt.key === fKey);
                  const label = def ? (def.i18nKey ? t(def.i18nKey, def.name) : def.name) : fKey;
                  return (
                    <span
                      key={fKey}
                      style={{
                        fontSize: '12px',
                        padding: '4px 10px',
                        borderRadius: '7px',
                        backgroundColor: 'var(--badge-primary-bg)',
                        color: 'var(--primary-600)',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <Check size={13} /> {label}
                    </span>
                  );
                })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setViewingType(null)}
                className="btn btn-secondary"
              >
                {t('common.close', 'Close')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const ct = viewingType;
                  setViewingType(null);
                  handleOpenEdit(ct);
                }}
                className="btn btn-primary"
              >
                <Edit2 size={14} /> {t('common.edit', 'Edit Profile')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────── Delete Safety Modal ───────────────── */}
      {deletingType && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div
            className="modal-dialog"
            style={{
              maxWidth: '480px',
              width: '95%',
              backgroundColor: 'var(--bg-modal, #ffffff)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
              padding: '24px',
            }}
          >
            {deletingType.isDefault ? (
              /* Blocked: Is Default */
              <div>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--badge-warning-bg)',
                    color: 'var(--badge-warning-text)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '14px',
                  }}
                >
                  <AlertCircle size={26} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-heading)' }}>
                  {t('clinicTypes.deleteBlockedTitle', 'Cannot Delete Default Clinic Type')}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 20px 0' }}>
                  <strong>{deletingType.name}</strong> is currently designated as the default clinic type for newly created organizations. Please designate another clinic type as default before attempting to delete this one.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setDeletingType(null)} className="btn btn-secondary">
                    {t('common.ok', 'OK')}
                  </button>
                </div>
              </div>
            ) : (deletingType.tenantCount || 0) > 0 ? (
              /* Blocked: Assigned to Tenants */
              <div>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--badge-danger-bg, #fee2e2)',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '14px',
                  }}
                >
                  <ShieldCheck size={26} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-heading)' }}>
                  {t('clinicTypes.deleteBlockedTenantTitle', 'Deletion Blocked: Active Organizations')}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                  Cannot delete clinic type <strong>{deletingType.name}</strong> because it is actively assigned to{' '}
                  <strong style={{ color: 'var(--rose-600)' }}>{deletingType.tenantCount} organization(s)</strong>.
                </p>
                <div
                  style={{
                    padding: '12px 14px',
                    backgroundColor: 'var(--bg-surface-hover)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    marginBottom: '20px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <Info size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  To delete this clinic type, you must first reassign all associated organizations to a different clinic type in the <strong>Tenants</strong> management area.
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setDeletingType(null)} className="btn btn-secondary">
                    {t('common.close', 'Close')}
                  </button>
                </div>
              </div>
            ) : (
              /* Permitted: Confirmation */
              <div>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--badge-danger-bg, #fee2e2)',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '14px',
                  }}
                >
                  <Trash2 size={24} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--rose-600)' }}>
                  {t('clinicTypes.deleteConfirmTitle', 'Delete Clinic Type')}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 20px 0' }}>
                  Are you sure you want to permanently delete the clinic specialization profile{' '}
                  <strong>{deletingType.name}</strong> ({deletingType.code})? This action cannot be undone.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    onClick={() => setDeletingType(null)}
                    className="btn btn-secondary"
                    disabled={deleting}
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    onClick={handleDelete}
                    className="btn btn-danger"
                    disabled={deleting}
                  >
                    {deleting ? t('common.deleting', 'Deleting...') : t('common.delete', 'Yes, Delete')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
