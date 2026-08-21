import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../core/context/AuthContext';
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
} from 'lucide-react';

export const BranchesPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, refreshProfile } = useAuth();
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: '',
    isDefault: false,
  });

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await api.get('/branches');
      setBranches(res.data || []);
    } catch (e) {
      console.error('Failed to load branches:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, [user?.activeTenant?.id]);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/branches', formData);
      setShowModal(false);
      setFormData({
        name: '',
        code: '',
        address: '',
        phone: '',
        email: '',
        isDefault: false,
      });
      fetchBranches();
      refreshProfile();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to create branch');
    }
  };

  const handleSetDefault = async (branchId: string) => {
    try {
      await api.patch(`/branches/${branchId}`, { isDefault: true });
      fetchBranches();
      refreshProfile();
    } catch (e) {
      console.error('Failed to set default branch:', e);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', color: '#0f172a' }}>{t('branches.title')}</h1>
          <p style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>{t('branches.subtitle')}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={16} /> {t('branches.createBtn')}
        </button>
      </div>

      {/* Branches Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', gridColumn: '1 / -1', color: '#94a3b8' }}>
            {t('common.loading')}
          </div>
        ) : branches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', gridColumn: '1 / -1', color: '#94a3b8' }}>
            No branches found.
          </div>
        ) : (
          branches.map((b) => (
            <div key={b.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        backgroundColor: '#ccfbf1',
                        color: '#0f766e',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', color: '#0f172a' }}>{b.name}</h3>
                      {b.code && (
                        <span className="badge badge-info" style={{ fontSize: '10px', marginTop: '2px' }}>
                          {b.code}
                        </span>
                      )}
                    </div>
                  </div>

                  {b.isDefault ? (
                    <span className="badge badge-success" style={{ fontSize: '11px' }}>
                      <CheckCircle2 size={12} /> {t('branches.defaultBadge')}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSetDefault(b.id)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                    >
                      Set Default
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px', fontSize: '13px', color: '#475569' }}>
                  {b.address && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={14} style={{ color: '#94a3b8' }} /> {b.address}
                    </div>
                  )}
                  {b.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Phone size={14} style={{ color: '#94a3b8' }} /> {b.phone}
                    </div>
                  )}
                  {b.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Mail size={14} style={{ color: '#94a3b8' }} /> {b.email}
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  marginTop: '20px',
                  paddingTop: '12px',
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                  color: '#64748b',
                }}
              >
                <span>Status: <strong style={{ color: '#059669' }}>{b.status}</strong></span>
                <span>{b._count?.userBranches || 0} Staff assigned</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Branch Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '16px' }}>{t('branches.modalTitle')}</h3>
              <button onClick={() => setShowModal(false)} className="btn-secondary btn-sm">✕</button>
            </div>
            <form onSubmit={handleCreateBranch}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{t('branches.name')}</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="e.g. Westside Clinic & Lab Branch"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{t('branches.code')}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. WEST-01"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{t('branches.address')}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Physical street address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">{t('branches.phone')}</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="+1-555-0100"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="branch@organization.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginTop: '6px' }}>
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  />
                  Set as default branch for new users & orders
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary">
                  {t('branches.createBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
