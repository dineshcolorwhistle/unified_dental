import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../core/context/AuthContext';
import { useToast } from '../core/context/ToastContext';
import { Pagination } from '../components/common/Pagination';
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  Shield,
  Building,
  CheckCircle2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, isTenantAdmin } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canDeleteUser = Boolean(isTenantAdmin || user?.isSuperAdmin);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    roleId: '',
    branchId: '',
    moduleKeys: ['CLINIC', 'LAB'],
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes, branchesRes] = await Promise.allSettled([
        api.get('/users', { params: { search: search || undefined } }),
        api.get('/rbac/roles'),
        api.get('/branches'),
      ]);

      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data || []);
      if (rolesRes.status === 'fulfilled') setRoles(rolesRes.value.data || []);
      if (branchesRes.status === 'fulfilled') setBranches(branchesRes.value.data || []);
    } catch (e) {
      console.error('Failed to load users data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.activeTenant?.id, search]);

  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return users.slice(start, start + pageSize);
  }, [users, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/users', formData);
      toast.success(`User "${formData.name}" created and invited successfully`, 'User Created');
      setShowModal(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        roleId: '',
        branchId: '',
        moduleKeys: ['CLINIC', 'LAB'],
      });
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to create/invite user';
      toast.error(msg, 'User Creation Failed');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    try {
      setDeleteLoading(true);
      await api.delete(`/users/${deletingUser.id}`);
      toast.success(
        t('users.removeSuccess', {
          name: deletingUser.name || deletingUser.email,
          defaultValue: `User "${deletingUser.name || deletingUser.email}" removed from organization`,
        }),
        'User Removed'
      );
      setDeletingUser(null);
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to remove user';
      toast.error(msg, 'Removal Failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', color: 'var(--text-heading)' }}>{t('users.title')}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>{t('users.subtitle')}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={16} /> {t('users.createBtn')}
        </button>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <Search size={16} style={{ color: 'var(--text-subtle)' }} />
        <input
          type="text"
          className="form-input"
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ border: 'none', boxShadow: 'none', padding: '4px' }}
        />
      </div>

      {/* Users Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="ud-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface-hover)' }}>
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('users.name')}</th>
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('users.email')}</th>
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('users.roles')}</th>
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('users.branch')}</th>
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('users.modules')}</th>
                <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('users.status')}</th>
                {canDeleteUser && (
                  <th style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>
                    {t('common.actions', { defaultValue: 'Actions' })}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canDeleteUser ? 7 : 6} style={{ textAlign: 'center', padding: '40px', color: 'var(--primary-600)' }}>
                    {t('common.loading')}
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={canDeleteUser ? 7 : 6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No users found in this organization.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => {
                  const assignedRoles = u.userRoles?.map((ur: any) => ur.role?.name).join(', ') || 'Staff';
                  const assignedBranches = u.userBranches?.map((ub: any) => ub.branch?.name).join(', ') || 'All';
                  const modules = u.moduleAccess?.filter((ma: any) => ma.isActive).map((ma: any) => ma.moduleKey) || [];

                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="table-row-hover">
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--primary-700)',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px',
                              fontWeight: 700,
                            }}
                          >
                            {u.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '13.5px' }}>{u.name}</div>
                            {u.phone && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.phone}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
                          <Mail size={13} style={{ color: 'var(--text-subtle)' }} /> {u.email}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className="badge badge-primary" style={{ fontSize: '11px' }}>
                          <Shield size={11} /> {assignedRoles}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
                          <Building size={13} style={{ color: 'var(--text-subtle)' }} /> {assignedBranches}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {modules.map((m: string) => (
                            <span key={m} className="badge badge-info" style={{ fontSize: '10px' }}>
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className={`badge ${u.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                          {u.status}
                        </span>
                      </td>
                      {canDeleteUser && (
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          {u.memberships?.[0]?.isOwner ? (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                              {t('users.ownerBadge', { defaultValue: 'Owner' })}
                            </span>
                          ) : u.id === user?.id ? (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                              {t('users.youBadge', { defaultValue: 'You' })}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeletingUser(u)}
                              className="btn btn-secondary btn-sm"
                              title={t('users.removeBtn', { defaultValue: 'Remove from Organization' })}
                              aria-label={t('users.removeBtn', { defaultValue: 'Remove from Organization' })}
                              style={{
                                padding: '5px 8px',
                                color: '#ef4444',
                                borderColor: 'rgba(239, 68, 68, 0.25)',
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Global Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={users.length}
          pageSize={pageSize}
          pageSizeOptions={[5, 10, 20, 50]}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Invite User Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '16px' }}>{t('users.modalTitle')}</h3>
              <button onClick={() => setShowModal(false)} className="btn-secondary btn-sm">✕</button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{t('users.name')}</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="e.g. Dr. Sarah Jenkins"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{t('users.email')}</label>
                  <input
                    type="email"
                    className="form-input"
                    required
                    placeholder="sarah@organization.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">{t('users.phone')}</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="+1-555-0155"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Initial Password</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Welcome@123456"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Assign Role</label>
                    <select
                      className="form-select"
                      value={formData.roleId}
                      onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                    >
                      <option value="">Select Role (Default: Staff)</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} {r.moduleKey ? `(${r.moduleKey})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Assign Branch</label>
                    <select
                      className="form-select"
                      value={formData.branchId}
                      onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    >
                      <option value="">Default Branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Module Access</label>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                      <input
                        type="checkbox"
                        checked={formData.moduleKeys.includes('CLINIC')}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...formData.moduleKeys, 'CLINIC']
                            : formData.moduleKeys.filter((m) => m !== 'CLINIC');
                          setFormData({ ...formData, moduleKeys: next });
                        }}
                      />
                      Clinic Access
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                      <input
                        type="checkbox"
                        checked={formData.moduleKeys.includes('LAB')}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...formData.moduleKeys, 'LAB']
                            : formData.moduleKeys.filter((m) => m !== 'LAB');
                          setFormData({ ...formData, moduleKeys: next });
                        }}
                      />
                      Lab Access
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary">
                  {t('users.createBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deletingUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                <AlertTriangle size={18} />
                <h3 style={{ fontSize: '16px', margin: 0, fontWeight: 700 }}>
                  {t('users.removeModalTitle', { defaultValue: 'Remove User from Organization' })}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="btn-secondary btn-sm"
                disabled={deleteLoading}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: '13.5px', color: 'var(--text-main)', margin: '0 0 12px 0' }}>
                {t('users.removeModalPrompt', {
                  defaultValue: 'Are you sure you want to remove this user from the organization? Their roles, module access, and branch assignments will be revoked, and their seat will be freed.',
                })}
              </p>
              <div
                style={{
                  padding: '12px',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  fontSize: '13px',
                }}
              >
                <div><strong>{deletingUser.name}</strong></div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{deletingUser.email}</div>
              </div>
            </div>
            <div
              className="modal-footer"
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                padding: '14px 24px',
                borderTop: '1px solid var(--border-color)',
              }}
            >
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="btn btn-secondary"
                disabled={deleteLoading}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="btn btn-danger"
                disabled={deleteLoading}
                style={{ backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#ffffff' }}
              >
                {deleteLoading
                  ? t('common.loading')
                  : t('users.confirmRemoveBtn', { defaultValue: 'Remove User' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
