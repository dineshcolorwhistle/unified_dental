import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../core/context/AuthContext';
import { useModule } from '../core/context/ModuleContext';
import { useToast } from '../core/context/ToastContext';
import { Pagination } from '../components/common/Pagination';
import { SearchableSelect, SearchableSelectOption } from '../components/common/SearchableSelect';
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  Stethoscope,
  FlaskConical,
  Edit2,
  Trash2,
  Search,
  AlertTriangle,
} from 'lucide-react';

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

export const BranchesPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, refreshProfile } = useAuth();
  const { activeModuleMode } = useModule();
  const { toast } = useToast();

  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    phoneCountryCode: '+52',
    phoneNumber: '',
    email: '',
    isDefault: false,
    status: 'ACTIVE',
  });

  const parsePhone = (rawPhone?: string) => {
    if (!rawPhone) return { code: '+52', number: '' };
    const match = rawPhone.match(/^(\+\d{1,4})\s*(.*)$/);
    if (match) {
      return { code: match[1], number: match[2] };
    }
    return { code: '+52', number: rawPhone };
  };

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await api.get('/branches', {
        params: {
          moduleKey: activeModuleMode !== 'PLATFORM' ? activeModuleMode : undefined,
        },
      });
      setBranches(res.data || []);
    } catch (e) {
      console.error('Failed to load branches:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, [user?.activeTenant?.id, activeModuleMode]);

  // Filtered branches by search query
  const filteredBranches = useMemo(() => {
    if (!search.trim()) return branches;
    const q = search.toLowerCase().trim();
    return branches.filter(
      (b) =>
        b.name?.toLowerCase().includes(q) ||
        b.code?.toLowerCase().includes(q) ||
        b.address?.toLowerCase().includes(q) ||
        b.phone?.toLowerCase().includes(q) ||
        b.email?.toLowerCase().includes(q),
    );
  }, [branches, search]);

  // Paginated branches
  const totalPages = Math.max(1, Math.ceil(filteredBranches.length / pageSize));
  const paginatedBranches = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBranches.slice(start, start + pageSize);
  }, [filteredBranches, currentPage, pageSize]);

  // Reset page to 1 when search or active module changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeModuleMode]);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const phoneVal = formData.phoneNumber.trim()
        ? `${formData.phoneCountryCode} ${formData.phoneNumber.trim()}`
        : undefined;
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim() || undefined,
        address: formData.address.trim() || undefined,
        phone: phoneVal,
        email: formData.email.trim() || undefined,
        isDefault: Boolean(formData.isDefault),
        status: formData.status || 'ACTIVE',
        moduleKey: activeModuleMode !== 'PLATFORM' ? activeModuleMode : 'CLINIC',
      };
      await api.post('/branches', payload);
      toast.success(`Branch "${formData.name}" created successfully`, 'Branch Created');
      setShowCreateModal(false);
      setFormData({
        name: '',
        code: '',
        address: '',
        phoneCountryCode: '+52',
        phoneNumber: '',
        email: '',
        isDefault: false,
        status: 'ACTIVE',
      });
      fetchBranches();
      refreshProfile();
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to create branch';
      toast.error(errMsg, 'Branch Creation Failed');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (branch: any) => {
    setEditingBranch(branch);
    const parsed = parsePhone(branch.phone);
    setFormData({
      name: branch.name || '',
      code: branch.code || '',
      address: branch.address || '',
      phoneCountryCode: parsed.code,
      phoneNumber: parsed.number,
      email: branch.email || '',
      isDefault: Boolean(branch.isDefault),
      status: branch.status || 'ACTIVE',
    });
  };

  const handleUpdateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;
    try {
      setActionLoading(true);
      const phoneVal = formData.phoneNumber.trim()
        ? `${formData.phoneCountryCode} ${formData.phoneNumber.trim()}`
        : undefined;
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim() || undefined,
        address: formData.address.trim() || undefined,
        phone: phoneVal,
        email: formData.email.trim() || undefined,
        isDefault: Boolean(formData.isDefault),
        status: formData.status || 'ACTIVE',
      };
      await api.patch(`/branches/${editingBranch.id}`, payload);
      toast.success(`Branch "${formData.name}" updated successfully`, 'Branch Updated');
      setEditingBranch(null);
      fetchBranches();
      refreshProfile();
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to update branch';
      toast.error(errMsg, 'Branch Update Failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBranch = async () => {
    if (!deletingBranch) return;
    try {
      setActionLoading(true);
      await api.delete(`/branches/${deletingBranch.id}`);
      toast.success(`Branch "${deletingBranch.name}" deleted successfully`, 'Branch Deleted');
      setDeletingBranch(null);
      fetchBranches();
      refreshProfile();
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to delete branch';
      toast.error(errMsg, 'Branch Deletion Failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetDefault = async (branchId: string) => {
    try {
      await api.patch(`/branches/${branchId}`, { isDefault: true });
      toast.success('Default branch updated', 'Success');
      fetchBranches();
      refreshProfile();
    } catch (e: any) {
      toast.error('Failed to set default branch', 'Error');
    }
  };

  const isLabMode = activeModuleMode === 'LAB';
  const moduleTitle = isLabMode
    ? t('branches.labTitle', 'Dental Laboratory Branches')
    : t('branches.clinicTitle', 'Dental Clinic Branches');
  const moduleSubtitle = isLabMode
    ? t('branches.labSubtitle', 'Manage locations and work order routing for your dental laboratory network.')
    : t('branches.clinicSubtitle', 'Manage clinic facilities, locations, and patient service points.');

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
              {isLabMode ? <FlaskConical size={18} /> : <Stethoscope size={18} />}
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {moduleTitle}
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>{moduleSubtitle}</p>
        </div>

        <button
          onClick={() => {
            setFormData({
              name: '',
              code: '',
              address: '',
              phoneCountryCode: '+52',
              phoneNumber: '',
              email: '',
              isDefault: branches.length === 0,
              status: 'ACTIVE',
            });
            setShowCreateModal(true);
          }}
          className="btn btn-primary"
        >
          <Plus size={16} /> {t('branches.createBtn')}
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
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
            className="form-input"
            style={{ paddingLeft: '36px', height: '38px', width: '100%' }}
            placeholder={t('common.search', 'Search branches...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Branches Table Container */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="ud-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface-hover)' }}>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('branches.name')}
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('branches.address')}
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('branches.phone')} / {t('branches.email')}
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('branches.status')}
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('branches.defaultBadge')}
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('branches.staffCount')}
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>
                  {t('branches.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--primary-600)' }}>
                    {t('common.loading')}
                  </td>
                </tr>
              ) : paginatedBranches.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Building2 size={36} style={{ color: 'var(--text-subtle)' }} />
                      <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-heading)' }}>
                        {t('branches.noBranches')}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '400px' }}>
                        {t('branches.noBranchesDesc')}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedBranches.map((b) => (
                  <tr
                    key={b.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background-color 0.15s ease',
                    }}
                    className="table-row-hover"
                  >
                    {/* Name & Code */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--badge-primary-bg)',
                            color: 'var(--primary-600)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Building2 size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>
                            {b.name}
                          </div>
                          {b.code && (
                            <span className="badge badge-info" style={{ fontSize: '10px', padding: '1px 6px', marginTop: '2px' }}>
                              {b.code}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Address */}
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-main)' }}>
                      {b.address ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={14} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
                          <span>{b.address}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-subtle)' }}>—</span>
                      )}
                    </td>

                    {/* Contact */}
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {b.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Phone size={12} style={{ color: 'var(--text-subtle)' }} />
                            <span>{b.phone}</span>
                          </div>
                        )}
                        {b.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Mail size={12} style={{ color: 'var(--text-subtle)' }} />
                            <span>{b.email}</span>
                          </div>
                        )}
                        {!b.phone && !b.email && <span style={{ color: 'var(--text-subtle)' }}>—</span>}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 16px' }}>
                      <span className={b.status === 'ACTIVE' ? 'badge badge-success' : 'badge badge-danger'}>
                        {b.status}
                      </span>
                    </td>

                    {/* Default */}
                    <td style={{ padding: '14px 16px' }}>
                      {b.isDefault ? (
                        <span className="badge badge-primary" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} /> {t('branches.defaultBadge')}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSetDefault(b.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                        >
                          {t('branches.setDefault')}
                        </button>
                      )}
                    </td>

                    {/* Staff Count */}
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      <span className="badge badge-info" style={{ fontSize: '11px' }}>
                        {b._count?.userBranches || 0} staff
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          onClick={() => openEditModal(b)}
                          className="btn btn-secondary btn-sm"
                          title={t('branches.editBtn')}
                          aria-label={t('branches.editBtn')}
                          style={{ padding: '5px 8px' }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setDeletingBranch(b)}
                          className="btn btn-secondary btn-sm"
                          title={t('branches.deleteBtn')}
                          aria-label={t('branches.deleteBtn')}
                          style={{ padding: '5px 8px', color: 'var(--rose-500)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Global Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredBranches.length}
          pageSize={pageSize}
          pageSizeOptions={[5, 10, 20, 50]}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Create Branch Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                {t('branches.modalTitle')}
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="btn-secondary btn-sm">✕</button>
            </div>
            <form onSubmit={handleCreateBranch}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">
                    {t('branches.name')} <span style={{ color: 'var(--rose-500)' }}>*</span>
                  </label>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">{t('branches.phone')}</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '8px' }}>
                      <SearchableSelect
                        options={COUNTRY_DIALING_CODES}
                        value={formData.phoneCountryCode}
                        onChange={(val) => setFormData({ ...formData, phoneCountryCode: val })}
                      />
                      <input
                        type="tel"
                        className="form-input"
                        placeholder="55 1234 5678"
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('branches.email')}</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="branch@organization.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  />
                  <span>{t('branches.isDefaultHelp')}</span>
                </label>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-primary">
                  {actionLoading ? t('common.loading') : t('branches.createBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Branch Modal */}
      {editingBranch && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                {t('branches.editModalTitle')}
              </h3>
              <button onClick={() => setEditingBranch(null)} className="btn-secondary btn-sm">✕</button>
            </div>
            <form onSubmit={handleUpdateBranch}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">
                    {t('branches.name')} <span style={{ color: 'var(--rose-500)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{t('branches.code')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{t('branches.address')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">{t('branches.phone')}</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '8px' }}>
                      <SearchableSelect
                        options={COUNTRY_DIALING_CODES}
                        value={formData.phoneCountryCode}
                        onChange={(val) => setFormData({ ...formData, phoneCountryCode: val })}
                      />
                      <input
                        type="tel"
                        className="form-input"
                        placeholder="55 1234 5678"
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('branches.email')}</label>
                    <input
                      type="email"
                      className="form-input"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    {t('branches.status')} <span style={{ color: 'var(--rose-500)' }}>*</span>
                  </label>
                  <SearchableSelect
                    options={[
                      { value: 'ACTIVE', label: t('common.statusActive') },
                      { value: 'INACTIVE', label: t('common.statusInactive') },
                    ]}
                    value={formData.status}
                    onChange={(val) => setFormData({ ...formData, status: val })}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  />
                  <span>{t('branches.isDefaultHelp')}</span>
                </label>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setEditingBranch(null)} className="btn btn-secondary">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-primary">
                  {actionLoading ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Branch Confirmation Modal */}
      {deletingBranch && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rose-500)' }}>
                <AlertTriangle size={20} />
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>
                  {t('branches.deleteModalTitle')}
                </h3>
              </div>
              <button onClick={() => setDeletingBranch(null)} className="btn-secondary btn-sm">✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-main)', margin: 0 }}>
                {t('branches.deleteModalConfirm', { name: deletingBranch.name })}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--rose-500)', margin: 0 }}>
                {t('branches.deleteModalWarning')}
              </p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setDeletingBranch(null)} className="btn btn-secondary">
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleDeleteBranch}
                className="btn btn-danger"
                style={{ backgroundColor: 'var(--rose-600)', color: '#ffffff', border: 'none' }}
              >
                {actionLoading ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
