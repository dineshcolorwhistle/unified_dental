import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Plus,
  Search,
  ExternalLink,
  Globe,
  Copy,
  Check,
  CreditCard,
  Layers,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  MapPin,
  User,
  ShieldCheck,
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
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [systemModules, setSystemModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Edit Tenant Modal State
  const [editingTenant, setEditingTenant] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState<string>('ACTIVE');
  const [editPlanId, setEditPlanId] = useState('');
  const [editSelectedModules, setEditSelectedModules] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Tenant Modal State
  const [deletingTenant, setDeletingTenant] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form State for Provisioning
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    planId: '',
    modules: [] as string[],
    branchName: 'Main Branch',
    adminEmail: '',
    adminName: '',
  });
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const fetchTenantsAndPlans = async () => {
    try {
      setLoading(true);
      const [tenantsRes, plansRes, modulesRes] = await Promise.allSettled([
        api.get('/tenants', { params: { search: search || undefined } }),
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
      console.error('Failed to load tenants or plans:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantsAndPlans();
  }, [search]);

  const handleNameChange = (name: string) => {
    const newFormData = { ...formData, name };
    if (!slugManuallyEdited) {
      newFormData.slug = nameToSlug(name);
    }
    setFormData(newFormData);
  };

  const handleSlugChange = (slug: string) => {
    setSlugManuallyEdited(true);
    setFormData({
      ...formData,
      slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, ''),
    });
  };

  const handlePlanChange = (planId: string) => {
    const targetPlan = plans.find((p) => p.id === planId);
    const maxAllowed = targetPlan ? (targetPlan.moduleCount || 1) : systemModules.length;
    
    // Auto trim selected modules if exceeds newly selected plan limit
    const trimmedModules = formData.modules.slice(0, maxAllowed);
    setFormData({
      ...formData,
      planId,
      modules: trimmedModules,
    });
  };

  const handleToggleModuleSelection = (moduleCode: string) => {
    const selectedPlan = plans.find((p) => p.id === formData.planId);
    const maxAllowed = selectedPlan ? (selectedPlan.moduleCount || 1) : systemModules.length;
    const isChecked = formData.modules.includes(moduleCode);

    if (isChecked) {
      setFormData({
        ...formData,
        modules: formData.modules.filter((m) => m !== moduleCode),
      });
    } else {
      if (formData.modules.length >= maxAllowed) {
        alert(t('tenants.alerts.planLimitAlert', { max: maxAllowed }));
        return;
      }
      setFormData({
        ...formData,
        modules: [...formData.modules, moduleCode],
      });
    }
  };

  const handleEditPlanChange = (planId: string) => {
    const targetPlan = plans.find((p) => p.id === planId);
    const maxAllowed = targetPlan ? (targetPlan.moduleCount || 1) : systemModules.length;
    setEditPlanId(planId);
    setEditSelectedModules((prev) => prev.slice(0, maxAllowed));
  };

  const handleToggleEditModuleSelection = (moduleCode: string) => {
    const targetPlan = plans.find((p) => p.id === editPlanId);
    const maxAllowed = targetPlan ? (targetPlan.moduleCount || 1) : systemModules.length;
    const isChecked = editSelectedModules.includes(moduleCode);

    if (isChecked) {
      setEditSelectedModules((prev) => prev.filter((m) => m !== moduleCode));
    } else {
      if (editSelectedModules.length >= maxAllowed) {
        alert(t('tenants.alerts.planLimitAlert', { max: maxAllowed }));
        return;
      }
      setEditSelectedModules((prev) => [...prev, moduleCode]);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.planId && formData.modules.length === 0) {
      alert(t('tenants.alerts.selectAtLeastOne'));
      return;
    }

    try {
      await api.post('/tenants', {
        ...formData,
        locale: i18n.language,
      });
      setShowModal(false);
      setFormData({
        name: '',
        slug: '',
        planId: '',
        modules: [],
        branchName: 'Main Branch',
        adminEmail: '',
        adminName: '',
      });
      setSlugManuallyEdited(false);
      fetchTenantsAndPlans();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || err.response?.data?.message || t('tenants.alerts.createFailed'));
    }
  };

  const handleToggleModule = async (tenantId: string, moduleKey: string, currentStatus: boolean) => {
    try {
      await api.post('/modules/toggle', {
        tenantId,
        moduleKey,
        isEnabled: !currentStatus,
      });
      fetchTenantsAndPlans();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || err.response?.data?.message || t('tenants.alerts.toggleFailed'));
    }
  };

  const handleOpenEditModal = (tenant: any) => {
    setEditingTenant(tenant);
    setEditName(tenant.name || '');
    setEditStatus(tenant.status || 'ACTIVE');
    setEditPlanId(tenant.planId || '');
    const enabledMods = (tenant.modules || [])
      .filter((m: any) => m.isEnabled)
      .map((m: any) => m.moduleKey);
    setEditSelectedModules(enabledMods);
  };

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;

    if (editPlanId && editSelectedModules.length === 0) {
      alert(t('tenants.alerts.selectAtLeastOne'));
      return;
    }

    try {
      setSavingEdit(true);
      await api.patch(`/tenants/${editingTenant.id}`, {
        name: editName,
        status: editStatus,
        planId: editPlanId || null,
        modules: editSelectedModules,
      });
      setEditingTenant(null);
      fetchTenantsAndPlans();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || err.response?.data?.message || t('tenants.alerts.updateFailed'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteTenant = async () => {
    if (!deletingTenant) return;

    try {
      setDeleting(true);
      await api.delete(`/tenants/${deletingTenant.id}`);
      setDeletingTenant(null);
      fetchTenantsAndPlans();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || err.response?.data?.message || t('tenants.alerts.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyUrl = (slug: string) => {
    const { protocol, host } = window.location;
    const url = `${protocol}//${slug}.${host}/login`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
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
                backgroundColor: 'rgba(15, 118, 110, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0f766e',
              }}
            >
              <Building2 size={20} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {t('tenants.title')}
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            {t('tenants.subtitle')}
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({
              name: '',
              slug: '',
              planId: '',
              modules: [],
              branchName: 'Main Branch',
              adminEmail: '',
              adminName: '',
            });
            setSlugManuallyEdited(false);
            setShowModal(true);
          }}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px' }}
        >
          <Plus size={18} />
          <span>{t('tenants.createBtn')}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
          <Search
            size={18}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
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
        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
          {t('tenants.totalOrganizations')}: <strong>{tenants.length}</strong>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '16px' }}>
        <table className="table">
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
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#0f766e' }}>
                  {t('common.loading')}
                </td>
              </tr>
            ) : tenants.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  {t('tenants.noTenants')}
                </td>
              </tr>
            ) : (
              tenants.map((tItem) => {
                const plan = tItem.plan;
                return (
                  <tr key={tItem.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{tItem.name}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {new Date(tItem.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            backgroundColor: '#f1f5f9',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: '#0f766e',
                            fontWeight: 700,
                          }}
                        >
                          {tItem.slug}
                        </span>
                        <button
                          onClick={() => handleCopyUrl(tItem.slug)}
                          className="btn-icon"
                          title={t('tenants.copyUrlTooltip')}
                          style={{ padding: '3px 6px' }}
                        >
                          {copiedSlug === tItem.slug ? (
                            <Check size={12} color="#10b981" />
                          ) : (
                            <Copy size={12} color="#64748b" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td>
                      {plan ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(15, 118, 110, 0.08)',
                              color: '#0f766e',
                              fontSize: '12px',
                              fontWeight: 700,
                            }}
                          >
                            {plan.name} ({plan.moduleCount || 1} Mod{(plan.moduleCount || 1) === 1 ? '' : 's'})
                          </span>
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
                          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                            {t('tenants.noActiveModules')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{tItem._count?.branches || tItem.branches?.length || 0}</td>
                    <td>{tItem._count?.memberships || 0}</td>
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

      {/* Provision Tenant Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={20} color="#0f766e" />
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
                  {t('tenants.modalTitle')}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSlugManuallyEdited(false);
                }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
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
                        color: '#0f766e',
                        marginTop: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: '#f0fdfa',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #99f6e4',
                      }}
                    >
                      <Globe size={14} />
                      <span>
                        {t('tenants.accessUrl')}: <strong style={{ fontFamily: 'monospace' }}>{getPreviewUrl(formData.slug)}</strong>
                      </span>
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    {t('tenants.slugHelp')}
                  </div>
                </div>

                {/* Subscription Plan Selection Dropdown */}
                <div>
                  <label className="label">
                    {t('tenants.subscriptionPlan')} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    className="input"
                    required
                    value={formData.planId}
                    onChange={(e) => handlePlanChange(e.target.value)}
                  >
                    <option value="">{t('tenants.selectPlan')}</option>
                    {plans
                      .filter((p) => p.isActive)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code}) — {p.moduleCount || 1} Module{(p.moduleCount || 1) === 1 ? '' : 's'} Allowed
                        </option>
                      ))}
                  </select>
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
                            formData.modules.length === (selectedPlan.moduleCount || 1)
                              ? '#dcfce7'
                              : formData.modules.length > (selectedPlan.moduleCount || 1)
                              ? '#fee2e2'
                              : '#f1f5f9',
                          color:
                            formData.modules.length === (selectedPlan.moduleCount || 1)
                              ? '#166534'
                              : formData.modules.length > (selectedPlan.moduleCount || 1)
                              ? '#991b1b'
                              : '#475569',
                        }}
                      >
                        {t('tenants.selectedModulesCount', { count: formData.modules.length, max: selectedPlan.moduleCount || 1 })}
                      </span>
                    )}
                  </div>

                  {!formData.planId ? (
                    <div
                      style={{
                        padding: '16px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '10px',
                        border: '1px dashed #cbd5e1',
                        fontSize: '12px',
                        color: '#64748b',
                        textAlign: 'center',
                      }}
                    >
                      {t('tenants.selectPlanFirst')}
                    </div>
                  ) : systemModules.filter((m) => m.isEnabled).length === 0 ? (
                    <div
                      style={{
                        padding: '14px',
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fef3c7',
                        borderRadius: '10px',
                        fontSize: '13px',
                        color: '#92400e',
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
                        const maxAllowed = selectedPlan ? (selectedPlan.moduleCount || 1) : systemModules.length;
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
                                ? '1.5px solid #0f766e'
                                : isLimitReached
                                ? '1px solid #e2e8f0'
                                : '1px solid #cbd5e1',
                              backgroundColor: isChecked
                                ? 'rgba(15, 118, 110, 0.04)'
                                : isLimitReached
                                ? '#f8fafc'
                                : '#ffffff',
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
                                accentColor: '#0f766e',
                              }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                                    {mod.name}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      fontFamily: 'monospace',
                                      color: '#64748b',
                                      backgroundColor: '#f1f5f9',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                    }}
                                  >
                                    {mod.code}
                                  </span>
                                </div>
                                {isLimitReached && (
                                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                                    {t('tenants.limitReached')}
                                  </span>
                                )}
                              </div>
                              {mod.description && (
                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
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

                {/* Initial Branch Name */}
                <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={15} color="#0f766e" /> {t('tenants.initialBranchTitle')}
                  </div>
                  <input
                    type="text"
                    className="input"
                    placeholder={t('tenants.branchName')}
                    value={formData.branchName}
                    onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                  />
                </div>

                {/* Initial Tenant Admin */}
                <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={15} color="#0f766e" /> {t('tenants.initialAdminTitle')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input
                      type="text"
                      className="input"
                      placeholder={t('tenants.adminName')}
                      value={formData.adminName}
                      onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                    />
                    <input
                      type="email"
                      className="input"
                      placeholder={t('tenants.adminEmail')}
                      value={formData.adminEmail}
                      onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                    />
                  </div>
                </div>

                {/* Setup Notice */}
                <div
                  style={{
                    fontSize: '12px',
                    color: '#0f766e',
                    backgroundColor: '#f0fdfa',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #99f6e4',
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
                  onClick={() => {
                    setShowModal(false);
                    setSlugManuallyEdited(false);
                  }}
                  className="btn btn-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary">
                  {t('tenants.createBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Tenant Modal */}
      {editingTenant && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={20} color="#0f766e" />
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
                  {t('tenants.editModalTitle', { name: editingTenant.name })}
                </h3>
              </div>
              <button onClick={() => setEditingTenant(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
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
                  <select
                    className="input"
                    value={editPlanId}
                    onChange={(e) => handleEditPlanChange(e.target.value)}
                  >
                    <option value="">{t('tenants.noPlanAssigned')}</option>
                    {plans
                      .filter((p) => p.isActive || p.id === editPlanId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code}) — {p.moduleCount || 1} Module{(p.moduleCount || 1) === 1 ? '' : 's'} Allowed {!p.isActive ? '(Inactive)' : ''}
                        </option>
                      ))}
                  </select>
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
                            editSelectedModules.length === (selectedEditPlan.moduleCount || 1)
                              ? '#dcfce7'
                              : editSelectedModules.length > (selectedEditPlan.moduleCount || 1)
                              ? '#fee2e2'
                              : '#f1f5f9',
                          color:
                            editSelectedModules.length === (selectedEditPlan.moduleCount || 1)
                              ? '#166534'
                              : editSelectedModules.length > (selectedEditPlan.moduleCount || 1)
                              ? '#991b1b'
                              : '#475569',
                        }}
                      >
                        {t('tenants.selectedModulesCount', { count: editSelectedModules.length, max: selectedEditPlan.moduleCount || 1 })}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {systemModules
                      .filter((mod) => mod.isEnabled || editSelectedModules.includes(mod.code))
                      .map((mod) => {
                      const isChecked = editSelectedModules.includes(mod.code);
                      const maxAllowed = selectedEditPlan ? (selectedEditPlan.moduleCount || 1) : systemModules.length;
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
                              ? '1.5px solid #0f766e'
                              : isLimitReached
                              ? '1px solid #e2e8f0'
                              : '1px solid #cbd5e1',
                            backgroundColor: isChecked
                              ? 'rgba(15, 118, 110, 0.04)'
                              : isLimitReached
                              ? '#f8fafc'
                              : '#ffffff',
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
                              accentColor: '#0f766e',
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                                {mod.name}
                              </span>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  fontFamily: 'monospace',
                                  color: '#64748b',
                                  backgroundColor: '#f1f5f9',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                {mod.code}
                              </span>
                            </div>
                            {mod.description && (
                              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
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
              <p style={{ fontSize: '14px', color: '#334155', lineHeight: 1.5, marginTop: 0 }}>
                {t('tenants.deleteModalConfirm', { name: deletingTenant.name, slug: deletingTenant.slug })}
              </p>
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#991b1b',
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
