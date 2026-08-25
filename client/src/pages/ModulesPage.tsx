import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import {
  Layers,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Check,
  X,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  AlertCircle,
  PackageCheck,
  Zap,
} from 'lucide-react';

export interface SystemModule {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

function nameToCode(name: string): string {
  return name
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9\s_]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');
}

export const ModulesPage: React.FC = () => {
  const { t } = useTranslation();
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingModule, setEditingModule] = useState<SystemModule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    isEnabled: true,
  });
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete Confirmation State
  const [deletingModule, setDeletingModule] = useState<SystemModule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchModules = async () => {
    try {
      setLoading(true);
      const res = await api.get('/modules?all=true');
      setModules(res.data || []);
    } catch (e) {
      console.error('Failed to load system modules:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingModule(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      isEnabled: true,
    });
    setCodeManuallyEdited(false);
    setShowModal(true);
  };

  const handleOpenEditModal = (mod: SystemModule) => {
    setEditingModule(mod);
    setFormData({
      name: mod.name,
      code: mod.code,
      description: mod.description || '',
      isEnabled: mod.isEnabled,
    });
    setCodeManuallyEdited(true);
    setShowModal(true);
  };

  const handleNameChange = (name: string) => {
    const newForm = { ...formData, name };
    if (!editingModule && !codeManuallyEdited) {
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

  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      alert(t('modules.alerts.nameCodeRequired'));
      return;
    }

    try {
      setSaving(true);
      if (editingModule) {
        await api.patch(`/modules/${editingModule.id}`, {
          name: formData.name,
          description: formData.description,
          isEnabled: formData.isEnabled,
        });
      } else {
        await api.post('/modules', formData);
      }
      setShowModal(false);
      fetchModules();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || err.response?.data?.message || t('modules.alerts.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (mod: SystemModule) => {
    try {
      await api.patch(`/modules/${mod.id}/toggle`, {
        isEnabled: !mod.isEnabled,
      });
      fetchModules();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || t('modules.alerts.toggleFailed'));
    }
  };

  const handleDeleteModule = async () => {
    if (!deletingModule) return;
    try {
      setDeleting(true);
      await api.delete(`/modules/${deletingModule.id}`);
      setDeletingModule(null);
      fetchModules();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || err.response?.data?.message || t('modules.alerts.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const filteredModules = modules.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.code.toLowerCase().includes(search.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(search.toLowerCase())),
  );

  const activeCount = modules.filter((m) => m.isEnabled).length;
  const disabledCount = modules.length - activeCount;

  return (
    <div>
      {/* Page Header */}
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
              <Layers size={20} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {t('modules.title')}
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            {t('modules.subtitle')}
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px' }}
        >
          <Plus size={18} />
          <span>{t('modules.createBtn')}</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: 'var(--badge-success-bg)',
              color: 'var(--badge-success-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PackageCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('modules.totalModules')}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
              {modules.length}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: 'var(--badge-info-bg)',
              color: 'var(--badge-info-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Zap size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('modules.activeModules')}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--sky-500)', marginTop: '2px' }}>
              {activeCount}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: 'var(--badge-danger-bg)',
              color: 'var(--badge-danger-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <XCircle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('modules.disabledModules')}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-muted)', marginTop: '2px' }}>
              {disabledCount}
            </div>
          </div>
        </div>
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
            placeholder={t('modules.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
          {t('modules.showingCount', { shown: filteredModules.length, total: modules.length })}
        </div>
      </div>

      {/* Module Grid */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--primary-600)', fontWeight: 600 }}>
          {t('common.loading')}
        </div>
      ) : filteredModules.length === 0 ? (
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
            <Layers size={32} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
            {t('modules.noModulesFound')}
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 20px' }}>
            {search
              ? t('modules.noModulesSearch')
              : t('modules.noModulesEmpty')}
          </p>
          {!search && (
            <button onClick={handleOpenCreateModal} className="btn btn-primary" style={{ borderRadius: '10px' }}>
              <Plus size={16} /> {t('modules.createFirst')}
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '20px',
          }}
        >
          {filteredModules.map((mod) => (
            <div
              key={mod.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '24px',
                borderRadius: '16px',
                border: mod.isEnabled ? '1px solid var(--border-color)' : '1px dashed var(--border-hover)',
                backgroundColor: mod.isEnabled ? 'var(--bg-card)' : 'var(--bg-surface-hover)',
                transition: 'all 0.2s ease',
              }}
            >
              <div>
                {/* Card Top: Code badge & Status toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        backgroundColor: 'var(--bg-surface-hover)',
                        color: 'var(--text-main)',
                        fontSize: '11px',
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        borderRadius: '6px',
                        letterSpacing: '0.05em',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {mod.code}
                    </span>
                    <span
                      className={`badge ${mod.isEnabled ? 'badge-success' : 'badge-danger'}`}
                      style={{ fontSize: '11px' }}
                    >
                      {mod.isEnabled ? (
                        <>
                          <CheckCircle2 size={12} /> {t('common.statusActive')}
                        </>
                      ) : (
                        <>
                          <XCircle size={12} /> {t('common.statusInactive')}
                        </>
                      )}
                    </span>
                  </div>

                  {/* Enable / Disable Toggle Switch */}
                  <button
                    onClick={() => handleToggleStatus(mod)}
                    title={mod.isEnabled ? 'Click to disable module' : 'Click to enable module'}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: mod.isEnabled ? '#10b981' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0,
                    }}
                  >
                    {mod.isEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                  </button>
                </div>

                {/* Module Name */}
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)', marginBottom: '8px' }}>
                  {mod.name}
                </h3>

                {/* Description */}
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                    lineHeight: '1.5',
                    minHeight: '40px',
                    marginBottom: '20px',
                  }}
                >
                  {mod.description || <span style={{ fontStyle: 'italic', color: 'var(--text-subtle)' }}>No description provided</span>}
                </p>
              </div>

              {/* Bottom Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                  {new Date(mod.createdAt).toLocaleDateString()}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleOpenEditModal(mod)}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Edit2 size={13} /> {t('modules.editBtn')}
                  </button>
                  <button
                    onClick={() => setDeletingModule(mod)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: 'var(--badge-danger-bg)',
                      color: 'var(--badge-danger-text)',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    <Trash2 size={13} /> {t('modules.deleteBtn')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Module Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={20} style={{ color: 'var(--primary-600)' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-heading)' }}>
                  {editingModule ? t('modules.modalTitleEdit') : t('modules.modalTitleCreate')}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveModule}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="label">
                    {t('modules.name')} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder={t('modules.namePlaceholder')}
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">
                    {t('modules.code')} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingModule}
                    className="input"
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      backgroundColor: editingModule ? '#f1f5f9' : '#ffffff',
                    }}
                    placeholder={t('modules.codePlaceholder')}
                    value={formData.code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">{t('modules.description')}</label>
                  <textarea
                    rows={3}
                    className="input"
                    placeholder={t('modules.descriptionPlaceholder')}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    backgroundColor: 'var(--bg-surface-hover)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                      {t('modules.activeStatus')}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {t('modules.activeStatusHelp')}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isEnabled}
                    onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
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
                  {saving ? t('modules.saving') : editingModule ? t('modules.modalTitleEdit') : t('modules.modalTitleCreate')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingModule && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rose-500)' }}>
                <AlertCircle size={20} />
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--rose-500)' }}>{t('modules.deleteModalTitle')}</h3>
              </div>
              <button
                onClick={() => setDeletingModule(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: '1.5' }}>
                {t('modules.deleteModalConfirm', { name: deletingModule.name, code: deletingModule.code })}
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
                {t('modules.deleteModalWarning')}
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setDeletingModule(null)}
                className="btn btn-secondary"
                disabled={deleting}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteModule}
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
                {deleting ? t('modules.deleting') : t('modules.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
