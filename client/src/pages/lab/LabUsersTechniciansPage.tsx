import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import { SearchableSelect, SearchableSelectOption } from '../../components/common/SearchableSelect';
import { Tooltip } from '../../components/common/Tooltip';
import { Pagination } from '../../components/common/Pagination';
import { formatDate } from '../../core/utils/dateUtils';
import {
  UserCog,
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Send,
  Trash2,
  Edit2,
  X,
  Clock,
  User,
  Users,
} from 'lucide-react';

interface LabTechnicianRecord {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  status: 'ACTIVE' | 'INVITED' | 'INACTIVE';
  avatarUrl?: string;
  createdAt: string;
  branch: {
    id: string;
    name: string;
    code?: string;
  } | null;
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

export const LabUsersTechniciansPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, isTenantAdmin } = useAuth();
  const { toast } = useToast();

  const isLabAdmin = Boolean(
    !isTenantAdmin &&
      user?.roles?.some((r) => {
        const lower = r.toLowerCase();
        return lower === 'lab admin' || lower === 'lab-admin';
      }),
  );

  const [technicians, setTechnicians] = useState<LabTechnicianRecord[]>([]);
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
  const [editingTechnician, setEditingTechnician] = useState<LabTechnicianRecord | null>(null);
  const [deletingTechnician, setDeletingTechnician] = useState<LabTechnicianRecord | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Create Form State matching screenshot
  const [createFormData, setCreateFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneCountryCode: '+52',
    phoneNumber: '',
  });

  // Edit Form State
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    phoneCountryCode: '+52',
    phoneNumber: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const parsePhone = (rawPhone?: string) => {
    if (!rawPhone) return { code: '+52', number: '' };
    const match = rawPhone.match(/^(\+\d{1,4})\s*(.*)$/);
    if (match) {
      return { code: match[1], number: match[2] };
    }
    return { code: '+52', number: rawPhone };
  };

  // Load Technicians Data
  const loadData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (isTenantAdmin && selectedBranchFilter !== 'all') {
        params.branchId = selectedBranchFilter;
      }
      if (search) {
        params.search = search;
      }

      const [techRes, branchesRes] = await Promise.allSettled([
        api.get('/lab/users/technicians', { params }),
        isTenantAdmin ? api.get('/branches', { params: { moduleKey: 'LAB' } }) : Promise.resolve({ data: [] }),
      ]);

      if (techRes.status === 'fulfilled') {
        setTechnicians(techRes.value.data || []);
      }
      if (branchesRes.status === 'fulfilled') {
        setBranches(branchesRes.value.data || []);
      }
    } catch (e) {
      console.error('Failed to load lab technicians:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.activeTenant?.id, selectedBranchFilter, search]);

  const branchFilterOptions: SearchableSelectOption[] = useMemo(() => {
    return [
      { value: 'all', label: t('labTechnicians.allBranches') },
      ...branches.map((b) => ({
        value: b.id,
        label: `${b.name} ${b.code ? `(${b.code})` : ''}`,
      })),
    ];
  }, [branches, t]);

  // Filtered & Paginated Technicians
  const filteredTechnicians = useMemo(() => {
    return technicians.filter((tech) => {
      const matchesBranch =
        !isTenantAdmin ||
        selectedBranchFilter === 'all' ||
        tech.branch?.id === selectedBranchFilter;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        tech.name.toLowerCase().includes(q) ||
        tech.email.toLowerCase().includes(q) ||
        (tech.phone && tech.phone.toLowerCase().includes(q)) ||
        (tech.branch?.name && tech.branch.name.toLowerCase().includes(q));

      return matchesBranch && matchesSearch;
    });
  }, [technicians, selectedBranchFilter, search, isTenantAdmin]);

  const totalPages = Math.max(1, Math.ceil(filteredTechnicians.length / pageSize));
  const paginatedTechnicians = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTechnicians.slice(start, start + pageSize);
  }, [filteredTechnicians, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedBranchFilter]);

  // Handle Create Technician (Lab Admin only)
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.firstName.trim() || !createFormData.lastName.trim() || !createFormData.email.trim()) {
      toast.warning('Please enter first name, last name, and a valid email address.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/lab/users/technicians', {
        firstName: createFormData.firstName.trim(),
        lastName: createFormData.lastName.trim(),
        email: createFormData.email.trim(),
        phoneCountryCode: createFormData.phoneCountryCode,
        phoneNumber: createFormData.phoneNumber.trim() || undefined,
      });

      toast.success(
        t('labTechnicians.alerts.createSuccess', {
          name: `${createFormData.firstName.trim()} ${createFormData.lastName.trim()}`,
        }),
      );

      setShowCreateModal(false);
      setCreateFormData({
        firstName: '',
        lastName: '',
        email: '',
        phoneCountryCode: '+52',
        phoneNumber: '',
      });
      loadData();
    } catch (err: any) {
      const errMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        t('labTechnicians.alerts.createFailed');
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal (Lab Admin only)
  const handleOpenEditModal = (tech: LabTechnicianRecord) => {
    const parsed = parsePhone(tech.phone);
    const parts = (tech.name || '').trim().split(' ');
    const first = tech.firstName || parts[0] || '';
    const last = tech.lastName || parts.slice(1).join(' ') || '';

    setEditingTechnician(tech);
    setEditFormData({
      firstName: first,
      lastName: last,
      phoneCountryCode: parsed.code,
      phoneNumber: parsed.number,
      status: tech.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    });
  };

  // Submit Edit Technician
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTechnician) return;

    try {
      setSubmitting(true);
      await api.patch(`/lab/users/technicians/${editingTechnician.id}`, {
        firstName: editFormData.firstName.trim() || undefined,
        lastName: editFormData.lastName.trim() || undefined,
        phoneCountryCode: editFormData.phoneCountryCode,
        phoneNumber: editFormData.phoneNumber.trim() || undefined,
        status: editFormData.status,
      });

      toast.success(t('labTechnicians.alerts.updateSuccess'));
      setEditingTechnician(null);
      loadData();
    } catch (err: any) {
      const errMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        t('labTechnicians.alerts.updateFailed');
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Resend Invite Email
  const handleResendInvite = async (tech: LabTechnicianRecord) => {
    try {
      setResendingId(tech.id);
      await api.post(`/lab/users/technicians/${tech.id}/resend-invite`);
      toast.success(t('labTechnicians.alerts.resendSuccess', { email: tech.email }));
    } catch (err: any) {
      const errMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        t('labTechnicians.alerts.resendFailed');
      toast.error(errMsg);
    } finally {
      setResendingId(null);
    }
  };

  // Delete Technician (Tenant Admin only)
  const handleDeleteConfirm = async () => {
    if (!deletingTechnician) return;
    try {
      setSubmitting(true);
      await api.delete(`/lab/users/technicians/${deletingTechnician.id}`);
      toast.success(t('labTechnicians.alerts.deleteSuccess'));
      setDeletingTechnician(null);
      loadData();
    } catch (err: any) {
      const errMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        t('labTechnicians.alerts.deleteFailed');
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const activeCount = technicians.filter((t) => t.status === 'ACTIVE').length;

  return (
    <div style={{ paddingBottom: '32px' }}>
      {/* Header Section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
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
              <UserCog size={20} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {t('labTechnicians.pageTitle')}
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            {t('labTechnicians.pageDesc')}
          </p>
        </div>

        {/* Action Button: Lab Admin can create technician */}
        {isLabAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontWeight: 700,
              fontSize: '13px',
              borderRadius: '9px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Plus size={16} />
            <span>{t('labTechnicians.createBtn')}</span>
          </button>
        )}
      </div>

      {/* Metric Cards Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px' }}>
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
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('labTechnicians.stats.totalTechnicians')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
              {loading ? '...' : technicians.length}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'var(--badge-success-bg)',
              color: 'var(--emerald-500)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('labTechnicians.stats.activeTechnicians')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
              {loading ? '...' : activeCount}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'var(--badge-info-bg)',
              color: 'var(--sky-500)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Building2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('labTechnicians.stats.branchScope')}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
              {isLabAdmin ? user?.availableBranches?.[0]?.name || 'Current Branch' : t('labTechnicians.allBranches')}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '14px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-subtle)',
            }}
          />
          <input
            type="text"
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('labTechnicians.searchPlaceholder')}
            style={{ paddingLeft: '36px', width: '100%', height: '38px', fontSize: '13px' }}
          />
        </div>

        {/* Tenant Admin gets Branch Filter dropdown */}
        {isTenantAdmin && branches.length > 0 && (
          <div style={{ width: '220px' }}>
            <SearchableSelect
              options={branchFilterOptions}
              value={selectedBranchFilter}
              onChange={(val) => setSelectedBranchFilter(val)}
              placeholder={t('labTechnicians.filterBranch')}
            />
          </div>
        )}
      </div>

      {/* Technicians Data Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--table-th-bg)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textAlign: 'left', color: 'var(--table-th-text)' }}>
                  {t('labTechnicians.table.technician')}
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textAlign: 'left', color: 'var(--table-th-text)' }}>
                  {t('labTechnicians.table.branch')}
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textAlign: 'left', color: 'var(--table-th-text)' }}>
                  {t('labTechnicians.table.contact')}
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textAlign: 'left', color: 'var(--table-th-text)' }}>
                  {t('labTechnicians.table.status')}
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textAlign: 'left', color: 'var(--table-th-text)' }}>
                  {t('labTechnicians.table.created')}
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textAlign: 'right', color: 'var(--table-th-text)' }}>
                  {t('labTechnicians.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{t('common.loading')}</div>
                  </td>
                </tr>
              ) : paginatedTechnicians.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '50px 20px', textAlign: 'center' }}>
                    <div
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-surface-hover)',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 12px',
                      }}
                    >
                      <UserCog size={26} />
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                      {t('labTechnicians.table.noTechniciansTitle')}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 auto 16px', maxWidth: '400px' }}>
                      {t('labTechnicians.table.noTechniciansDesc')}
                    </p>
                    {isLabAdmin && (
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Plus size={14} />
                        <span>{t('labTechnicians.table.createFirstBtn')}</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedTechnicians.map((tech) => {
                  const initials = tech.name
                    ? tech.name
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                    : 'LT';

                  return (
                    <tr
                      key={tech.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--table-row-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Technician Identity */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '10px',
                              backgroundColor: 'var(--badge-primary-bg)',
                              color: 'var(--primary-600)',
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
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                              {tech.name}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <Mail size={12} /> {tech.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Branch Scope */}
                      <td style={{ padding: '14px 16px' }}>
                        {tech.branch ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Building2 size={14} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                              {tech.branch.name}
                            </span>
                            {tech.branch.code && (
                              <span className="badge badge-info" style={{ fontSize: '10px', padding: '1px 5px' }}>
                                {tech.branch.code}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>—</span>
                        )}
                      </td>

                      {/* Contact Info */}
                      <td style={{ padding: '14px 16px' }}>
                        {tech.phone ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
                            <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                            <span>{tech.phone}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        {tech.status === 'ACTIVE' ? (
                          <span className="badge badge-success" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={11} />
                            {t('common.statusActive')}
                          </span>
                        ) : tech.status === 'INVITED' ? (
                          <span className="badge badge-warning" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={11} />
                            Invited
                          </span>
                        ) : (
                          <span className="badge badge-danger" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={11} />
                            {t('common.statusInactive')}
                          </span>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {formatDate(tech.createdAt)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          {/* Lab Admin can edit */}
                          {isLabAdmin && (
                            <Tooltip content={t('labTechnicians.table.editTooltip')}>
                              <button
                                onClick={() => handleOpenEditModal(tech)}
                                className="btn btn-icon btn-sm"
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '8px',
                                  backgroundColor: 'var(--bg-surface-hover)',
                                  color: 'var(--text-main)',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                }}
                              >
                                <Edit2 size={14} />
                              </button>
                            </Tooltip>
                          )}

                          {/* Lab Admin can resend invitation email */}
                          {isLabAdmin && (
                            <Tooltip content={t('labTechnicians.table.resendTooltip')}>
                              <button
                                onClick={() => handleResendInvite(tech)}
                                disabled={resendingId === tech.id}
                                className="btn btn-icon btn-sm"
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '8px',
                                  backgroundColor: 'var(--bg-surface-hover)',
                                  color: 'var(--primary-600)',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: resendingId === tech.id ? 'not-allowed' : 'pointer',
                                  opacity: resendingId === tech.id ? 0.6 : 1,
                                }}
                              >
                                <Send size={14} />
                              </button>
                            </Tooltip>
                          )}

                          {/* Tenant Admin only can delete */}
                          {isTenantAdmin && (
                            <Tooltip content={t('labTechnicians.table.deleteTooltip')}>
                              <button
                                onClick={() => setDeletingTechnician(tech)}
                                className="btn btn-icon btn-sm"
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '8px',
                                  backgroundColor: 'var(--badge-danger-bg)',
                                  color: 'var(--rose-600)',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredTechnicians.length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredTechnicians.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* ─── CREATE TECHNICIAN MODAL (Pixel-Perfect Screenshot Fidelity) ─── */}
      {/* ────────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-xl)',
              backgroundColor: 'var(--bg-modal)',
              border: '1px solid var(--border-color)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 4px' }}>
                  {t('labTechnicians.modal.title')}
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  {t('labTechnicians.modal.subtitle')}
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-icon btn-sm"
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateSubmit}>
              {/* Row: First Name & Last Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    {t('labTechnicians.modal.firstName')} <span style={{ color: 'var(--rose-500)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="input"
                    value={createFormData.firstName}
                    onChange={(e) => setCreateFormData({ ...createFormData, firstName: e.target.value })}
                    placeholder={t('labTechnicians.modal.firstNamePlaceholder')}
                    style={{ width: '100%', height: '40px', fontSize: '13px', borderRadius: '10px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    {t('labTechnicians.modal.lastName')} <span style={{ color: 'var(--rose-500)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="input"
                    value={createFormData.lastName}
                    onChange={(e) => setCreateFormData({ ...createFormData, lastName: e.target.value })}
                    placeholder={t('labTechnicians.modal.lastNamePlaceholder')}
                    style={{ width: '100%', height: '40px', fontSize: '13px', borderRadius: '10px' }}
                  />
                </div>
              </div>

              {/* Email */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  {t('labTechnicians.modal.email')} <span style={{ color: 'var(--rose-500)' }}>*</span>
                </label>
                <input
                  type="email"
                  required
                  className="input"
                  value={createFormData.email}
                  onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                  placeholder={t('labTechnicians.modal.emailPlaceholder')}
                  style={{ width: '100%', height: '40px', fontSize: '13px', borderRadius: '10px' }}
                />
              </div>

              {/* Phone with Country Code Selector */}
              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  {t('labTechnicians.modal.phone')}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ width: '90px', flexShrink: 0 }}>
                    <SearchableSelect
                      options={COUNTRY_DIALING_CODES}
                      value={createFormData.phoneCountryCode}
                      onChange={(val) => setCreateFormData({ ...createFormData, phoneCountryCode: val })}
                      placeholder="+52"
                    />
                  </div>
                  <input
                    type="tel"
                    className="input"
                    value={createFormData.phoneNumber}
                    onChange={(e) => setCreateFormData({ ...createFormData, phoneNumber: e.target.value })}
                    placeholder={t('labTechnicians.modal.phonePlaceholder')}
                    style={{ flex: 1, height: '40px', fontSize: '13px', borderRadius: '10px' }}
                  />
                </div>
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', marginBottom: '18px' }} />

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                  style={{
                    padding: '8px 18px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {t('labTechnicians.modal.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{
                    padding: '8px 20px',
                    fontSize: '13px',
                    fontWeight: 700,
                    borderRadius: '10px',
                    boxShadow: 'var(--shadow-sm)',
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? t('labTechnicians.modal.submitting') : t('labTechnicians.modal.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* ─── EDIT TECHNICIAN MODAL ─── */}
      {/* ────────────────────────────────────────────────────────── */}
      {editingTechnician && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-xl)',
              backgroundColor: 'var(--bg-modal)',
              border: '1px solid var(--border-color)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 4px' }}>
                  {t('labTechnicians.modal.editTitle')}
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  {editingTechnician.email}
                </p>
              </div>
              <button
                onClick={() => setEditingTechnician(null)}
                className="btn btn-icon btn-sm"
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              {/* Row: First Name & Last Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    {t('labTechnicians.modal.firstName')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={editFormData.firstName}
                    onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                    style={{ width: '100%', height: '40px', fontSize: '13px', borderRadius: '10px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    {t('labTechnicians.modal.lastName')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={editFormData.lastName}
                    onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                    style={{ width: '100%', height: '40px', fontSize: '13px', borderRadius: '10px' }}
                  />
                </div>
              </div>

              {/* Phone */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  {t('labTechnicians.modal.phone')}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ width: '90px', flexShrink: 0 }}>
                    <SearchableSelect
                      options={COUNTRY_DIALING_CODES}
                      value={editFormData.phoneCountryCode}
                      onChange={(val) => setEditFormData({ ...editFormData, phoneCountryCode: val })}
                      placeholder="+52"
                    />
                  </div>
                  <input
                    type="tel"
                    className="input"
                    value={editFormData.phoneNumber}
                    onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
                    style={{ flex: 1, height: '40px', fontSize: '13px', borderRadius: '10px' }}
                  />
                </div>
              </div>

              {/* Status Toggle */}
              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  {t('labTechnicians.modal.status')}
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setEditFormData({ ...editFormData, status: 'ACTIVE' })}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: editFormData.status === 'ACTIVE' ? '2px solid var(--primary-600)' : '1px solid var(--border-color)',
                      backgroundColor: editFormData.status === 'ACTIVE' ? 'var(--badge-primary-bg)' : 'var(--bg-surface)',
                      color: editFormData.status === 'ACTIVE' ? 'var(--primary-600)' : 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {t('common.statusActive')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditFormData({ ...editFormData, status: 'INACTIVE' })}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: editFormData.status === 'INACTIVE' ? '2px solid var(--rose-600)' : '1px solid var(--border-color)',
                      backgroundColor: editFormData.status === 'INACTIVE' ? 'var(--badge-danger-bg)' : 'var(--bg-surface)',
                      color: editFormData.status === 'INACTIVE' ? 'var(--rose-600)' : 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {t('common.statusInactive')}
                  </button>
                </div>
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', marginBottom: '18px' }} />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingTechnician(null)}
                  className="btn btn-secondary"
                  style={{
                    padding: '8px 18px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {t('labTechnicians.modal.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{
                    padding: '8px 20px',
                    fontSize: '13px',
                    fontWeight: 700,
                    borderRadius: '10px',
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? t('labTechnicians.modal.saving') : t('labTechnicians.modal.saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* ─── DELETE TECHNICIAN MODAL (Tenant Admin only) ─── */}
      {/* ────────────────────────────────────────────────────────── */}
      {deletingTechnician && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '24px',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-xl)',
              backgroundColor: 'var(--bg-modal)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'var(--badge-danger-bg)',
                color: 'var(--rose-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <Trash2 size={22} />
            </div>

            <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 6px' }}>
              {t('labTechnicians.deleteModal.title')}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
              {t('labTechnicians.deleteModal.confirm', { name: deletingTechnician.name })}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--rose-600)', margin: '0 0 20px', fontWeight: 600 }}>
              {t('labTechnicians.deleteModal.warning')}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeletingTechnician(null)}
                className="btn btn-secondary"
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeleteConfirm}
                className="btn btn-danger"
                style={{
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  borderRadius: '10px',
                  backgroundColor: 'var(--rose-600)',
                  color: '#ffffff',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {t('labTechnicians.deleteModal.confirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default LabUsersTechniciansPage;
