import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import {
  CreditCard,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Layers,
  Sparkles,
  Save,
  X,
  Search,
  AlertCircle,
  Package,
} from 'lucide-react';

interface SystemModule {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isEnabled: boolean;
}

interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  moduleCount: number;
  modules?: string[];
  isActive: boolean;
  createdAt: string;
  _count?: {
    tenants: number;
  };
}

function nameToCode(name: string): string {
  return name
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9\s_]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');
}

export const PlansPage: React.FC = () => {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [availableModules, setAvailableModules] = useState<SystemModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    moduleCount: 1,
    isActive: true,
  });
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deletingPlan, setDeletingPlan] = useState<SubscriptionPlan | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plansRes, modulesRes] = await Promise.allSettled([
        api.get('/plans'),
        api.get('/modules?all=true'),
      ]);

      if (plansRes.status === 'fulfilled') {
        setPlans(plansRes.value.data || []);
      }
      if (modulesRes.status === 'fulfilled') {
        setAvailableModules(modulesRes.value.data || []);
      }
    } catch (e) {
      console.error('Failed to load plans or modules:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingPlan(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      moduleCount: 1,
      isActive: true,
    });
    setCodeManuallyEdited(false);
    setShowModal(true);
  };

  const handleOpenEditModal = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      code: plan.code,
      description: plan.description || '',
      moduleCount: plan.moduleCount || 1,
      isActive: plan.isActive,
    });
    setCodeManuallyEdited(true);
    setShowModal(true);
  };

  const handleNameChange = (name: string) => {
    const newForm = { ...formData, name };
    if (!editingPlan && !codeManuallyEdited) {
      newForm.code = nameToCode(name);
    }
    setFormData(newForm);
  };

  const handleCodeChange = (code: string) => {
    setCodeManuallyEdited(true);
    setFormData({
      ...formData,
      code: code.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
    });
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      alert(t('plans.alerts.nameCodeRequired'));
      return;
    }

    if (formData.moduleCount < 1) {
      alert(t('plans.alerts.countMinOne'));
      return;
    }

    try {
      setSaving(true);
      if (editingPlan) {
        await api.patch(`/plans/${editingPlan.id}`, {
          name: formData.name,
          description: formData.description,
          moduleCount: Number(formData.moduleCount),
          isActive: formData.isActive,
        });
      } else {
        await api.post('/plans', {
          ...formData,
          moduleCount: Number(formData.moduleCount),
        });
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || err.response?.data?.message || t('plans.alerts.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!deletingPlan) return;
    try {
      setDeleting(true);
      await api.delete(`/plans/${deletingPlan.id}`);
      setDeletingPlan(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || err.response?.data?.message || t('plans.alerts.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const filteredPlans = plans.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase())),
  );

  const getModuleName = (code: string) => {
    const found = availableModules.find((m) => m.code === code);
    return found ? found.name : code;
  };

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
              <CreditCard size={20} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {t('plans.title')}
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            {t('plans.subtitle')}
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px' }}
        >
          <Plus size={18} />
          <span>{t('plans.createBtn')}</span>
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
            placeholder={t('plans.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
          {t('plans.showingCount', { shown: filteredPlans.length, total: plans.length })}
        </div>
      </div>

      {/* Plans List */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#0f766e', fontWeight: 600 }}>
          {t('common.loading')}
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              backgroundColor: 'rgba(15, 118, 110, 0.1)',
              color: '#0f766e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <CreditCard size={32} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
            {t('plans.noPlansFound')}
          </h3>
          <p style={{ fontSize: '14px', color: '#64748b', maxWidth: '420px', margin: '0 auto 20px' }}>
            {search ? t('plans.noPlansSearch') : t('plans.noPlansEmpty')}
          </p>
          {!search && (
            <button onClick={handleOpenCreateModal} className="btn btn-primary" style={{ borderRadius: '10px' }}>
              <Plus size={16} /> {t('plans.createFirst')}
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '24px',
          }}
        >
          {filteredPlans.map((plan) => (
            <div
              key={plan.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '24px',
                borderRadius: '16px',
                border: plan.isActive ? '1px solid #e2e8f0' : '1px dashed #cbd5e1',
                backgroundColor: plan.isActive ? '#ffffff' : '#f8fafc',
              }}
            >
              <div>
                {/* Header Row: Code & Active Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        backgroundColor: '#f1f5f9',
                        color: '#0f172a',
                        fontSize: '11px',
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        borderRadius: '6px',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {plan.code}
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: '6px',
                        backgroundColor: plan.isActive ? '#dcfce7' : '#fee2e2',
                        color: plan.isActive ? '#166534' : '#991b1b',
                      }}
                    >
                      {plan.isActive ? (
                        <>
                          <CheckCircle2 size={12} /> {t('common.statusActive')}
                        </>
                      ) : (
                        <>
                          <XCircle size={12} /> {t('common.statusInactive')}
                        </>
                      )}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '12px',
                      color: '#0f766e',
                      fontWeight: 700,
                      backgroundColor: 'rgba(15, 118, 110, 0.08)',
                      padding: '4px 10px',
                      borderRadius: '8px',
                    }}
                  >
                    {(plan._count?.tenants || 0) === 1
                      ? t('plans.tenantsCount', { count: plan._count?.tenants || 0 })
                      : t('plans.tenantsCountPlural', { count: plan._count?.tenants || 0 })}
                  </span>
                </div>

                {/* Plan Name */}
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                  {plan.name}
                </h3>

                {/* Plan Description */}
                <p
                  style={{
                    fontSize: '13px',
                    color: '#64748b',
                    lineHeight: '1.5',
                    minHeight: '38px',
                    marginBottom: '20px',
                  }}
                >
                  {plan.description || <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>No description provided</span>}
                </p>

                {/* Allowed Module Capacity */}
                <div style={{ marginBottom: '20px' }}>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#475569',
                      marginBottom: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Layers size={13} color="#0f766e" /> {t('plans.allowedCapacity')}
                  </div>

                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 14px',
                      borderRadius: '10px',
                      backgroundColor: '#f0fdfa',
                      border: '1px solid #ccfbf1',
                      color: '#0f766e',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    <CheckCircle2 size={16} color="#0f766e" />
                    <span>
                      {(plan.moduleCount || 1) === 1
                        ? t('plans.modulesAllowed', { count: plan.moduleCount || 1 })
                        : t('plans.modulesAllowedPlural', { count: plan.moduleCount || 1 })}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                    {t('plans.allowedDesc', { count: plan.moduleCount || 1 })}
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '16px',
                  borderTop: '1px solid #f1f5f9',
                }}
              >
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {new Date(plan.createdAt).toLocaleDateString()}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleOpenEditModal(plan)}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Edit2 size={13} /> {t('plans.editBtn')}
                  </button>
                  <button
                    onClick={() => setDeletingPlan(plan)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    <Trash2 size={13} /> {t('plans.deleteBtn')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Plan Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={20} color="#0f766e" />
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
                  {editingPlan ? t('plans.modalTitleEdit') : t('plans.modalTitleCreate')}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePlan}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="label">
                      {t('plans.name')} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      placeholder={t('plans.namePlaceholder')}
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="label">
                      {t('plans.code')} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!!editingPlan}
                      className="input"
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        backgroundColor: editingPlan ? '#f1f5f9' : '#ffffff',
                      }}
                      placeholder={t('plans.codePlaceholder')}
                      value={formData.code}
                      onChange={(e) => handleCodeChange(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="label">{t('plans.description')}</label>
                  <textarea
                    rows={2}
                    className="input"
                    placeholder={t('plans.descriptionPlaceholder')}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                {/* Allowed Module Count Input */}
                <div>
                  <label className="label" style={{ marginBottom: '6px', display: 'block' }}>
                    {t('plans.moduleCount')} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      required
                      className="input"
                      style={{ width: '110px', fontWeight: 700, fontSize: '15px' }}
                      value={formData.moduleCount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          moduleCount: Math.max(1, parseInt(e.target.value) || 1),
                        })
                      }
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[1, 2, 3].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setFormData({ ...formData, moduleCount: cnt })}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 700,
                            border: formData.moduleCount === cnt ? '1.5px solid #0f766e' : '1px solid #e2e8f0',
                            backgroundColor: formData.moduleCount === cnt ? 'rgba(15, 118, 110, 0.08)' : '#f8fafc',
                            color: formData.moduleCount === cnt ? '#0f766e' : '#64748b',
                            cursor: 'pointer',
                          }}
                        >
                          {cnt === 1 ? t('plans.modulesAllowed', { count: cnt }) : t('plans.modulesAllowedPlural', { count: cnt })}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                    {t('plans.moduleCountHelp')}
                  </p>
                </div>

                {/* Active Status */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                      {t('plans.activeStatus')}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {t('plans.activeStatusHelp')}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#0f766e' }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                  disabled={saving}
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? t('plans.saving') : editingPlan ? t('plans.modalTitleEdit') : t('plans.modalTitleCreate')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingPlan && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
                <AlertCircle size={20} />
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{t('plans.deleteModalTitle')}</h3>
              </div>
              <button
                onClick={() => setDeletingPlan(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14px', color: '#334155', lineHeight: '1.5' }}>
                {t('plans.deleteModalConfirm', { name: deletingPlan.name, code: deletingPlan.code })}
              </p>
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#991b1b',
                }}
              >
                {t('plans.deleteModalWarning')}
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setDeletingPlan(null)}
                className="btn btn-secondary"
                disabled={deleting}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeletePlan}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                disabled={deleting}
              >
                {deleting ? t('plans.deleting') : t('plans.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
