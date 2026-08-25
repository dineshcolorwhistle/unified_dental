import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { useToast } from '../core/context/ToastContext';
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
  MapPin,
  Users,
  HardDrive,
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
  branchCount: number;
  memberCount: number;
  maxUploadFileSizeMb: number;
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
  const { toast } = useToast();
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
    branchCount: 3,
    memberCount: 10,
    maxUploadFileSizeMb: 25,
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
      branchCount: 3,
      memberCount: 10,
      maxUploadFileSizeMb: 25,
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
      moduleCount: plan.moduleCount,
      branchCount: plan.branchCount,
      memberCount: plan.memberCount,
      maxUploadFileSizeMb: plan.maxUploadFileSizeMb || 25,
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
    if (!formData.name || !formData.code) {
      toast.warning(t('plans.alerts.nameCodeRequired'), 'Validation Error');
      return;
    }

    try {
      setSaving(true);
      if (editingPlan) {
        await api.patch(`/plans/${editingPlan.id}`, formData);
        toast.success(`Plan "${formData.name}" updated successfully`, 'Plan Updated');
      } else {
        await api.post('/plans', formData);
        toast.success(`Plan "${formData.name}" created successfully`, 'Plan Created');
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || t('plans.alerts.saveFailed');
      toast.error(msg, 'Save Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!deletingPlan) return;
    try {
      setDeleting(true);
      await api.delete(`/plans/${deletingPlan.id}`);
      toast.success(`Plan deleted successfully`, 'Plan Deleted');
      setDeletingPlan(null);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || t('plans.alerts.deleteFailed');
      toast.error(msg, 'Delete Failed');
    } finally {
      setDeleting(false);
    }
  };

  const filteredPlans = useMemo(() => {
    return plans.filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(search.toLowerCase())),
    );
  }, [plans, search]);

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
                backgroundColor: 'var(--badge-primary-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-600)',
              }}
            >
              <CreditCard size={20} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {t('plans.title')}
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
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
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }}
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
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
          {t('plans.showingCount', { shown: filteredPlans.length, total: plans.length })}
        </div>
      </div>

      {/* Plans List */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--primary-600)', fontWeight: 600 }}>
          {t('common.loading')}
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              backgroundColor: 'var(--badge-primary-bg)',
              color: 'var(--primary-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <CreditCard size={32} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
            {t('plans.noPlansFound')}
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 20px' }}>
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
            marginBottom: '20px',
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
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '24px',
                backgroundColor: 'var(--bg-surface)',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.2s ease',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                        {plan.name}
                      </h4>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <span className="badge badge-info" style={{ fontSize: '10px', padding: '1px 6px' }}>
                          {plan.code}
                        </span>
                        <span className={plan.isActive ? 'badge badge-success' : 'badge badge-danger'} style={{ fontSize: '10px', padding: '1px 6px' }}>
                          {plan.isActive ? t('common.statusActive') : t('common.statusInactive')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary-600)' }}>
                    {(plan._count?.tenants || 0) === 1
                      ? t('plans.tenantsCount', { count: plan._count?.tenants || 0 })
                      : t('plans.tenantsCountPlural', { count: plan._count?.tenants || 0 })}
                  </div>
                </div>

                {plan.description && (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.4 }}>
                    {plan.description}
                  </p>
                )}

                {/* Plan Limits Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <div
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-surface-hover)',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Layers size={15} style={{ color: 'var(--primary-600)' }} />
                    <span>
                      {plan.moduleCount === 1
                        ? t('plans.modulesAllowed', { count: 1 })
                        : t('plans.modulesAllowedPlural', { count: plan.moduleCount })}
                    </span>
                  </div>
                  <div
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-surface-hover)',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <MapPin size={15} style={{ color: 'var(--primary-600)' }} />
                    <span>
                      {plan.branchCount === 1
                        ? t('plans.branchesAllowed', { count: 1 })
                        : t('plans.branchesAllowedPlural', { count: plan.branchCount })}
                    </span>
                  </div>
                  <div
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-surface-hover)',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Users size={15} style={{ color: 'var(--primary-600)' }} />
                    <span>
                      {plan.memberCount === 1
                        ? t('plans.membersAllowed', { count: 1 })
                        : t('plans.membersAllowedPlural', { count: plan.memberCount })}
                    </span>
                  </div>
                  <div
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-surface-hover)',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <HardDrive size={15} style={{ color: 'var(--primary-600)' }} />
                    <span>{plan.maxUploadFileSizeMb} MB</span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '14px',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                  {new Date(plan.createdAt).toLocaleDateString()}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleOpenEditModal(plan)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                  >
                    <Edit2 size={13} /> {t('plans.editBtn')}
                  </button>
                  <button
                    onClick={() => setDeletingPlan(plan)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '4px 10px', fontSize: '12px', color: 'var(--rose-500)' }}
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
                <CreditCard size={20} style={{ color: 'var(--primary-600)' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-heading)' }}>
                  {editingPlan ? t('plans.modalTitleEdit') : t('plans.modalTitleCreate')}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
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

                {/* Limits Config Section */}
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-surface-hover)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: 'var(--text-heading)',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Layers size={15} style={{ color: 'var(--primary-600)' }} />
                    {t('plans.limitsTitle')}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {/* Module Count */}
                    <div>
                      <label className="label" style={{ fontSize: '12px', marginBottom: '4px' }}>
                        {t('plans.moduleCount')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        required
                        className="input"
                        style={{ fontWeight: 700 }}
                        value={formData.moduleCount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            moduleCount: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                      />
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {t('plans.moduleCountHelp')}
                      </div>
                    </div>

                    {/* Branch Count */}
                    <div>
                      <label className="label" style={{ fontSize: '12px', marginBottom: '4px' }}>
                        {t('plans.branchCount')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        required
                        className="input"
                        style={{ fontWeight: 700 }}
                        value={formData.branchCount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            branchCount: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                      />
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {t('plans.branchCountHelp')}
                      </div>
                    </div>

                    {/* Member Count */}
                    <div>
                      <label className="label" style={{ fontSize: '12px', marginBottom: '4px' }}>
                        {t('plans.memberCount')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        required
                        className="input"
                        style={{ fontWeight: 700 }}
                        value={formData.memberCount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            memberCount: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                      />
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {t('plans.memberCountHelp')}
                      </div>
                    </div>

                    {/* Upload File Size (MB) */}
                    <div>
                      <label className="label" style={{ fontSize: '12px', marginBottom: '4px' }}>
                        {t('plans.maxUploadFileSizeMb')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        required
                        className="input"
                        style={{ fontWeight: 700 }}
                        value={formData.maxUploadFileSizeMb}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            maxUploadFileSizeMb: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                      />
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {t('plans.maxUploadFileSizeMbHelp')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Active Status */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    backgroundColor: 'var(--bg-surface-hover)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                      {t('plans.activeStatus')}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {t('plans.activeStatusHelp')}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary-600)' }}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rose-500)' }}>
                <AlertCircle size={20} />
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--rose-500)' }}>{t('plans.deleteModalTitle')}</h3>
              </div>
              <button
                onClick={() => setDeletingPlan(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: '1.5' }}>
                {t('plans.deleteModalConfirm', { name: deletingPlan.name, code: deletingPlan.code })}
              </p>
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  backgroundColor: 'var(--badge-danger-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--badge-danger-text)',
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
