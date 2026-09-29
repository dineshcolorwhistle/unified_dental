import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { useToast } from '../core/context/ToastContext';
import { formatDate, formatDateTime, formatCurrency } from '../core/utils/dateUtils';
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
  Eye,
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
  price: number;
  moduleCount: number;
  branchCount: number;
  memberCount: number;
  maxUploadFileSizeMb: number;
  modules?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
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
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [availableModules, setAvailableModules] = useState<SystemModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // View Details Modal State
  const [viewingPlan, setViewingPlan] = useState<SubscriptionPlan | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    price: '' as number | string,
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
      price: '',
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
      price: plan.price !== undefined && plan.price !== null ? plan.price : 0,
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

    if (formData.price === '' || isNaN(Number(formData.price)) || Number(formData.price) < 0) {
      toast.warning(t('plans.alerts.priceRequired'), 'Validation Error');
      return;
    }

    const payload = {
      ...formData,
      price: Number(formData.price),
    };

    try {
      setSaving(true);
      if (editingPlan) {
        await api.patch(`/plans/${editingPlan.id}`, payload);
        toast.success(`Plan "${formData.name}" updated successfully`, 'Plan Updated');
      } else {
        await api.post('/plans', payload);
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
              className="card card-interactive"
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
              {/* Card Hover Overlay */}
              <div className="card-hover-overlay">
                <button
                  type="button"
                  onClick={() => setViewingPlan(plan)}
                  className="btn btn-primary card-hover-overlay-btn"
                  style={{ gap: '8px', padding: '10px 20px', borderRadius: '10px' }}
                >
                  <Eye size={16} />
                  <span>{t('plans.viewBtn', 'View Details')}</span>
                </button>
              </div>

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

                {/* Price Display */}
                <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-0.5px' }}>
                    {formatCurrency(plan.price, undefined, i18n.language)}
                  </span>
                </div>

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
                  {formatDate(plan.createdAt, { locale: i18n.language })}
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

      {/* View Subscription Plan Details Modal (AGENTS.md Rule 14 Compliant) */}
      {viewingPlan && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: 0,
              overflow: 'hidden',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-modal, var(--bg-card))',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)' }}>
                  {t('plans.viewModalTitle', 'Subscription Plan Details')}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                  {t('plans.viewModalSubtitle', 'Comprehensive tier limits, pricing specifications, and tenant utilization')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingPlan(null)}
                className="btn-icon"
                style={{ width: '32px', height: '32px', border: 'none', background: 'transparent', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Identity & Pricing Header Card */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      backgroundColor: 'var(--badge-primary-bg)',
                      color: 'var(--primary-600)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)' }}>
                      {viewingPlan.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <span className="badge badge-info" style={{ fontSize: '10px', padding: '1px 6px' }}>
                        {viewingPlan.code}
                      </span>
                      <span className={viewingPlan.isActive ? 'badge badge-success' : 'badge badge-danger'} style={{ fontSize: '10px', padding: '1px 6px' }}>
                        {viewingPlan.isActive ? t('common.statusActive') : t('common.statusInactive')}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--primary-600)', fontWeight: 600 }}>
                        {(viewingPlan._count?.tenants || 0) === 1
                          ? t('plans.tenantsCount', { count: viewingPlan._count?.tenants || 0 })
                          : t('plans.tenantsCountPlural', { count: viewingPlan._count?.tenants || 0 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {t('plans.price', 'Price')}
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-0.5px' }}>
                    {formatCurrency(viewingPlan.price, undefined, i18n.language)}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {t('plans.description', 'Description')}
                </div>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    fontSize: '13.5px',
                    color: viewingPlan.description ? 'var(--text-main)' : 'var(--text-muted)',
                    lineHeight: 1.5,
                  }}
                >
                  {viewingPlan.description || <span style={{ fontStyle: 'italic' }}>No description provided</span>}
                </div>
              </div>

              {/* Capacity & Limits Grid */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {t('plans.tierLimits', 'Capacity & Operational Limits')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(20, 184, 166, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary-600)',
                        flexShrink: 0,
                      }}
                    >
                      <Layers size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {t('plans.moduleCount', 'Allowed Modules')}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)' }}>
                        {viewingPlan.moduleCount === 1
                          ? t('plans.modulesAllowed', { count: 1 })
                          : t('plans.modulesAllowedPlural', { count: viewingPlan.moduleCount })}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(20, 184, 166, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary-600)',
                        flexShrink: 0,
                      }}
                    >
                      <MapPin size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {t('plans.branchCount', 'Allowed Branches')}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)' }}>
                        {viewingPlan.branchCount === 1
                          ? t('plans.branchesAllowed', { count: 1 })
                          : t('plans.branchesAllowedPlural', { count: viewingPlan.branchCount })}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(20, 184, 166, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary-600)',
                        flexShrink: 0,
                      }}
                    >
                      <Users size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {t('plans.memberCount', 'Allowed Members')}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)' }}>
                        {viewingPlan.memberCount === 1
                          ? t('plans.membersAllowed', { count: 1 })
                          : t('plans.membersAllowedPlural', { count: viewingPlan.memberCount })}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(20, 184, 166, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary-600)',
                        flexShrink: 0,
                      }}
                    >
                      <HardDrive size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {t('plans.maxUploadFileSizeMb', 'Upload Size Limit')}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)' }}>
                        {viewingPlan.maxUploadFileSizeMb} MB
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timestamps & Audit Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {t('plans.created', 'Created At')}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                    {formatDateTime(viewingPlan.createdAt)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {t('plans.activeTenants', 'Active Subscribed Tenants')}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary-600)', marginTop: '2px' }}>
                    {(viewingPlan._count?.tenants || 0) === 1
                      ? t('plans.tenantsCount', { count: viewingPlan._count?.tenants || 0 })
                      : t('plans.tenantsCountPlural', { count: viewingPlan._count?.tenants || 0 })}
                  </div>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '8px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setViewingPlan(null)}
                  className="btn btn-secondary"
                >
                  {t('common.close', 'Close')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const plan = viewingPlan;
                    setViewingPlan(null);
                    handleOpenEditModal(plan);
                  }}
                  className="btn btn-primary"
                  style={{ gap: '6px' }}
                >
                  <Edit2 size={14} />
                  <span>{t('plans.editBtn', 'Edit Plan')}</span>
                </button>
              </div>
            </div>
          </div>
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

                <div>
                  <label className="label">
                    {t('plans.price')} <span style={{ color: '#ef4444' }}>*</span>
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
                      required
                      className="input"
                      style={{ paddingLeft: '28px', fontWeight: 700 }}
                      placeholder={t('plans.pricePlaceholder')}
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
                    {t('plans.priceHelp')}
                  </div>
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
