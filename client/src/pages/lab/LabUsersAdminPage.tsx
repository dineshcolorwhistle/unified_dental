import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import { SearchableSelect, SearchableSelectOption } from '../../components/common/SearchableSelect';
import { Tooltip } from '../../components/common/Tooltip';
import { Pagination } from '../../components/common/Pagination';
import { formatDate } from '../../core/utils/dateUtils';
import {
  ShieldCheck,
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Send,
  Trash2,
  X,
  Star,
  Clock,
  User,
  Users,
} from 'lucide-react';

interface LabAdminRecord {
  id: string;
  email: string;
  name: string;
  phone?: string;
  status: 'ACTIVE' | 'INVITED' | 'INACTIVE';
  avatarUrl?: string;
  createdAt: string;
  branch: {
    id: string;
    name: string;
    code?: string;
  } | null;
  isDefaultAdmin: boolean;
  roles: string[];
}

const COUNTRY_DIALING_CODES: SearchableSelectOption[] = [
  { value: '+52', label: '+52' },
  { value: '+1', label: '+1' },
  { value: '+51', label: '+51' },
  { value: '+34', label: '+34' },
  { value: '+57', label: '+57' },
  { value: '+54', label: '+54' },
  { value: '+56', label: '+56' },
  { value: '+44', label: '+44' },
];

export const LabUsersAdminPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isTenantAdmin } = useAuth();
  const { toast } = useToast();

  const [admins, setAdmins] = useState<LabAdminRecord[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Form State matching screenshot
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneCountryCode: '+52',
    phoneNumber: '',
    branchId: '',
    isDefaultAdmin: false,
  });

  // Load Data
  const loadData = async () => {
    try {
      setLoading(true);
      const [adminsRes, branchesRes] = await Promise.allSettled([
        api.get('/lab/users/admin', {
          params: {
            branchId: selectedBranchFilter !== 'all' ? selectedBranchFilter : undefined,
            search: search || undefined,
          },
        }),
        api.get('/branches'),
      ]);

      if (adminsRes.status === 'fulfilled') {
        setAdmins(adminsRes.value.data || []);
      }
      if (branchesRes.status === 'fulfilled') {
        const branchList = branchesRes.value.data || [];
        setBranches(branchList);
        // Pre-select first branch or default branch if formData.branchId is empty
        if (!formData.branchId && branchList.length > 0) {
          const defaultBranch = branchList.find((b: any) => b.isDefault) || branchList[0];
          setFormData((prev) => ({ ...prev, branchId: defaultBranch.id }));
        }
      }
    } catch (e) {
      console.error('Failed to load lab admins:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.activeTenant?.id, selectedBranchFilter, search]);

  // Branch Options for Dropdown
  const branchOptions: SearchableSelectOption[] = useMemo(() => {
    return branches.map((b) => ({
      value: b.id,
      label: `${b.name} ${b.code ? `(${b.code})` : ''}`,
      sublabel: b.address || undefined,
      badge: b.isDefault ? 'MAIN' : undefined,
    }));
  }, [branches]);

  const branchFilterOptions: SearchableSelectOption[] = useMemo(() => {
    return [
      { value: 'all', label: t('labAdmin.allBranches') },
      ...branches.map((b) => ({
        value: b.id,
        label: `${b.name} ${b.code ? `(${b.code})` : ''}`,
      })),
    ];
  }, [branches, t]);

  // Filtered & Paginated Admins
  const filteredAdmins = useMemo(() => {
    return admins.filter((admin) => {
      const matchesBranch =
        selectedBranchFilter === 'all' || admin.branch?.id === selectedBranchFilter;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        admin.name.toLowerCase().includes(q) ||
        admin.email.toLowerCase().includes(q) ||
        (admin.phone && admin.phone.toLowerCase().includes(q)) ||
        (admin.branch?.name && admin.branch.name.toLowerCase().includes(q));

      return matchesBranch && matchesSearch;
    });
  }, [admins, selectedBranchFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredAdmins.length / pageSize));
  const paginatedAdmins = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAdmins.slice(start, start + pageSize);
  }, [filteredAdmins, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedBranchFilter]);

  // Handle open modal with prerequisite verification
  const handleOpenCreateModal = () => {
    if (branches.length === 0) {
      toast.warning(
        t('labAdmin.branchRequired.description'),
        t('labAdmin.branchRequired.title'),
      );
      return;
    }

    const defaultBranch = branches.find((b) => b.isDefault) || branches[0];
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phoneCountryCode: '+52',
      phoneNumber: '',
      branchId: defaultBranch ? defaultBranch.id : '',
      isDefaultAdmin: false,
    });
    setShowCreateModal(true);
  };

  // Submit Handler for Create Admin
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName.trim()) {
      toast.error(t('labAdmin.modal.firstName') + ' is required');
      return;
    }
    if (!formData.email.trim()) {
      toast.error(t('labAdmin.modal.email') + ' is required');
      return;
    }
    if (!formData.branchId) {
      toast.error(t('labAdmin.modal.allBranch') + ' is required');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/lab/users/admin', formData);
      toast.success(
        t('labAdmin.alerts.createSuccess', { name: `${formData.firstName} ${formData.lastName}`.trim() }),
        t('labAdmin.modal.title'),
      );
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        t('labAdmin.alerts.createFailed');
      toast.error(msg, t('labAdmin.alerts.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Resend Invite Email
  const handleResendInvite = async (admin: LabAdminRecord) => {
    try {
      setResendingId(admin.id);
      await api.post(`/lab/users/admin/${admin.id}/resend-invite`);
      toast.success(
        t('labAdmin.alerts.resendSuccess', { email: admin.email }),
        t('labAdmin.table.resendTooltip'),
      );
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        t('labAdmin.alerts.resendFailed');
      toast.error(msg);
    } finally {
      setResendingId(null);
    }
  };

  // Delete Admin
  const handleDeleteAdmin = async (admin: LabAdminRecord) => {
    const confirmMsg = t('labAdmin.alerts.deleteConfirm', { name: admin.name });
    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      await api.delete(`/lab/users/admin/${admin.id}`);
      toast.success(t('labAdmin.alerts.deleteSuccess'));
      loadData();
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        t('labAdmin.alerts.deleteFailed');
      toast.error(msg);
    }
  };

  // Stats Calculations
  const stats = useMemo(() => {
    const total = admins.length;
    const coveredBranches = new Set(admins.map((a) => a.branch?.id).filter(Boolean)).size;
    const defaultAdminsCount = admins.filter((a) => a.isDefaultAdmin).length;
    return { total, coveredBranches, defaultAdminsCount };
  }, [admins]);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* ───── Page Header ───── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                backgroundColor: 'rgba(13, 148, 136, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0d9488',
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 800,
                color: 'var(--text-heading)',
                margin: 0,
                letterSpacing: '-0.02em',
                fontFamily: 'var(--font-heading)',
              }}
            >
              {t('labAdmin.pageTitle')}
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            {t('labAdmin.pageDesc')}
          </p>
        </div>

        {/* Action Button: Visible for Tenant Admin */}
        {isTenantAdmin ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenCreateModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontWeight: 600,
              fontSize: '14px',
              borderRadius: '10px',
              boxShadow: '0 2px 8px rgba(13, 148, 136, 0.25)',
              cursor: 'pointer',
            }}
          >
            <Plus size={18} />
            <span>{t('labAdmin.createBtn')}</span>
          </button>
        ) : (
          <Tooltip content={t('labAdmin.alerts.tenantAdminOnlyWarning')}>
            <button
              type="button"
              className="btn"
              disabled
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                fontWeight: 600,
                fontSize: '14px',
                borderRadius: '10px',
                opacity: 0.6,
                cursor: 'not-allowed',
                backgroundColor: 'var(--bg-surface-muted)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
              }}
            >
              <Plus size={18} />
              <span>{t('labAdmin.createBtn')}</span>
            </button>
          </Tooltip>
        )}
      </div>

      {/* ───── Branch Prerequisite Warning Banner (If 0 Branches) ───── */}
      {branches.length === 0 && !loading && (
        <div
          style={{
            marginBottom: '24px',
            padding: '16px 20px',
            borderRadius: '12px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--amber-500)',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4
                style={{
                  margin: '0 0 2px',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--text-heading)',
                }}
              >
                {t('labAdmin.branchRequired.title')}
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                {t('labAdmin.branchRequired.description')}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/branches')}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '8px',
              whiteSpace: 'nowrap',
            }}
          >
            <Building2 size={15} style={{ marginRight: '6px' }} />
            {t('labAdmin.branchRequired.createBranchBtn')}
          </button>
        </div>
      )}

      {/* ───── Summary Stats Cards ───── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div
          className="card"
          style={{
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(13, 148, 136, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0d9488',
            }}
          >
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('labAdmin.stats.totalAdmins')}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
              {stats.total}
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-600)',
            }}
          >
            <Building2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('labAdmin.stats.assignedBranches')}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
              {stats.coveredBranches} / {branches.length}
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(234, 179, 8, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#eab308',
            }}
          >
            <Star size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('labAdmin.stats.defaultAdmins')}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
              {stats.defaultAdminsCount}
            </div>
          </div>
        </div>
      </div>

      {/* ───── Search & Filter Controls ───── */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 300px', position: 'relative' }}>
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
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('labAdmin.searchPlaceholder')}
            style={{ paddingLeft: '38px', width: '100%', borderRadius: '10px' }}
          />
        </div>

        <div style={{ width: '260px' }}>
          <SearchableSelect
            options={branchFilterOptions}
            value={selectedBranchFilter}
            onChange={(val) => setSelectedBranchFilter(val)}
            placeholder={t('labAdmin.filterBranch')}
            icon={<Building2 size={16} />}
          />
        </div>
      </div>

      {/* ───── Lab Admins Data Table ───── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{t('common.loading')}</div>
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                backgroundColor: 'var(--bg-surface-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                margin: '0 auto 16px',
              }}
            >
              <Users size={28} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)', margin: '0 0 6px' }}>
              {t('labAdmin.table.noAdminsTitle')}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
              {t('labAdmin.table.noAdminsDesc')}
            </p>
            {isTenantAdmin && branches.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleOpenCreateModal}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                <Plus size={16} />
                <span>{t('labAdmin.table.createFirstBtn')}</span>
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '14px 20px', textAlign: 'left' }}>{t('labAdmin.table.admin')}</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left' }}>{t('labAdmin.table.contact')}</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left' }}>{t('labAdmin.table.branch')}</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left' }}>{t('labAdmin.table.role')}</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left' }}>{t('labAdmin.table.status')}</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left' }}>{t('labAdmin.table.created')}</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right' }}>{t('labAdmin.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAdmins.map((admin) => {
                  const initials = admin.name
                    ? admin.name
                        .split(' ')
                        .filter(Boolean)
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                    : 'LA';

                  return (
                    <tr key={admin.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      {/* Name & Avatar */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '10px',
                              backgroundColor: 'rgba(13, 148, 136, 0.15)',
                              color: '#0d9488',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '13px',
                              flexShrink: 0,
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: '14px' }}>
                              {admin.name}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {admin.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-main)' }}>
                        {admin.phone ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                            <span>{admin.phone}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-subtle)' }}>—</span>
                        )}
                      </td>

                      {/* Branch */}
                      <td style={{ padding: '14px 20px' }}>
                        {admin.branch ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Building2 size={14} style={{ color: 'var(--primary-600)' }} />
                            <span style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-heading)' }}>
                              {admin.branch.name}
                            </span>
                            {admin.branch.code && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  backgroundColor: 'var(--bg-surface-muted)',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {admin.branch.code}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-subtle)', fontSize: '13px' }}>
                            {t('labAdmin.table.unassigned')}
                          </span>
                        )}
                      </td>

                      {/* Role & Default Badge */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(13, 148, 136, 0.12)',
                              color: '#0d9488',
                              letterSpacing: '0.02em',
                            }}
                          >
                            Lab Admin
                          </span>
                          {admin.isDefaultAdmin && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(234, 179, 8, 0.15)',
                                color: '#b45309',
                                border: '1px solid rgba(234, 179, 8, 0.3)',
                                letterSpacing: '0.03em',
                              }}
                            >
                              <Star size={10} style={{ fill: '#eab308' }} />
                              {t('labAdmin.table.defaultBadge')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 20px' }}>
                        <span
                          className={`badge ${
                            admin.status === 'ACTIVE'
                              ? 'badge-success'
                              : admin.status === 'INVITED'
                              ? 'badge-warning'
                              : 'badge-danger'
                          }`}
                          style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px' }}
                        >
                          {admin.status === 'ACTIVE'
                            ? t('common.statusActive')
                            : admin.status === 'INVITED'
                            ? 'INVITED'
                            : t('common.statusInactive')}
                        </span>
                      </td>

                      {/* Created Date */}
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        {formatDate(admin.createdAt, { locale: user?.locale || 'en' })}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          {isTenantAdmin && (
                            <Tooltip content={t('labAdmin.table.resendTooltip')}>
                              <button
                                type="button"
                                className="btn-icon"
                                onClick={() => handleResendInvite(admin)}
                                disabled={resendingId === admin.id}
                                style={{
                                  padding: '6px',
                                  borderRadius: '8px',
                                  color: 'var(--primary-600)',
                                  backgroundColor: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                }}
                              >
                                <Send size={15} />
                              </button>
                            </Tooltip>
                          )}

                          {isTenantAdmin && (
                            <Tooltip content={t('labAdmin.table.deleteTooltip')}>
                              <button
                                type="button"
                                className="btn-icon"
                                onClick={() => handleDeleteAdmin(admin)}
                                style={{
                                  padding: '6px',
                                  borderRadius: '8px',
                                  color: 'var(--rose-500)',
                                  backgroundColor: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filteredAdmins.length > pageSize && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)' }}>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              totalItems={filteredAdmins.length}
            />
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ───── CREATE ADMIN MODAL (Exact Design From Screenshot) ───── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {showCreateModal && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) {
              setShowCreateModal(false);
            }
          }}
        >
          <div
            className="card modal-dialog"
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'var(--bg-modal)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border-color)',
              position: 'relative',
              animation: 'modalSlideIn 0.2s ease-out',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h2
                  style={{
                    fontSize: '20px',
                    fontWeight: 800,
                    color: 'var(--text-heading)',
                    margin: '0 0 4px',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  {t('labAdmin.modal.title')}
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  {t('labAdmin.modal.subtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={submitting}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateAdmin}>
              {/* Row 1: First Name * & Last Name (Optional) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-heading)',
                      marginBottom: '6px',
                    }}
                  >
                    {t('labAdmin.modal.firstName')} <span style={{ color: 'var(--rose-500)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="input"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder={t('labAdmin.modal.firstNamePlaceholder')}
                    style={{ width: '100%', borderRadius: '10px' }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-heading)',
                      marginBottom: '6px',
                    }}
                  >
                    {t('labAdmin.modal.lastName')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder={t('labAdmin.modal.lastNamePlaceholder')}
                    style={{ width: '100%', borderRadius: '10px' }}
                  />
                </div>
              </div>

              {/* Row 2: Email * */}
              <div style={{ marginBottom: '14px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-heading)',
                    marginBottom: '6px',
                  }}
                >
                  {t('labAdmin.modal.email')} <span style={{ color: 'var(--rose-500)' }}>*</span>
                </label>
                <input
                  type="email"
                  required
                  className="input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={t('labAdmin.modal.emailPlaceholder')}
                  style={{ width: '100%', borderRadius: '10px' }}
                />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    marginTop: '6px',
                  }}
                >
                  <Mail size={13} style={{ flexShrink: 0, opacity: 0.8 }} />
                  <span>{t('labAdmin.modal.emailHelp')}</span>
                </div>
              </div>

              {/* Row 3: Phone (Optional) */}
              <div style={{ marginBottom: '14px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-heading)',
                    marginBottom: '6px',
                  }}
                >
                  {t('labAdmin.modal.phone')}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '8px' }}>
                  <SearchableSelect
                    options={COUNTRY_DIALING_CODES}
                    value={formData.phoneCountryCode}
                    onChange={(val) => setFormData({ ...formData, phoneCountryCode: val })}
                  />
                  <input
                    type="tel"
                    className="input"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder={t('labAdmin.modal.phonePlaceholder')}
                    style={{ width: '100%', borderRadius: '10px' }}
                  />
                </div>
              </div>

              {/* Row 4: ALL branch * */}
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-heading)',
                    marginBottom: '6px',
                  }}
                >
                  {t('labAdmin.modal.allBranch')} <span style={{ color: 'var(--rose-500)' }}>*</span>
                </label>
                {branches.length > 0 ? (
                  <SearchableSelect
                    options={branchOptions}
                    value={formData.branchId}
                    onChange={(val) => setFormData({ ...formData, branchId: val })}
                    placeholder={t('labAdmin.modal.branchPlaceholder')}
                    icon={<Building2 size={16} />}
                  />
                ) : (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      fontSize: '13px',
                      color: 'var(--amber-600)',
                    }}
                  >
                    {t('labAdmin.branchRequired.emptyBranchHint')}
                  </div>
                )}
              </div>

              {/* Row 5: Default Admin Checkbox */}
              <div
                style={{
                  marginBottom: '22px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-surface-muted)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.isDefaultAdmin}
                    onChange={(e) => setFormData({ ...formData, isDefaultAdmin: e.target.checked })}
                    style={{
                      marginTop: '3px',
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer',
                      accentColor: 'var(--primary-600)',
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                      {t('labAdmin.modal.defaultAdminCheckbox')}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.4' }}>
                      {t('labAdmin.modal.defaultAdminHelp')}
                    </div>
                  </div>
                </label>
              </div>

              {/* Modal Footer Buttons */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  paddingTop: '8px',
                }}
              >
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-heading)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t('labAdmin.modal.cancel')}
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || branches.length === 0}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 18px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: submitting || branches.length === 0 ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(13, 148, 136, 0.25)',
                  }}
                >
                  {submitting ? (
                    <>
                      <Clock size={15} className="animate-spin" />
                      <span>{t('labAdmin.modal.submitting')}</span>
                    </>
                  ) : (
                    <>
                      <Plus size={15} />
                      <span>{t('labAdmin.modal.submit')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
