import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { useToast } from '../core/context/ToastContext';
import { Pagination } from '../components/common/Pagination';
import { formatDate, formatCurrency, getTodayDateString, toInputDateString } from '../core/utils/dateUtils';
import { SearchableSelect } from '../components/common/SearchableSelect';
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Copy,
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
  Save,
  X,
  CreditCard,
  Sliders,
  Check,
  Building,
  Users,
  User,
  Globe,
  ShieldCheck,
  HardDrive,
  MapPin,
  AlertTriangle,
  Info,
  Loader2,
} from 'lucide-react';

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export const TenantsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [systemModules, setSystemModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Edit Tenant Modal State
  const [editingTenant, setEditingTenant] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [editPlanId, setEditPlanId] = useState('');
  const [editPrice, setEditPrice] = useState<number | string>('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editSelectedModules, setEditSelectedModules] = useState<string[]>([]);
  const [editOverrideLimits, setEditOverrideLimits] = useState(false);
  const [editMaxModules, setEditMaxModules] = useState<number | string>('');
  const [editMaxBranches, setEditMaxBranches] = useState<number | string>('');
  const [editMaxMembers, setEditMaxMembers] = useState<number | string>('');
  const [editMaxUploadFileSizeMb, setEditMaxUploadFileSizeMb] = useState<number | string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete State
  const [deletingTenant, setDeletingTenant] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Create Tenant Modal State
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    planId: '',
    price: '' as number | string,
    startDate: getTodayDateString(),
    endDate: '',
    modules: [] as string[],
    adminEmail: '',
    adminName: '',
    overrideLimits: false,
    maxModules: '' as number | string,
    maxBranches: '' as number | string,
    maxMembers: '' as number | string,
    maxUploadFileSizeMb: '' as number | string,
  });

  const fetchTenantsAndPlans = async () => {
    try {
      setLoading(true);
      const [tenantsRes, plansRes, modulesRes] = await Promise.allSettled([
        api.get('/tenants'),
        api.get('/plans'),
        api.get('/modules?all=true'),
      ]);

      if (tenantsRes.status === 'fulfilled') {
        setTenants(tenantsRes.value.data || []);
      }
      if (plansRes.status === 'fulfilled') {
        setPlans(plansRes.value.data || []);
      }
      if (modulesRes.status === 'fulfilled') {
        setSystemModules(modulesRes.value.data || []);
      }
    } catch (e) {
      console.error('Failed to load tenants data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantsAndPlans();
  }, []);

  const handlePlanChange = (planId: string) => {
    const selectedPlan = plans.find((p) => p.id === planId);
    const maxAllowed = getEffectiveModuleLimit(planId, formData.overrideLimits, formData.maxModules);

    let defaultMods: string[] = [];
    if (selectedPlan && selectedPlan.modules && selectedPlan.modules.length > 0) {
      defaultMods = selectedPlan.modules.slice(0, maxAllowed);
    } else if (systemModules.length > 0) {
      defaultMods = systemModules.slice(0, maxAllowed).map((m) => m.code);
    }

    setFormData({
      ...formData,
      planId,
      price: selectedPlan?.price !== undefined && selectedPlan?.price !== null ? selectedPlan.price : formData.price,
      modules: defaultMods,
    });
  };

  const handleNameChange = (name: string) => {
    const newForm = { ...formData, name };
    if (!slugManuallyEdited) {
      newForm.slug = nameToSlug(name);
    }
    setFormData(newForm);
  };

  const handleSlugChange = (slug: string) => {
    setSlugManuallyEdited(true);
    setFormData({
      ...formData,
      slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, ''),
    });
  };

  const getEffectiveModuleLimit = (planId: string, overrideLimits: boolean, maxModules: number | string) => {
    if (overrideLimits && maxModules !== '' && maxModules !== null && maxModules !== undefined) {
      return Number(maxModules);
    }
    const plan = plans.find((p) => p.id === planId);
    return plan?.moduleCount || 1;
  };

  const handleToggleModuleSelection = (moduleCode: string) => {
    const maxAllowed = getEffectiveModuleLimit(formData.planId, formData.overrideLimits, formData.maxModules);
    const isChecked = formData.modules.includes(moduleCode);

    if (isChecked) {
      setFormData({
        ...formData,
        modules: formData.modules.filter((m) => m !== moduleCode),
      });
    } else {
      if (formData.modules.length >= maxAllowed) {
        toast.warning(t('tenants.alerts.planLimitAlert', { max: maxAllowed }), 'Plan Limit Reached');
        return;
      }
      setFormData({
        ...formData,
        modules: [...formData.modules, moduleCode],
      });
    }
  };

  const handleEditPlanChange = (planId: string) => {
    const selectedPlan = plans.find((p) => p.id === planId);
    const maxAllowed = getEffectiveModuleLimit(planId, editOverrideLimits, editMaxModules);
    setEditPlanId(planId);
    if (selectedPlan && (editPrice === '' || editPrice === null || editPrice === undefined)) {
      setEditPrice(selectedPlan.price !== undefined ? selectedPlan.price : '');
    }
    setEditSelectedModules((prev) => prev.slice(0, maxAllowed));
  };

  const handleToggleEditModuleSelection = (moduleCode: string) => {
    const maxAllowed = getEffectiveModuleLimit(editPlanId, editOverrideLimits, editMaxModules);
    const isChecked = editSelectedModules.includes(moduleCode);

    if (isChecked) {
      setEditSelectedModules((prev) => prev.filter((m) => m !== moduleCode));
    } else {
      if (editSelectedModules.length >= maxAllowed) {
        toast.warning(t('tenants.alerts.planLimitAlert', { max: maxAllowed }), 'Plan Limit Reached');
        return;
      }
      setEditSelectedModules((prev) => [...prev, moduleCode]);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingTenant) return;

    if (formData.planId && formData.modules.length === 0) {
      toast.warning(t('tenants.alerts.selectAtLeastOne'), 'Validation Error');
      return;
    }

    if (!formData.adminEmail?.trim() || !formData.adminName?.trim()) {
      toast.warning(t('tenants.alerts.adminDetailsRequired'), 'Validation Error');
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      toast.warning(t('tenants.alerts.datesRequired'), 'Validation Error');
      return;
    }

    if (formData.endDate < formData.startDate) {
      toast.warning(t('tenants.alerts.invalidDateRange'), 'Validation Error');
      return;
    }

    try {
      setCreatingTenant(true);
      await api.post('/tenants', {
        name: formData.name,
        slug: formData.slug,
        planId: formData.planId || undefined,
        price: formData.price !== '' ? Number(formData.price) : null,
        startDate: formData.startDate,
        endDate: formData.endDate,
        modules: formData.modules,
        adminEmail: formData.adminEmail.trim(),
        adminName: formData.adminName.trim(),
        maxModules: formData.overrideLimits && formData.maxModules !== '' ? Number(formData.maxModules) : null,
        maxBranches: formData.overrideLimits && formData.maxBranches !== '' ? Number(formData.maxBranches) : null,
        maxMembers: formData.overrideLimits && formData.maxMembers !== '' ? Number(formData.maxMembers) : null,
        maxUploadFileSizeMb: formData.overrideLimits && formData.maxUploadFileSizeMb !== '' ? Number(formData.maxUploadFileSizeMb) : null,
        locale: i18n.language,
      });
      toast.success(`Organization "${formData.name}" created successfully!`, 'Organization Created');
      setShowModal(false);
      setFormData({
        name: '',
        slug: '',
        planId: '',
        price: '',
        startDate: getTodayDateString(),
        endDate: '',
        modules: [],
        adminEmail: '',
        adminName: '',
        overrideLimits: false,
        maxModules: '',
        maxBranches: '',
        maxMembers: '',
        maxUploadFileSizeMb: '',
      });
      setSlugManuallyEdited(false);
      await fetchTenantsAndPlans();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || t('tenants.alerts.createFailed');
      toast.error(msg, 'Creation Failed');
    } finally {
      setCreatingTenant(false);
    }
  };

  const handleToggleModule = async (tenantId: string, moduleKey: string, currentStatus: boolean) => {
    try {
      await api.post('/modules/toggle', {
        tenantId,
        moduleKey,
        isEnabled: !currentStatus,
      });
      toast.success('Module access updated', 'Success');
      fetchTenantsAndPlans();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || t('tenants.alerts.toggleFailed');
      toast.error(msg, 'Toggle Failed');
    }
  };

  const handleOpenEditModal = (tenant: any) => {
    setEditingTenant(tenant);
    setEditName(tenant.name || '');
    setEditStatus(tenant.status || 'ACTIVE');
    setEditPlanId(tenant.planId || '');
    setEditPrice(tenant.price !== null && tenant.price !== undefined ? tenant.price : (tenant.plan?.price !== undefined ? tenant.plan.price : ''));
    setEditStartDate(toInputDateString(tenant.startDate));
    setEditEndDate(toInputDateString(tenant.endDate));
    const enabledMods = (tenant.modules || [])
      .filter((m: any) => m.isEnabled)
      .map((m: any) => m.moduleKey);
    setEditSelectedModules(enabledMods);

    const hasOverrides =
      tenant.maxModules !== null && tenant.maxModules !== undefined ||
      tenant.maxBranches !== null && tenant.maxBranches !== undefined ||
      tenant.maxMembers !== null && tenant.maxMembers !== undefined ||
      tenant.maxUploadFileSizeMb !== null && tenant.maxUploadFileSizeMb !== undefined;

    setEditOverrideLimits(hasOverrides);
    setEditMaxModules(tenant.maxModules !== null && tenant.maxModules !== undefined ? tenant.maxModules : '');
    setEditMaxBranches(tenant.maxBranches !== null && tenant.maxBranches !== undefined ? tenant.maxBranches : '');
    setEditMaxMembers(tenant.maxMembers !== null && tenant.maxMembers !== undefined ? tenant.maxMembers : '');
    setEditMaxUploadFileSizeMb(tenant.maxUploadFileSizeMb !== null && tenant.maxUploadFileSizeMb !== undefined ? tenant.maxUploadFileSizeMb : '');
  };

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;

    if (editPlanId && editSelectedModules.length === 0) {
      toast.warning(t('tenants.alerts.selectAtLeastOne'), 'Validation Error');
      return;
    }

    if (editStartDate && editEndDate && editEndDate < editStartDate) {
      toast.warning(t('tenants.alerts.invalidDateRange'), 'Validation Error');
      return;
    }

    try {
      setSavingEdit(true);
      await api.patch(`/tenants/${editingTenant.id}`, {
        name: editName,
        status: editStatus,
        planId: editPlanId || null,
        price: editPrice !== '' ? Number(editPrice) : null,
        startDate: editStartDate || undefined,
        endDate: editEndDate || undefined,
        modules: editSelectedModules,
        maxModules: editOverrideLimits && editMaxModules !== '' ? Number(editMaxModules) : null,
        maxBranches: editOverrideLimits && editMaxBranches !== '' ? Number(editMaxBranches) : null,
        maxMembers: editOverrideLimits && editMaxMembers !== '' ? Number(editMaxMembers) : null,
        maxUploadFileSizeMb: editOverrideLimits && editMaxUploadFileSizeMb !== '' ? Number(editMaxUploadFileSizeMb) : null,
      });
      toast.success(`Organization "${editName}" updated successfully`, 'Organization Updated');
      setEditingTenant(null);
      fetchTenantsAndPlans();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || t('tenants.alerts.updateFailed');
      toast.error(msg, 'Update Failed');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteTenant = async () => {
    if (!deletingTenant) return;

    try {
      setDeleting(true);
      await api.delete(`/tenants/${deletingTenant.id}`);
      toast.success(`Organization "${deletingTenant.name}" deleted successfully`, 'Organization Deleted');
      setDeletingTenant(null);
      fetchTenantsAndPlans();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || t('tenants.alerts.deleteFailed');
      toast.error(msg, 'Delete Failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyUrl = (slug: string) => {
    const { protocol, host } = window.location;
    const url = `${protocol}//${slug}.${host}/login`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    toast.info(`Organization URL copied to clipboard: ${url}`, 'URL Copied');
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  const getPreviewUrl = (slug: string) => {
    const { protocol, host } = window.location;
    return `${protocol}//${slug || '<slug>'}.${host}`;
  };

  const getModuleName = (code: string) => {
    const found = systemModules.find((m) => m.code === code);
    return found ? found.name : code;
  };

  const selectedPlan = plans.find((p) => p.id === formData.planId);
  const selectedEditPlan = plans.find((p) => p.id === editPlanId);

  const getEffectiveLimits = (tenant: any) => {
    const plan = tenant.plan;
    const maxModules = tenant.maxModules !== null && tenant.maxModules !== undefined ? tenant.maxModules : (plan?.moduleCount || 1);
    const maxBranches = tenant.maxBranches !== null && tenant.maxBranches !== undefined ? tenant.maxBranches : (plan?.branchCount || 3);
    const maxMembers = tenant.maxMembers !== null && tenant.maxMembers !== undefined ? tenant.maxMembers : (plan?.memberCount || 10);
    const maxUploadFileSizeMb = tenant.maxUploadFileSizeMb !== null && tenant.maxUploadFileSizeMb !== undefined ? tenant.maxUploadFileSizeMb : (plan?.maxUploadFileSizeMb || 25);
    const hasOverride =
      tenant.maxModules !== null && tenant.maxModules !== undefined ||
      tenant.maxBranches !== null && tenant.maxBranches !== undefined ||
      tenant.maxMembers !== null && tenant.maxMembers !== undefined ||
      tenant.maxUploadFileSizeMb !== null && tenant.maxUploadFileSizeMb !== undefined;

    return { maxModules, maxBranches, maxMembers, maxUploadFileSizeMb, hasOverride };
  };

  // Paginated tenants
  const totalPages = Math.max(1, Math.ceil(tenants.length / pageSize));
  const paginatedTenants = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return tenants.slice(start, start + pageSize);
  }, [tenants, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--badge-primary-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-600)',
              }}
            >
              <Building2 size={18} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {t('tenants.title')}
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '4px 0 0 0' }}>
            {t('tenants.subtitle')}
          </p>
        </div>
        <button
          onClick={() => {
            const initialPlan = plans.find((p) => p.isActive) || plans[0];
            setFormData({
              name: '',
              slug: '',
              planId: initialPlan ? initialPlan.id : '',
              price: initialPlan?.price !== undefined && initialPlan?.price !== null ? initialPlan.price : '',
              startDate: getTodayDateString(),
              endDate: '',
              modules: [],
              adminEmail: '',
              adminName: '',
              overrideLimits: false,
              maxModules: '',
              maxBranches: '',
              maxMembers: '',
              maxUploadFileSizeMb: '',
            });
            setShowModal(true);
          }}
          className="btn btn-primary"
        >
          <Plus size={16} /> {t('tenants.createBtn')}
        </button>
      </div>

      {/* Search & Counter Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
          <Search
            size={18}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }}
          />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '38px', borderRadius: '10px' }}
            placeholder={t('tenants.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
          {t('tenants.totalOrganizations')}: <strong>{tenants.length}</strong>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '16px' }}>
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', tableLayout: 'auto' }}>
          <thead>
            <tr>
              <th>{t('tenants.name')}</th>
              <th>{t('tenants.subdomainUrl')}</th>
              <th>{t('tenants.subscriptionPlan')}</th>
              <th>{t('tenants.modules')}</th>
              <th>{t('tenants.branchesCount')}</th>
              <th>{t('tenants.membersCount')}</th>
              <th>{t('tenants.status')}</th>
              <th style={{ textAlign: 'right' }}>{t('tenants.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--primary-600)' }}>
                  {t('common.loading')}
                </td>
              </tr>
            ) : paginatedTenants.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  {t('tenants.noTenants')}
                </td>
              </tr>
            ) : (
              paginatedTenants.map((tItem) => {
                const plan = tItem.plan;
                const limits = getEffectiveLimits(tItem);
                const branchCount = tItem._count?.branches || tItem.branches?.length || 0;
                const memberCount = tItem._count?.memberships || 0;

                return (
                  <tr key={tItem.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{tItem.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                        {formatDate(tItem.createdAt, { locale: i18n.language })}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            backgroundColor: 'var(--bg-surface-hover)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: 'var(--primary-600)',
                            fontWeight: 700,
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {tItem.slug}
                        </span>
                        <button
                          onClick={() => handleCopyUrl(tItem.slug)}
                          className="btn-icon"
                          title={t('tenants.copyUrlTooltip')}
                          style={{ padding: '3px 6px', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          {copiedSlug === tItem.slug ? (
                            <Check size={12} style={{ color: 'var(--emerald-500)' }} />
                          ) : (
                            <Copy size={12} style={{ color: 'var(--text-muted)' }} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td>
                      {plan ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                backgroundColor: 'var(--badge-primary-bg)',
                                color: 'var(--badge-primary-text)',
                                fontSize: '12px',
                                fontWeight: 700,
                              }}
                            >
                              {plan.name}
                            </span>
                            {limits.hasOverride && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  backgroundColor: 'var(--bg-surface-hover)',
                                  color: 'var(--primary-600)',
                                  border: '1px solid var(--primary-600)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                }}
                                title="Tenant has customized limit overrides"
                              >
                                {t('tenants.customOverride')}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-heading)' }}>
                            {formatCurrency(tItem.price ?? plan.price, undefined, i18n.language)}
                          </div>
                          {(tItem.startDate || tItem.endDate) && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>{formatDate(tItem.startDate, { locale: i18n.language })}</span>
                              <span>→</span>
                              <span>{formatDate(tItem.endDate, { locale: i18n.language })}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOpenEditModal(tItem)}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                        >
                          {t('tenants.assignPlan')}
                        </button>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {tItem.modules && tItem.modules.length > 0 ? (
                          tItem.modules.map((tm: any) => (
                            <button
                              key={tm.id || tm.moduleKey}
                              onClick={() => handleToggleModule(tItem.id, tm.moduleKey, tm.isEnabled)}
                              className={`badge ${tm.isEnabled ? 'badge-success' : 'badge-danger'}`}
                              style={{ cursor: 'pointer', border: 'none' }}
                              title={`Click to toggle ${getModuleName(tm.moduleKey)}`}
                            >
                              {getModuleName(tm.moduleKey)}: {tm.isEnabled ? 'ON' : 'OFF'}
                            </button>
                          ))
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            {t('tenants.noActiveModules')}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '4px' }}>
                        {tItem.modules?.filter((m: any) => m.isEnabled).length || 0} / {limits.maxModules} max
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: branchCount >= limits.maxBranches ? '#dc2626' : 'var(--text-main)' }}>
                        {branchCount} / {limits.maxBranches}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                        {limits.maxBranches - branchCount > 0 ? `${limits.maxBranches - branchCount} remaining` : 'Limit reached'}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: memberCount >= limits.maxMembers ? '#dc2626' : 'var(--text-main)' }}>
                        {memberCount} / {limits.maxMembers}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                        {limits.maxMembers - memberCount > 0 ? `${limits.maxMembers - memberCount} remaining` : 'Limit reached'}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${tItem.status === 'ACTIVE' ? 'badge-success' : tItem.status === 'PENDING' ? 'badge-warning' : 'badge-danger'}`}>
                        {tItem.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        {/* Open Portal */}
                        <button
                          onClick={() => {
                            const { protocol, port } = window.location;
                            const portSuffix = port && port !== '80' && port !== '443' ? `:${port}` : '';
                            window.open(`${protocol}//${tItem.slug}.localhost${portSuffix}/login`, '_blank');
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          title={t('tenants.openPortal')}
                        >
                          <ExternalLink size={12} />
                          <span>{t('tenants.openPortal')}</span>
                        </button>

                        {/* Edit Organization */}
                        <button
                          onClick={() => handleOpenEditModal(tItem)}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          title={t('tenants.editBtn')}
                        >
                          <Edit2 size={12} color="#0f766e" />
                          <span>{t('common.edit')}</span>
                        </button>

                        {/* Delete Organization */}
                        <button
                          onClick={() => setDeletingTenant(tItem)}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', color: '#dc2626', borderColor: '#fecaca' }}
                          title={t('tenants.deleteBtn')}
                        >
                          <Trash2 size={12} color="#dc2626" />
                          <span>{t('common.delete')}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={tenants.length}
          pageSize={pageSize}
          pageSizeOptions={[5, 10, 20, 50]}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Provision Tenant Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '620px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={20} style={{ color: 'var(--primary-600)' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-heading)' }}>
                  {t('tenants.modalTitle')}
                </h3>
              </div>
              <button
                type="button"
                disabled={creatingTenant}
                onClick={() => {
                  if (!creatingTenant) {
                    setShowModal(false);
                    setSlugManuallyEdited(false);
                  }
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: creatingTenant ? 'not-allowed' : 'pointer',
                  color: 'var(--text-muted)',
                  opacity: creatingTenant ? 0.5 : 1,
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTenant}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="label">
                    {t('tenants.name')} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    required
                    placeholder="e.g. Precision Dental & Milling"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">
                    {t('tenants.slug')} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    required
                    placeholder="e.g. precision-dental"
                    value={formData.slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    style={{ fontFamily: 'monospace', fontWeight: 700 }}
                  />
                  {formData.slug && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--primary-600)',
                        marginTop: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: 'var(--badge-primary-bg)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <Globe size={14} />
                      <span>
                        {t('tenants.accessUrl')}: <strong style={{ fontFamily: 'monospace' }}>{getPreviewUrl(formData.slug)}</strong>
                      </span>
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {t('tenants.slugHelp')}
                  </div>
                </div>

                {/* Subscription Plan Selection Dropdown */}
                <div>
                  <label className="label">
                    {t('tenants.subscriptionPlan')} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <SearchableSelect
                    options={plans
                      .filter((p) => p.isActive)
                      .map((p) => ({
                        value: p.id,
                        label: `${p.name} (${p.code})`,
                        sublabel: `${p.moduleCount || 1} Mod, ${p.branchCount || 3} Br, ${p.memberCount || 10} Mem · ${formatCurrency(p.price, undefined, i18n.language)}`,
                        badge: formatCurrency(p.price, undefined, i18n.language),
                      }))}
                    value={formData.planId}
                    onChange={(val) => handlePlanChange(val)}
                    placeholder={t('tenants.selectPlan')}
                  />
                </div>

                {/* Plan Limits & Capacity Display Box */}
                {selectedPlan && (
                  <div
                    style={{
                      padding: '12px 16px',
                      backgroundColor: 'var(--bg-surface-hover)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Layers size={14} style={{ color: 'var(--primary-600)' }} />
                      <span>{t('tenants.planLimitsSummary')} ({selectedPlan.name})</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                        <CreditCard size={13} style={{ color: 'var(--primary-600)' }} />
                        <span><strong>{t('plans.price')}:</strong> {formatCurrency(selectedPlan.price, undefined, i18n.language)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                        <Layers size={13} style={{ color: 'var(--primary-600)' }} />
                        <span><strong>{t('tenants.moduleLimit')}:</strong> {selectedPlan.moduleCount || 1}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                        <MapPin size={13} style={{ color: 'var(--primary-600)' }} />
                        <span><strong>{t('tenants.branchLimit')}:</strong> {selectedPlan.branchCount || 3}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                        <Users size={13} style={{ color: 'var(--primary-600)' }} />
                        <span><strong>{t('tenants.memberLimit')}:</strong> {selectedPlan.memberCount || 10}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                        <HardDrive size={13} style={{ color: 'var(--primary-600)' }} />
                        <span><strong>{t('tenants.uploadLimit')}:</strong> {selectedPlan.maxUploadFileSizeMb || 25} MB</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Subscription Price Field */}
                <div>
                  <label className="label">
                    {t('tenants.subscriptionPrice')}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        fontWeight: 700,
                        fontSize: '14px',
                      }}
                    >
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      className="input"
                      style={{ paddingLeft: '28px', fontWeight: 700 }}
                      placeholder={selectedPlan ? String(selectedPlan.price || 0) : '0.00'}
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          price: e.target.value === '' ? '' : parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                    {t('tenants.subscriptionPriceHelp')}
                  </div>
                </div>

                {/* Subscription Dates: Start Date & End Date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="label">
                      {t('tenants.startDate')} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="date"
                      required
                      className="input"
                      style={{ fontWeight: 600 }}
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {t('tenants.startDateHelp')}
                    </div>
                  </div>
                  <div>
                    <label className="label">
                      {t('tenants.endDate')} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="date"
                      required
                      min={formData.startDate}
                      className="input"
                      style={{ fontWeight: 600 }}
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {t('tenants.endDateHelp')}
                    </div>
                  </div>
                </div>

                {/* Organization Limit Overrides Accordion/Section */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    backgroundColor: formData.overrideLimits ? 'var(--badge-primary-bg)' : 'var(--bg-surface-hover)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', margin: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sliders size={16} style={{ color: 'var(--primary-600)' }} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                          {t('tenants.limitOverridesTitle')}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {t('tenants.limitOverridesDesc')}
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.overrideLimits}
                      onChange={(e) => setFormData({ ...formData, overrideLimits: e.target.checked })}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary-600)' }}
                    />
                  </label>

                  {formData.overrideLimits && (
                    <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label className="label" style={{ fontSize: '11px', marginBottom: '3px' }}>
                          {t('tenants.overrideModuleCount')}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          className="input"
                          placeholder={selectedPlan ? String(selectedPlan.moduleCount || 1) : '1'}
                          value={formData.maxModules}
                          onChange={(e) => setFormData({ ...formData, maxModules: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: '11px', marginBottom: '3px' }}>
                          {t('tenants.overrideBranchCount')}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          className="input"
                          placeholder={selectedPlan ? String(selectedPlan.branchCount || 3) : '3'}
                          value={formData.maxBranches}
                          onChange={(e) => setFormData({ ...formData, maxBranches: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: '11px', marginBottom: '3px' }}>
                          {t('tenants.overrideMemberCount')}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          className="input"
                          placeholder={selectedPlan ? String(selectedPlan.memberCount || 10) : '10'}
                          value={formData.maxMembers}
                          onChange={(e) => setFormData({ ...formData, maxMembers: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: '11px', marginBottom: '3px' }}>
                          {t('tenants.overrideUploadSize')}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          className="input"
                          placeholder={selectedPlan ? String(selectedPlan.maxUploadFileSizeMb || 25) : '25'}
                          value={formData.maxUploadFileSizeMb}
                          onChange={(e) => setFormData({ ...formData, maxUploadFileSizeMb: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Dynamic Module Selection */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                      <Layers size={14} color="#0f766e" /> {t('tenants.selectModulesTitle')} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    {selectedPlan && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor:
                            formData.modules.length === getEffectiveModuleLimit(formData.planId, formData.overrideLimits, formData.maxModules)
                              ? '#dcfce7'
                              : formData.modules.length > getEffectiveModuleLimit(formData.planId, formData.overrideLimits, formData.maxModules)
                              ? '#fee2e2'
                              : '#f1f5f9',
                          color:
                            formData.modules.length === getEffectiveModuleLimit(formData.planId, formData.overrideLimits, formData.maxModules)
                              ? '#166534'
                              : formData.modules.length > getEffectiveModuleLimit(formData.planId, formData.overrideLimits, formData.maxModules)
                              ? '#991b1b'
                              : '#475569',
                        }}
                      >
                        {t('tenants.selectedModulesCount', { count: formData.modules.length, max: getEffectiveModuleLimit(formData.planId, formData.overrideLimits, formData.maxModules) })}
                      </span>
                    )}
                  </div>

                  {!formData.planId ? (
                    <div
                      style={{
                        padding: '16px',
                        backgroundColor: 'var(--bg-surface-hover)',
                        borderRadius: '10px',
                        border: '1px dashed var(--border-color)',
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                      }}
                    >
                      {t('tenants.selectPlanFirst')}
                    </div>
                  ) : systemModules.filter((m) => m.isEnabled).length === 0 ? (
                    <div
                      style={{
                        padding: '14px',
                        backgroundColor: 'var(--badge-warning-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        fontSize: '13px',
                        color: 'var(--badge-warning-text)',
                      }}
                    >
                      {t('tenants.noActiveModules')}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {systemModules
                        .filter((mod) => mod.isEnabled)
                        .map((mod) => {
                        const isChecked = formData.modules.includes(mod.code);
                        const maxAllowed = getEffectiveModuleLimit(formData.planId, formData.overrideLimits, formData.maxModules);
                        const isLimitReached = !isChecked && formData.modules.length >= maxAllowed;

                        return (
                          <div
                            key={mod.id}
                            onClick={() => !isLimitReached && handleToggleModuleSelection(mod.code)}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px',
                              padding: '12px 14px',
                              borderRadius: '10px',
                              border: isChecked
                                ? '1.5px solid var(--primary-600)'
                                : isLimitReached
                                ? '1px solid var(--border-subtle)'
                                : '1px solid var(--border-color)',
                              backgroundColor: isChecked
                                ? 'var(--badge-primary-bg)'
                                : isLimitReached
                                ? 'var(--bg-surface-hover)'
                                : 'var(--bg-surface)',
                              cursor: isLimitReached ? 'not-allowed' : 'pointer',
                              opacity: isLimitReached ? 0.6 : 1,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isLimitReached}
                              onChange={() => {}}
                              style={{
                                width: '18px',
                                height: '18px',
                                marginTop: '2px',
                                cursor: isLimitReached ? 'not-allowed' : 'pointer',
                                accentColor: 'var(--primary-600)',
                              }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                                    {mod.name}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      fontFamily: 'monospace',
                                      color: 'var(--text-muted)',
                                      backgroundColor: 'var(--bg-surface-hover)',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                    }}
                                  >
                                    {mod.code}
                                  </span>
                                </div>
                                {isLimitReached && (
                                  <span style={{ fontSize: '11px', color: 'var(--text-subtle)', fontWeight: 600 }}>
                                    {t('tenants.limitReached')}
                                  </span>
                                )}
                              </div>
                              {mod.description && (
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {mod.description}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Initial Tenant Admin */}
                <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface-hover)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={15} style={{ color: 'var(--primary-600)' }} /> {t('tenants.initialAdminTitle')} <span style={{ color: '#ef4444' }}>*</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="label" style={{ fontSize: '12px', marginBottom: '4px' }}>
                        {t('tenants.adminName')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="input"
                        required
                        placeholder={t('tenants.adminNamePlaceholder')}
                        value={formData.adminName}
                        onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: '12px', marginBottom: '4px' }}>
                        {t('tenants.adminEmail')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="email"
                        className="input"
                        required
                        placeholder={t('tenants.adminEmailPlaceholder')}
                        value={formData.adminEmail}
                        onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Setup Notice */}
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--primary-600)',
                    backgroundColor: 'var(--badge-primary-bg)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <ShieldCheck size={16} style={{ flexShrink: 0 }} />
                  <span>{t('tenants.initialSetupNotice')}</span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  disabled={creatingTenant}
                  onClick={() => {
                    setShowModal(false);
                    setSlugManuallyEdited(false);
                  }}
                  className="btn btn-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creatingTenant}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {creatingTenant ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{t('tenants.provisioning')}</span>
                    </>
                  ) : (
                    t('tenants.createBtn')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Tenant Modal */}
      {editingTenant && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '620px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={20} style={{ color: 'var(--primary-600)' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-heading)' }}>
                  {t('tenants.editModalTitle', { name: editingTenant.name })}
                </h3>
              </div>
              <button onClick={() => setEditingTenant(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateTenant}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Organization Name */}
                <div>
                  <label className="label">{t('tenants.name')}</label>
                  <input
                    type="text"
                    className="input"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>

                {/* Organization Status */}
                <div>
                  <label className="label">{t('tenants.status')}</label>
                  <select
                    className="input"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    <option value="ACTIVE">{t('common.statusActive')} (ACTIVE)</option>
                    <option value="SUSPENDED">Suspended (SUSPENDED)</option>
                    <option value="PENDING">Pending (PENDING)</option>
                  </select>
                </div>

                {/* Subscription Plan */}
                <div>
                  <label className="label">{t('tenants.subscriptionPlan')}</label>
                  <SearchableSelect
                    options={[
                      { value: '', label: t('tenants.noPlanAssigned') },
                      ...plans
                        .filter((p) => p.isActive || p.id === editPlanId)
                        .map((p) => ({
                          value: p.id,
                          label: `${p.name} (${p.code})`,
                          sublabel: `${p.moduleCount || 1} Mod, ${p.branchCount || 3} Br, ${p.memberCount || 10} Mem · ${formatCurrency(p.price, undefined, i18n.language)} ${!p.isActive ? '(Inactive)' : ''}`,
                          badge: formatCurrency(p.price, undefined, i18n.language),
                        })),
                    ]}
                    value={editPlanId}
                    onChange={(val) => handleEditPlanChange(val)}
                    placeholder={t('tenants.selectPlan')}
                  />
                </div>

                {/* Plan Limits & Capacity Display Box in Edit */}
                {selectedEditPlan && (
                  <div
                    style={{
                      padding: '12px 16px',
                      backgroundColor: 'var(--bg-surface-hover)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Layers size={14} style={{ color: 'var(--primary-600)' }} />
                      <span>{t('tenants.planLimitsSummary')} ({selectedEditPlan.name})</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                        <CreditCard size={13} style={{ color: 'var(--primary-600)' }} />
                        <span><strong>{t('plans.price')}:</strong> {formatCurrency(selectedEditPlan.price, undefined, i18n.language)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                        <Layers size={13} style={{ color: 'var(--primary-600)' }} />
                        <span><strong>{t('tenants.moduleLimit')}:</strong> {selectedEditPlan.moduleCount || 1}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                        <MapPin size={13} style={{ color: 'var(--primary-600)' }} />
                        <span><strong>{t('tenants.branchLimit')}:</strong> {selectedEditPlan.branchCount || 3}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                        <Users size={13} style={{ color: 'var(--primary-600)' }} />
                        <span><strong>{t('tenants.memberLimit')}:</strong> {selectedEditPlan.memberCount || 10}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                        <HardDrive size={13} style={{ color: 'var(--primary-600)' }} />
                        <span><strong>{t('tenants.uploadLimit')}:</strong> {selectedEditPlan.maxUploadFileSizeMb || 25} MB</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Edit Subscription Price */}
                <div>
                  <label className="label">
                    {t('tenants.subscriptionPrice')}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        fontWeight: 700,
                        fontSize: '14px',
                      }}
                    >
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      className="input"
                      style={{ paddingLeft: '28px', fontWeight: 700 }}
                      placeholder={selectedEditPlan ? String(selectedEditPlan.price || 0) : '0.00'}
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                    {t('tenants.subscriptionPriceHelp')}
                  </div>
                </div>

                {/* Edit Subscription Dates */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="label">
                      {t('tenants.startDate')}
                    </label>
                    <input
                      type="date"
                      className="input"
                      style={{ fontWeight: 600 }}
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {t('tenants.startDateHelp')}
                    </div>
                  </div>
                  <div>
                    <label className="label">
                      {t('tenants.endDate')}
                    </label>
                    <input
                      type="date"
                      min={editStartDate}
                      className="input"
                      style={{ fontWeight: 600 }}
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {t('tenants.endDateHelp')}
                    </div>
                  </div>
                </div>

                {/* Organization Limit Overrides in Edit */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    backgroundColor: editOverrideLimits ? 'var(--badge-primary-bg)' : 'var(--bg-surface-hover)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', margin: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sliders size={16} style={{ color: 'var(--primary-600)' }} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                          {t('tenants.limitOverridesTitle')}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {t('tenants.limitOverridesDesc')}
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={editOverrideLimits}
                      onChange={(e) => setEditOverrideLimits(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary-600)' }}
                    />
                  </label>

                  {editOverrideLimits && (
                    <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label className="label" style={{ fontSize: '11px', marginBottom: '3px' }}>
                          {t('tenants.overrideModuleCount')}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          className="input"
                          placeholder={selectedEditPlan ? String(selectedEditPlan.moduleCount || 1) : '1'}
                          value={editMaxModules}
                          onChange={(e) => setEditMaxModules(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: '11px', marginBottom: '3px' }}>
                          {t('tenants.overrideBranchCount')}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          className="input"
                          placeholder={selectedEditPlan ? String(selectedEditPlan.branchCount || 3) : '3'}
                          value={editMaxBranches}
                          onChange={(e) => setEditMaxBranches(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: '11px', marginBottom: '3px' }}>
                          {t('tenants.overrideMemberCount')}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          className="input"
                          placeholder={selectedEditPlan ? String(selectedEditPlan.memberCount || 10) : '10'}
                          value={editMaxMembers}
                          onChange={(e) => setEditMaxMembers(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: '11px', marginBottom: '3px' }}>
                          {t('tenants.overrideUploadSize')}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          className="input"
                          placeholder={selectedEditPlan ? String(selectedEditPlan.maxUploadFileSizeMb || 25) : '25'}
                          value={editMaxUploadFileSizeMb}
                          onChange={(e) => setEditMaxUploadFileSizeMb(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Dynamic Modules Selection for Edit */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                      <Layers size={14} color="#0f766e" /> {t('tenants.enabledModulesTitle')}
                    </label>
                    {selectedEditPlan && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor:
                            editSelectedModules.length === getEffectiveModuleLimit(editPlanId, editOverrideLimits, editMaxModules)
                              ? '#dcfce7'
                              : editSelectedModules.length > getEffectiveModuleLimit(editPlanId, editOverrideLimits, editMaxModules)
                              ? '#fee2e2'
                              : '#f1f5f9',
                          color:
                            editSelectedModules.length === getEffectiveModuleLimit(editPlanId, editOverrideLimits, editMaxModules)
                              ? '#166534'
                              : editSelectedModules.length > getEffectiveModuleLimit(editPlanId, editOverrideLimits, editMaxModules)
                              ? '#991b1b'
                              : '#475569',
                        }}
                      >
                        {t('tenants.selectedModulesCount', { count: editSelectedModules.length, max: getEffectiveModuleLimit(editPlanId, editOverrideLimits, editMaxModules) })}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {systemModules
                      .filter((mod) => mod.isEnabled || editSelectedModules.includes(mod.code))
                      .map((mod) => {
                      const isChecked = editSelectedModules.includes(mod.code);
                      const maxAllowed = getEffectiveModuleLimit(editPlanId, editOverrideLimits, editMaxModules);
                      const isLimitReached = !isChecked && editSelectedModules.length >= maxAllowed;

                      return (
                        <div
                          key={mod.id}
                          onClick={() => !isLimitReached && handleToggleEditModuleSelection(mod.code)}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                            padding: '12px 14px',
                            borderRadius: '10px',
                            border: isChecked
                              ? '1.5px solid var(--primary-600)'
                              : isLimitReached
                              ? '1px solid var(--border-subtle)'
                              : '1px solid var(--border-color)',
                            backgroundColor: isChecked
                              ? 'var(--badge-primary-bg)'
                              : isLimitReached
                              ? 'var(--bg-surface-hover)'
                              : 'var(--bg-surface)',
                            cursor: isLimitReached ? 'not-allowed' : 'pointer',
                            opacity: isLimitReached ? 0.6 : 1,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isLimitReached}
                            onChange={() => {}}
                            style={{
                              width: '18px',
                              height: '18px',
                              marginTop: '2px',
                              cursor: isLimitReached ? 'not-allowed' : 'pointer',
                              accentColor: 'var(--primary-600)',
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                                {mod.name}
                              </span>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  fontFamily: 'monospace',
                                  color: 'var(--text-muted)',
                                  backgroundColor: 'var(--bg-surface-hover)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                {mod.code}
                              </span>
                            </div>
                            {mod.description && (
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {mod.description}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setEditingTenant(null)} className="btn btn-secondary">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                  {savingEdit ? t('tenants.saving') : t('tenants.saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Tenant Modal */}
      {deletingTenant && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} color="#dc2626" />
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#dc2626' }}>
                  {t('tenants.deleteModalTitle')}
                </h3>
              </div>
              <button
                onClick={() => setDeletingTenant(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: 1.5, marginTop: 0 }}>
                {t('tenants.deleteModalConfirm', { name: deletingTenant.name, slug: deletingTenant.slug })}
              </p>
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'var(--badge-danger-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--badge-danger-text)',
                  lineHeight: 1.4,
                }}
              >
                {t('tenants.deleteModalWarning')}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setDeletingTenant(null)}
                className="btn btn-secondary"
                disabled={deleting}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteTenant}
                className="btn btn-danger"
                disabled={deleting}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#dc2626', color: '#fff', border: 'none' }}
              >
                <Trash2 size={16} />
                <span>{deleting ? t('tenants.deleting') : t('tenants.confirmDelete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
