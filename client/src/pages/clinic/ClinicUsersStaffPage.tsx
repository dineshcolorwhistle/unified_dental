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
  UserCheck,
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
  Users,
  ShieldAlert,
} from 'lucide-react';

interface ClinicStaffRecord {
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

export const ClinicUsersStaffPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, isTenantAdmin } = useAuth();
  const { toast } = useToast();

  const isClinicAdmin = Boolean(
    !isTenantAdmin &&
      user?.roles?.some((r) => {
        const lower = r.toLowerCase();
        return lower === 'clinic admin' || lower === 'clinic-admin';
      }),
  );

  const [staffList, setStaffList] = useState<ClinicStaffRecord[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingStaff, setEditingStaff] = useState<ClinicStaffRecord | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<ClinicStaffRecord | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Create Form State
  const [createFormData, setCreateFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneCountryCode: '+52',
    phoneNumber: '',
    roleTitle: '',
  });

  // Edit Form State
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    phoneCountryCode: '+52',
    phoneNumber: '',
    roleTitle: '',
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

  // Debounced search for server sync
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const loadData = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      const [staffRes, branchesRes] = await Promise.allSettled([
        api.get('/clinic/users/staff', {
          params: {
            branchId: isTenantAdmin && selectedBranchFilter !== 'all' ? selectedBranchFilter : undefined,
            search: debouncedSearch.trim() || undefined,
          },
        }),
        api.get('/branches', {
          params: { moduleKey: 'CLINIC' },
        }),
      ]);

      if (staffRes.status === 'fulfilled') {
        setStaffList(staffRes.value.data || []);
      }
      if (branchesRes.status === 'fulfilled') {
        setBranches(branchesRes.value.data || []);
      }
    } catch (e) {
      console.error('Failed to load clinic staff:', e);
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

  const branchFilterOptions: SearchableSelectOption[] = useMemo(() => {
    return [
      { value: 'all', label: t('clinicStaff.allBranches', 'All Branches') },
      ...branches.map((b) => ({
        value: b.id,
        label: `${b.name} ${b.code ? `(${b.code})` : ''}`,
      })),
    ];
  }, [branches, t]);

  // Filtered & Paginated Staff (Instant client-side filter)
  const filteredStaff = useMemo(() => {
    const q = search.toLowerCase().trim();
    return staffList.filter((s) => {
      const matchesBranch =
        selectedBranchFilter === 'all' || s.branch?.id === selectedBranchFilter;
      const matchesSearch =
        !q ||
        s.name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        (s.phone && s.phone.toLowerCase().includes(q)) ||
        (s.branch?.name && s.branch.name.toLowerCase().includes(q)) ||
        (s.branch?.code && s.branch.code.toLowerCase().includes(q));

      return matchesBranch && matchesSearch;
    });
  }, [staffList, selectedBranchFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / pageSize));
  const paginatedStaff = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStaff.slice(start, start + pageSize);
  }, [filteredStaff, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedBranchFilter]);

  const handleOpenCreateModal = () => {
    setCreateFormData({
      firstName: '',
      lastName: '',
      email: '',
      phoneCountryCode: '+52',
      phoneNumber: '',
      roleTitle: '',
    });
    setShowCreateModal(true);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createFormData.firstName.trim()) {
      toast.error(t('clinicStaff.modal.firstNameRequired', 'First name is required'));
      return;
    }
    if (!createFormData.lastName.trim()) {
      toast.error(t('clinicStaff.modal.lastNameRequired', 'Last name is required'));
      return;
    }
    if (!createFormData.email.trim()) {
      toast.error(t('clinicStaff.modal.emailRequired', 'Email is required'));
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/clinic/users/staff', createFormData);
      toast.success(
        t('clinicStaff.alerts.createSuccess', {
          name: `${createFormData.firstName} ${createFormData.lastName}`.trim(),
          defaultValue: 'Clinic Staff member added successfully. Welcome email dispatched.',
        }),
        t('clinicStaff.modal.createTitle', 'Staff Member Added'),
      );
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        t('clinicStaff.alerts.createFailed', 'Failed to create Staff member');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (staff: ClinicStaffRecord) => {
    const parts = staff.name.split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    const { code, number } = parsePhone(staff.phone);

    setEditingStaff(staff);
    setEditFormData({
      firstName,
      lastName,
      phoneCountryCode: code,
      phoneNumber: number,
      roleTitle: '',
      status: staff.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    });
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    try {
      setSubmitting(true);
      await api.patch(`/clinic/users/staff/${editingStaff.id}`, editFormData);
      toast.success(
        t('clinicStaff.alerts.updateSuccess', 'Clinic Staff profile updated successfully'),
      );
      setEditingStaff(null);
      loadData();
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        t('clinicStaff.alerts.updateFailed', 'Failed to update Staff member');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendInvite = async (staff: ClinicStaffRecord) => {
    try {
      setResendingId(staff.id);
      await api.post(`/clinic/users/staff/${staff.id}/resend-invite`);
      toast.success(
        t('clinicStaff.alerts.resendSuccess', {
          email: staff.email,
          defaultValue: `Invitation email resent to ${staff.email}`,
        }),
      );
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        t('clinicStaff.alerts.resendFailed', 'Failed to resend invitation email');
      toast.error(msg);
    } finally {
      setResendingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingStaff) return;

    try {
      setSubmitting(true);
      await api.delete(`/clinic/users/staff/${deletingStaff.id}`);
      toast.success(
        t('clinicStaff.alerts.deleteSuccess', 'Clinic Staff member removed successfully'),
      );
      setDeletingStaff(null);
      loadData();
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        t('clinicStaff.alerts.deleteFailed', 'Failed to remove Staff member');
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
              <UserCheck size={20} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {t('clinicStaff.pageTitle', 'Clinic Staff Members')}
            </h1>
          </div>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0 }}>
            {t(
              'clinicStaff.pageSubtitle',
              'Manage dental assistants, hygienists, receptionists, and frontline personnel.',
            )}
          </p>
        </div>

        {/* Add Staff Button (Rule 1 & Rule 2) */}
        <div>
          {isTenantAdmin ? (
            <Tooltip
              content={t(
                'clinicStaff.rule1Notice',
                'Tenant Admins cannot create Staff users. Staff must be created by the branch Clinic Admin.',
              )}
            >
              <span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 600,
                    padding: '10px 18px',
                    borderRadius: '8px',
                    opacity: 0.65,
                    cursor: 'not-allowed',
                  }}
                >
                  <ShieldAlert size={17} />
                  <span>{t('clinicStaff.addStaffBtn', 'Add Staff Member')}</span>
                </button>
              </span>
            </Tooltip>
          ) : (
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
              <span>{t('clinicStaff.addStaffBtn', 'Add Staff Member')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Control Bar */}
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
            placeholder={t('clinicStaff.searchPlaceholder', 'Search staff by name, email, phone...')}
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

        {/* Branch Filter (for Tenant Admin) or Current Branch Indicator (for Clinic Admin) */}
        {isTenantAdmin ? (
          <div style={{ width: '250px' }}>
            <SearchableSelect
              options={branchFilterOptions}
              value={selectedBranchFilter}
              onChange={(val) => setSelectedBranchFilter(val)}
              placeholder={t('clinicStaff.filterBranch', 'Filter by Branch')}
            />
          </div>
        ) : (
          user?.availableBranches && user.availableBranches.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontSize: '13px', fontWeight: 600 }}>
              <Building2 size={15} style={{ color: 'var(--primary-600)' }} />
              <span>{user.availableBranches[0]?.name}</span>
            </div>
          )
        )}
      </div>

      {/* Staff Table */}
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
                  {t('clinicStaff.table.staffMember', 'Staff Member')}
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('clinicStaff.table.contact', 'Contact')}
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('clinicStaff.table.branch', 'Branch')}
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('clinicStaff.table.status', 'Status')}
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('clinicStaff.table.joined', 'Joined')}
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('clinicStaff.table.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <Clock className="animate-spin" size={18} />
                      <span>{t('common.loading', 'Loading staff members...')}</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '60px 24px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--badge-primary-bg)', color: 'var(--primary-600)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                      <Users size={24} />
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '4px' }}>
                      {t('clinicStaff.table.emptyTitle', 'No Clinic Staff Found')}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                      {isClinicAdmin
                        ? t('clinicStaff.table.emptyAdminHelp', 'Click "+ Add Staff Member" to invite your first dental team member.')
                        : t('clinicStaff.table.emptyTenantHelp', 'Staff members are created and managed by the Clinic Admin of each branch.')}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedStaff.map((staff) => (
                  <tr
                    key={staff.id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--badge-primary-bg)',
                            color: 'var(--primary-600)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '14px',
                            flexShrink: 0,
                          }}
                        >
                          {staff.avatarUrl ? (
                            <img
                              src={staff.avatarUrl}
                              alt={staff.name}
                              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            staff.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-heading)' }}>
                            {staff.name}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {staff.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '14px 18px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                          <Mail size={13} />
                          {staff.email}
                        </span>
                        {staff.phone && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                            <Phone size={13} />
                            {staff.phone}
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      {staff.branch ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-heading)' }}>
                          <Building2 size={13} style={{ color: 'var(--primary-600)' }} />
                          <span>{staff.branch.name}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12.5px' }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <span
                        className={`badge ${
                          staff.status === 'ACTIVE'
                            ? 'badge-success'
                            : staff.status === 'INVITED'
                            ? 'badge-warning'
                            : 'badge-danger'
                        }`}
                        style={{ fontSize: '11.5px', fontWeight: 600, padding: '4px 8px', borderRadius: '6px' }}
                      >
                        {staff.status}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      {formatDate(staff.createdAt)}
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Tooltip content={t('clinicStaff.actions.resendInvite', 'Resend Welcome Email')}>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => handleResendInvite(staff)}
                            disabled={resendingId === staff.id}
                            style={{ padding: '6px', borderRadius: '6px' }}
                          >
                            <Send size={14} className={resendingId === staff.id ? 'animate-spin' : ''} />
                          </button>
                        </Tooltip>

                        {(isClinicAdmin || isTenantAdmin) && (
                          <Tooltip content={t('clinicStaff.actions.edit', 'Edit Profile')}>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => handleOpenEdit(staff)}
                              style={{ padding: '6px', borderRadius: '6px' }}
                            >
                              <Edit2 size={14} />
                            </button>
                          </Tooltip>
                        )}

                        {(isClinicAdmin || isTenantAdmin) && (
                          <Tooltip content={t('clinicStaff.actions.delete', 'Remove Staff Member')}>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => setDeletingStaff(staff)}
                              style={{ padding: '6px', borderRadius: '6px' }}
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
        {filteredStaff.length > 0 && (
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
            totalItems={filteredStaff.length}
          />
        )}
      </div>

      {/* CREATE STAFF MODAL (Rule 2: Clinic Admin only) */}
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
              maxWidth: '500px',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--badge-primary-bg)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCheck size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-heading)' }}>
                  {t('clinicStaff.createModal.title', 'Add Clinic Staff Member')}
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

            <form onSubmit={handleCreateStaff}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                      {t('clinicStaff.modal.firstName', 'First Name')} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Carlos"
                      value={createFormData.firstName}
                      onChange={(e) => setCreateFormData({ ...createFormData, firstName: e.target.value })}
                      required
                      style={{ width: '100%', height: '40px' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                      {t('clinicStaff.modal.lastName', 'Last Name')} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Ramirez"
                      value={createFormData.lastName}
                      onChange={(e) => setCreateFormData({ ...createFormData, lastName: e.target.value })}
                      required
                      style={{ width: '100%', height: '40px' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                    {t('clinicStaff.modal.email', 'Email Address')} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    className="input"
                    placeholder="carlos.ramirez@clinic.com"
                    value={createFormData.email}
                    onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                    required
                    style={{ width: '100%', height: '40px' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                    {t('clinicStaff.modal.phone', 'Phone Number')}
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
                      placeholder="55 9876 5432"
                      value={createFormData.phoneNumber}
                      onChange={(e) => setCreateFormData({ ...createFormData, phoneNumber: e.target.value })}
                      style={{ flex: 1, width: '100%', height: '40px' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                    {t('clinicStaff.modal.roleTitle', 'Position / Department')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder={t('clinicStaff.modal.roleTitlePlaceholder', 'e.g. Dental Assistant, Receptionist, Hygienist')}
                    value={createFormData.roleTitle}
                    onChange={(e) => setCreateFormData({ ...createFormData, roleTitle: e.target.value })}
                    style={{ width: '100%', height: '40px' }}
                  />
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
                      <span>{t('common.saving', 'Adding...')}</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>{t('clinicStaff.modal.sendInviteBtn', 'Add & Send Invite')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STAFF MODAL */}
      {editingStaff && (
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
              maxWidth: '500px',
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
                {t('clinicStaff.editModal.title', 'Edit Staff Profile')}
              </h3>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateStaff}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                      {t('clinicStaff.modal.firstName', 'First Name')}
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
                      {t('clinicStaff.modal.lastName', 'Last Name')}
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={editFormData.lastName}
                      onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                      required
                      style={{ width: '100%', height: '40px' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                    {t('clinicStaff.modal.phone', 'Phone Number')}
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
                    {t('clinicStaff.modal.status', 'Status')}
                  </label>
                  <select
                    className="input"
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as any })}
                    style={{ width: '100%', height: '40px' }}
                  >
                    <option value="ACTIVE">{t('common.active', 'Active')}</option>
                    <option value="INACTIVE">{t('common.inactive', 'Inactive')}</option>
                  </select>
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
                  onClick={() => setEditingStaff(null)}
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

      {/* DELETE CONFIRMATION MODAL */}
      {deletingStaff && (
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
              maxWidth: '440px',
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
                {t('clinicStaff.deleteModal.title', 'Remove Staff Member?')}
              </h3>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 20px' }}>
              {t(
                'clinicStaff.deleteModal.confirmText',
                'Are you sure you want to remove staff member "{{name}}"? This will revoke their access to the branch.',
                { name: deletingStaff.name },
              )}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingStaff(null)}
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
                {submitting ? t('common.deleting', 'Removing...') : t('common.confirmDelete', 'Remove Staff')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
