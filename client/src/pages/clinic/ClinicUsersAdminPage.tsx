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
  Edit2,
  X,
  Star,
  Clock,
  User,
  Users,
} from 'lucide-react';

interface ClinicAdminRecord {
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

export const ClinicUsersAdminPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, isTenantAdmin } = useAuth();
  const { toast } = useToast();

  const [admins, setAdmins] = useState<ClinicAdminRecord[]>([]);
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
  const [editingAdmin, setEditingAdmin] = useState<ClinicAdminRecord | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<ClinicAdminRecord | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Create Form State
  const [createFormData, setCreateFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneCountryCode: '+52',
    phoneNumber: '',
    branchId: '',
    isDefaultAdmin: false,
  });

  // Edit Form State
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    phoneCountryCode: '+52',
    phoneNumber: '',
    branchId: '',
    isDefaultAdmin: false,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  // Parse phone helper
  const parsePhone = (rawPhone?: string) => {
    if (!rawPhone) return { code: '+52', number: '' };
    const match = rawPhone.match(/^(\+\d{1,4})\s*(.*)$/);
    if (match) {
      return { code: match[1], number: match[2] };
    }
    return { code: '+52', number: rawPhone };
  };

  // Debounced search for server sync
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Load Data
  const loadData = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      const [adminsRes, branchesRes] = await Promise.allSettled([
        api.get('/clinic/users/admin', {
          params: {
            branchId: selectedBranchFilter !== 'all' ? selectedBranchFilter : undefined,
            search: debouncedSearch.trim() || undefined,
          },
        }),
        api.get('/branches', {
          params: { moduleKey: 'CLINIC' },
        }),
      ]);

      if (adminsRes.status === 'fulfilled') {
        setAdmins(adminsRes.value.data || []);
      }
      if (branchesRes.status === 'fulfilled') {
        const branchList = branchesRes.value.data || [];
        setBranches(branchList);
        if (!createFormData.branchId && branchList.length > 0) {
          const defaultBranch = branchList.find((b: any) => b.isDefault) || branchList[0];
          setCreateFormData((prev) => ({ ...prev, branchId: defaultBranch.id }));
        }
      }
    } catch (e) {
      console.error('Failed to load clinic admins:', e);
    } finally {
      setLoading(false);
    }
  };

  // Initial load or branch filter switch (with spinner)
  useEffect(() => {
    loadData(false);
  }, [user?.activeTenant?.id, selectedBranchFilter]);

  // Server sync when debounced search changes (background, no spinner)
  useEffect(() => {
    loadData(true);
  }, [debouncedSearch]);

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
      { value: 'all', label: t('clinicAdmin.allBranches', 'All Branches') },
      ...branches.map((b) => ({
        value: b.id,
        label: `${b.name} ${b.code ? `(${b.code})` : ''}`,
      })),
    ];
  }, [branches, t]);

  // Check if selected branch has NO existing admin (Rule 4: Auto-Default Admin)
  const isFirstAdminForSelectedBranch = useMemo(() => {
    if (!createFormData.branchId) return false;
    const existingAdminsForBranch = admins.filter(
      (a) => a.branch?.id === createFormData.branchId,
    );
    return existingAdminsForBranch.length === 0;
  }, [admins, createFormData.branchId]);

  // Automatically enforce default admin flag if first user for branch
  useEffect(() => {
    if (isFirstAdminForSelectedBranch) {
      setCreateFormData((prev) => ({ ...prev, isDefaultAdmin: true }));
    }
  }, [isFirstAdminForSelectedBranch]);

  // Filtered & Paginated Admins (Instant client-side filter)
  const filteredAdmins = useMemo(() => {
    const q = search.toLowerCase().trim();
    return admins.filter((admin) => {
      const matchesBranch =
        selectedBranchFilter === 'all' || admin.branch?.id === selectedBranchFilter;
      const matchesSearch =
        !q ||
        admin.name?.toLowerCase().includes(q) ||
        admin.email?.toLowerCase().includes(q) ||
        (admin.phone && admin.phone.toLowerCase().includes(q)) ||
        (admin.branch?.name && admin.branch.name.toLowerCase().includes(q)) ||
        (admin.branch?.code && admin.branch.code.toLowerCase().includes(q));

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

  // Open Create Modal with Prerequisite Check (Rule 3)
  const handleOpenCreateModal = () => {
    if (branches.length === 0) {
      toast.warning(
        t(
          'clinicAdmin.branchRequired.description',
          'A branch must exist before a Clinic Admin can be created. Please create a branch in organization settings first.',
        ),
        t('clinicAdmin.branchRequired.title', 'Branch Required'),
      );
      return;
    }

    const defaultBranch = branches.find((b) => b.isDefault) || branches[0];
    const initialBranchId = defaultBranch ? defaultBranch.id : '';
    const hasExisting = admins.some((a) => a.branch?.id === initialBranchId);

    setCreateFormData({
      firstName: '',
      lastName: '',
      email: '',
      phoneCountryCode: '+52',
      phoneNumber: '',
      branchId: initialBranchId,
      isDefaultAdmin: !hasExisting,
    });
    setShowCreateModal(true);
  };

  // Submit Create Clinic Admin
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createFormData.firstName.trim()) {
      toast.error(t('clinicAdmin.modal.firstNameRequired', 'First name is required'));
      return;
    }
    if (!createFormData.email.trim()) {
      toast.error(t('clinicAdmin.modal.emailRequired', 'Email is required'));
      return;
    }
    if (!createFormData.branchId) {
      toast.error(t('clinicAdmin.modal.branchRequired', 'Branch selection is required'));
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/clinic/users/admin', createFormData);
      toast.success(
        t('clinicAdmin.alerts.createSuccess', {
          name: `${createFormData.firstName} ${createFormData.lastName}`.trim(),
          defaultValue: 'Clinic Administrator invited successfully. Welcome email dispatched.',
        }),
        t('clinicAdmin.modal.createTitle', 'Clinic Admin Created'),
      );
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        t('clinicAdmin.alerts.createFailed', 'Failed to create Clinic Administrator');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (admin: ClinicAdminRecord) => {
    const parts = admin.name.split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    const { code, number } = parsePhone(admin.phone);

    setEditingAdmin(admin);
    setEditFormData({
      firstName,
      lastName,
      phoneCountryCode: code,
      phoneNumber: number,
      branchId: admin.branch?.id || '',
      isDefaultAdmin: admin.isDefaultAdmin,
      status: admin.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    });
  };

  // Submit Edit Clinic Admin
  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;

    try {
      setSubmitting(true);
      await api.patch(`/clinic/users/admin/${editingAdmin.id}`, editFormData);
      toast.success(
        t('clinicAdmin.alerts.updateSuccess', 'Clinic Administrator updated successfully'),
      );
      setEditingAdmin(null);
      loadData();
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        t('clinicAdmin.alerts.updateFailed', 'Failed to update Clinic Administrator');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Resend Invite Email (Rule 5)
  const handleResendInvite = async (admin: ClinicAdminRecord) => {
    try {
      setResendingId(admin.id);
      await api.post(`/clinic/users/admin/${admin.id}/resend-invite`);
      toast.success(
        t('clinicAdmin.alerts.resendSuccess', {
          email: admin.email,
          defaultValue: `Invitation email resent to ${admin.email}`,
        }),
      );
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        t('clinicAdmin.alerts.resendFailed', 'Failed to resend invitation email');
      toast.error(msg);
    } finally {
      setResendingId(null);
    }
  };

  // Delete Admin
  const handleConfirmDelete = async () => {
    if (!deletingAdmin) return;

    try {
      setSubmitting(true);
      await api.delete(`/clinic/users/admin/${deletingAdmin.id}`);
      toast.success(
        t('clinicAdmin.alerts.deleteSuccess', 'Clinic Administrator removed successfully'),
      );
      setDeletingAdmin(null);
      loadData();
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        t('clinicAdmin.alerts.deleteFailed', 'Failed to remove Clinic Administrator');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
              <ShieldCheck size={20} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {t('clinicAdmin.pageTitle', 'Clinic Administrators')}
            </h1>
          </div>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0 }}>
            {t(
              'clinicAdmin.pageSubtitle',
              'Manage clinic administrators, branch assignments, and administrative access.',
            )}
          </p>
        </div>

        {isTenantAdmin && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenCreateModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 600,
              padding: '10px 18px',
              borderRadius: '8px',
            }}
          >
            <Plus size={18} />
            <span>{t('clinicAdmin.addAdminBtn', 'Add Clinic Admin')}</span>
          </button>
        )}
      </div>

      {/* Control Bar: Search & Branch Filter */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
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
            placeholder={t('clinicAdmin.searchPlaceholder', 'Search administrator by name, email, phone...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '38px', width: '100%', height: '40px', fontSize: '13.5px', borderRadius: '10px' }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Branch Filter */}
        <div style={{ width: '250px' }}>
          <SearchableSelect
            options={branchFilterOptions}
            value={selectedBranchFilter}
            onChange={(val) => setSelectedBranchFilter(val)}
            placeholder={t('clinicAdmin.filterBranch', 'Filter by Branch')}
            icon={<Building2 size={16} />}
          />
        </div>
      </div>

      {/* Admins Table */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: 'hidden',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
        }}
      >
        <div className="table-responsive" style={{ minHeight: '260px' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('clinicAdmin.table.administrator', 'Administrator')}
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('clinicAdmin.table.contact', 'Contact')}
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('clinicAdmin.table.branch', 'Assigned Branch')}
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('clinicAdmin.table.roleType', 'Role / Level')}
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('clinicAdmin.table.status', 'Status')}
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('clinicAdmin.table.created', 'Joined')}
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('clinicAdmin.table.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <Clock className="animate-spin" size={18} />
                      <span>{t('common.loading', 'Loading data...')}</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedAdmins.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '60px 24px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--badge-primary-bg)', color: 'var(--primary-600)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                      <Users size={24} />
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '4px' }}>
                      {t('clinicAdmin.table.emptyTitle', 'No Clinic Administrators Found')}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                      {search || selectedBranchFilter !== 'all'
                        ? t('clinicAdmin.table.emptyFilter', 'Try adjusting your search or branch filters.')
                        : t('clinicAdmin.table.emptyHelp', 'Click "Add Clinic Admin" to provision your first branch administrator.')}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedAdmins.map((admin) => (
                  <tr
                    key={admin.id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    {/* User Name & Avatar */}
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            backgroundColor: admin.isDefaultAdmin ? 'var(--badge-warning-bg)' : 'var(--badge-primary-bg)',
                            color: admin.isDefaultAdmin ? 'var(--amber-600)' : 'var(--primary-600)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '14px',
                            flexShrink: 0,
                          }}
                        >
                          {admin.avatarUrl ? (
                            <img
                              src={admin.avatarUrl}
                              alt={admin.name}
                              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            admin.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-heading)' }}>
                            {admin.name}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {admin.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td style={{ padding: '14px 18px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                          <Mail size={13} />
                          {admin.email}
                        </span>
                        {admin.phone && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                            <Phone size={13} />
                            {admin.phone}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Branch */}
                    <td style={{ padding: '14px 18px' }}>
                      {admin.branch ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-heading)' }}>
                          <Building2 size={13} style={{ color: 'var(--primary-600)' }} />
                          <span>{admin.branch.name}</span>
                          {admin.branch.code && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              ({admin.branch.code})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12.5px' }}>—</span>
                      )}
                    </td>

                    {/* Role Level / Default Admin Badge (Rule 3 & 4) */}
                    <td style={{ padding: '14px 18px' }}>
                      {admin.isDefaultAdmin ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            background: '#fef3c7',
                            color: '#b45309',
                            border: '1px solid #fde68a',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            letterSpacing: '0.02em',
                          }}
                        >
                          <Star size={12} fill="#b45309" />
                          {t('clinicAdmin.defaultAdminBadge', 'Default Admin')}
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 9px',
                            borderRadius: '20px',
                            background: 'var(--badge-primary-bg)',
                            color: 'var(--primary-600)',
                            fontSize: '11.5px',
                            fontWeight: 600,
                          }}
                        >
                          {t('clinicAdmin.secondaryAdminBadge', 'Clinic Admin')}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 18px' }}>
                      <span
                        className={`badge ${
                          admin.status === 'ACTIVE'
                            ? 'badge-success'
                            : admin.status === 'INVITED'
                            ? 'badge-warning'
                            : 'badge-danger'
                        }`}
                        style={{ fontSize: '11.5px', fontWeight: 600, padding: '4px 8px', borderRadius: '6px' }}
                      >
                        {admin.status}
                      </span>
                    </td>

                    {/* Created Date */}
                    <td style={{ padding: '14px 18px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      {formatDate(admin.createdAt)}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {/* Resend Invite */}
                        <Tooltip content={t('clinicAdmin.actions.resendInvite', 'Resend Welcome Email')}>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => handleResendInvite(admin)}
                            disabled={resendingId === admin.id}
                            style={{ padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Send size={14} className={resendingId === admin.id ? 'animate-spin' : ''} />
                          </button>
                        </Tooltip>

                        {/* Edit Admin */}
                        {isTenantAdmin && (
                          <Tooltip content={t('clinicAdmin.actions.edit', 'Edit Administrator')}>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => handleOpenEdit(admin)}
                              style={{ padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Edit2 size={14} />
                            </button>
                          </Tooltip>
                        )}

                        {/* Delete Admin */}
                        {isTenantAdmin && (
                          <Tooltip content={t('clinicAdmin.actions.delete', 'Remove Administrator')}>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => setDeletingAdmin(admin)}
                              style={{ padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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

        {/* Pagination Footer */}
        {filteredAdmins.length > 0 && (
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
            totalItems={filteredAdmins.length}
          />
        )}
      </div>

      {/* ========================================================================= */}
      {/* CREATE CLINIC ADMIN MODAL (Enforces Rule 3, Rule 4, Rule 5)               */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px',
          }}
        >
          <div
            className="modal-content"
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--badge-primary-bg)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-heading)' }}>
                  {t('clinicAdmin.createModal.title', 'Invite Clinic Administrator')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* First & Last Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                      {t('clinicAdmin.modal.firstName', 'First Name')} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Maria"
                      value={createFormData.firstName}
                      onChange={(e) => setCreateFormData({ ...createFormData, firstName: e.target.value })}
                      required
                      style={{ width: '100%', height: '40px' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                      {t('clinicAdmin.modal.lastName', 'Last Name')}
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Gonzalez"
                      value={createFormData.lastName}
                      onChange={(e) => setCreateFormData({ ...createFormData, lastName: e.target.value })}
                      style={{ width: '100%', height: '40px' }}
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                    {t('clinicAdmin.modal.email', 'Email Address')} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    className="input"
                    placeholder="maria.gonzalez@clinic.com"
                    value={createFormData.email}
                    onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                    required
                    style={{ width: '100%', height: '40px' }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    {t('clinicAdmin.modal.emailHelp', 'A welcome invite with password setup instructions will be dispatched to this address.')}
                  </span>
                </div>

                {/* Phone with Standard Country Dialing Code (Mexico +52 default) */}
                <div>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                    {t('clinicAdmin.modal.phone', 'Phone Number')}
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ width: '90px', flexShrink: 0 }}>
                      <SearchableSelect
                        options={COUNTRY_DIALING_CODES}
                        value={createFormData.phoneCountryCode}
                        onChange={(val) => setCreateFormData({ ...createFormData, phoneCountryCode: val })}
                      />
                    </div>
                    <input
                      type="tel"
                      className="input"
                      placeholder="55 1234 5678"
                      value={createFormData.phoneNumber}
                      onChange={(e) => setCreateFormData({ ...createFormData, phoneNumber: e.target.value })}
                      style={{ flex: 1, width: '100%', height: '40px' }}
                    />
                  </div>
                </div>

                {/* Branch Selection (Rule 3) */}
                <div>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                    {t('clinicAdmin.modal.branch', 'Assigned Branch')} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <SearchableSelect
                    options={branchOptions}
                    value={createFormData.branchId}
                    onChange={(val) => setCreateFormData({ ...createFormData, branchId: val })}
                    placeholder={t('clinicAdmin.modal.selectBranch', 'Select branch...')}
                  />
                </div>

                {/* Default Admin Option (Rule 4: Auto-Designated for first user) */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: isFirstAdminForSelectedBranch ? '#fef3c7' : 'var(--bg-secondary)',
                    border: `1px solid ${isFirstAdminForSelectedBranch ? '#fde68a' : 'var(--border-color)'}`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}
                >
                  <input
                    type="checkbox"
                    id="isDefaultAdminCreate"
                    checked={createFormData.isDefaultAdmin}
                    disabled={isFirstAdminForSelectedBranch}
                    onChange={(e) => setCreateFormData({ ...createFormData, isDefaultAdmin: e.target.checked })}
                    style={{ marginTop: '3px', cursor: isFirstAdminForSelectedBranch ? 'not-allowed' : 'pointer' }}
                  />
                  <div>
                    <label
                      htmlFor="isDefaultAdminCreate"
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: isFirstAdminForSelectedBranch ? '#92400e' : 'var(--text-heading)',
                        cursor: isFirstAdminForSelectedBranch ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Star size={13} fill={isFirstAdminForSelectedBranch ? '#92400e' : 'currentColor'} />
                      <span>{t('clinicAdmin.modal.defaultAdminLabel', 'Set as Default Clinic Admin')}</span>
                    </label>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: isFirstAdminForSelectedBranch ? '#b45309' : 'var(--text-muted)' }}>
                      {isFirstAdminForSelectedBranch
                        ? t(
                            'clinicAdmin.modal.firstAdminAutoDefaultNote',
                            'First administrator for this branch is automatically designated as the Default Admin.',
                          )
                        : t(
                            'clinicAdmin.modal.defaultAdminNote',
                            'Every branch must have one default administrator. Selecting this will assign this administrator as the primary branch head.',
                          )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '14px 24px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  backgroundColor: 'var(--bg-secondary)',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {submitting ? (
                    <>
                      <Clock className="animate-spin" size={16} />
                      <span>{t('common.sending', 'Sending Invite...')}</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>{t('clinicAdmin.modal.sendInviteBtn', 'Send Welcome Invite')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT CLINIC ADMIN MODAL                                                   */}
      {/* ========================================================================= */}
      {editingAdmin && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px',
          }}
        >
          <div
            className="modal-content"
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-heading)' }}>
                {t('clinicAdmin.editModal.title', 'Edit Clinic Administrator')}
              </h3>
              <button
                type="button"
                onClick={() => setEditingAdmin(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateAdmin}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                      {t('clinicAdmin.modal.firstName', 'First Name')}
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={editFormData.firstName}
                      onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                      required
                      style={{ width: '100%', height: '40px' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                      {t('clinicAdmin.modal.lastName', 'Last Name')}
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={editFormData.lastName}
                      onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                      style={{ width: '100%', height: '40px' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                    {t('clinicAdmin.modal.phone', 'Phone Number')}
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ width: '90px', flexShrink: 0 }}>
                      <SearchableSelect
                        options={COUNTRY_DIALING_CODES}
                        value={editFormData.phoneCountryCode}
                        onChange={(val) => setEditFormData({ ...editFormData, phoneCountryCode: val })}
                      />
                    </div>
                    <input
                      type="tel"
                      className="input"
                      value={editFormData.phoneNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
                      style={{ flex: 1, width: '100%', height: '40px' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                    {t('clinicAdmin.modal.branch', 'Assigned Branch')}
                  </label>
                  <SearchableSelect
                    options={branchOptions}
                    value={editFormData.branchId}
                    onChange={(val) => setEditFormData({ ...editFormData, branchId: val })}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    id="isDefaultAdminEdit"
                    checked={editFormData.isDefaultAdmin}
                    onChange={(e) => setEditFormData({ ...editFormData, isDefaultAdmin: e.target.checked })}
                  />
                  <label htmlFor="isDefaultAdminEdit" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    {t('clinicAdmin.modal.defaultAdminLabel', 'Set as Default Clinic Admin for this Branch')}
                  </label>
                </div>
              </div>

              <div
                style={{
                  padding: '14px 24px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  backgroundColor: 'var(--bg-secondary)',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingAdmin(null)}
                  disabled={submitting}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? t('common.saving', 'Saving...') : t('common.saveChanges', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL                                                 */}
      {/* ========================================================================= */}
      {deletingAdmin && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px',
          }}
        >
          <div
            className="modal-content"
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--badge-danger-bg)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={22} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)' }}>
                {t('clinicAdmin.deleteModal.title', 'Remove Clinic Administrator?')}
              </h3>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 16px' }}>
              {t(
                'clinicAdmin.deleteModal.confirmText',
                'Are you sure you want to remove administrator "{{name}}"? This will revoke their access to the organization and branch.',
                { name: deletingAdmin.name },
              )}
            </p>

            {deletingAdmin.isDefaultAdmin && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', fontSize: '12.5px', marginBottom: '16px' }}>
                <strong>Note:</strong> This administrator is currently designated as the Default Admin for branch "{deletingAdmin.branch?.name}".
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingAdmin(null)}
                disabled={submitting}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={submitting}
              >
                {submitting ? t('common.deleting', 'Removing...') : t('common.confirmDelete', 'Remove Administrator')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
