import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../core/context/AuthContext';
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  Shield,
  Building,
  CheckCircle2,
} from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/users', formData);
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
      alert(err.response?.data?.error?.message || 'Failed to create/invite user');
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', color: '#0f172a' }}>{t('users.title')}</h1>
          <p style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>{t('users.subtitle')}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={16} /> {t('users.createBtn')}
        </button>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <Search size={16} style={{ color: '#94a3b8' }} />
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
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('users.name')}</th>
              <th>{t('users.email')}</th>
              <th>{t('users.roles')}</th>
              <th>{t('users.branch')}</th>
              <th>{t('users.modules')}</th>
              <th>{t('users.status')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  {t('common.loading')}
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  No users found in this organization.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const assignedRoles = u.userRoles?.map((ur: any) => ur.role?.name).join(', ') || 'Staff';
                const assignedBranches = u.userBranches?.map((ub: any) => ub.branch?.name).join(', ') || 'All';
                const modules = u.moduleAccess?.filter((ma: any) => ma.isActive).map((ma: any) => ma.moduleKey) || [];

                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: '#0f766e',
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
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{u.name}</div>
                          {u.phone && <div style={{ fontSize: '11px', color: '#64748b' }}>{u.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                        <Mail size={13} style={{ color: '#94a3b8' }} /> {u.email}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-primary" style={{ fontSize: '11px' }}>
                        <Shield size={11} /> {assignedRoles}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                        <Building size={13} style={{ color: '#94a3b8' }} /> {assignedBranches}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {modules.map((m: string) => (
                          <span key={m} className="badge badge-info" style={{ fontSize: '10px' }}>
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${u.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                        {u.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
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
    </div>
  );
};
