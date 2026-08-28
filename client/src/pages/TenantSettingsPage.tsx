import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../core/context/AuthContext';
import { useToast } from '../core/context/ToastContext';
import api from '../services/api';
import {
  Building2,
  Globe,
  Lock,
  UploadCloud,
  Trash2,
  Copy,
  Check,
  Image as ImageIcon,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  Info,
} from 'lucide-react';

export const TenantSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const tenant = user?.activeTenant;
  const tenantName = tenant?.name || 'Dental Organization';
  const tenantSlug = tenant?.slug || '';

  // Get current host information for access URL
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port ? `:${window.location.port}` : '';
  const accessUrl = tenantSlug
    ? `${protocol}//${tenantSlug}.${hostname.replace(/^[a-zA-Z0-9-]+\./, '')}${port}`
    : window.location.origin;

  const currentLogoUrl = (tenant?.settings as any)?.logoUrl || null;

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(accessUrl);
      setCopied(true);
      toast.success(t('tenantSettings.urlCopied'));
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const validateAndSelectFile = (file: File) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error(t('tenantSettings.supportedFormats', { maxSize: 10 }));
      return;
    }

    const maxSizeMb = 10;
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error(t('tenantSettings.supportedFormats', { maxSize: maxSizeMb }));
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSelectFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleUploadLogo = async () => {
    if (!selectedFile || !tenant?.id) return;

    setUploading(true);
    try {
      // 1. Upload the file to files storage
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('resourceType', 'TENANT_LOGO');
      formData.append('resourceId', tenant.id);

      const uploadRes = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const fileRecord = uploadRes.data;
      const logoUrl = `/api/files/${fileRecord.id}/download`;

      // 2. Update tenant settings
      await api.patch(`/tenants/${tenant.id}/settings`, {
        settings: {
          logoUrl,
          logoFileId: fileRecord.id,
        },
      });

      // 3. Refresh user context so sidebar immediately reflects the logo
      await refreshProfile();

      setSelectedFile(null);
      setPreviewUrl(null);
      toast.success(t('tenantSettings.uploadSuccess'));
    } catch (err: any) {
      console.error('Failed to upload logo:', err);
      toast.error(
        err.response?.data?.message || t('tenantSettings.uploadError'),
      );
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!tenant?.id) return;

    setRemoving(true);
    try {
      await api.patch(`/tenants/${tenant.id}/settings`, {
        settings: {
          logoUrl: null,
          logoFileId: null,
        },
      });

      await refreshProfile();
      setShowRemoveModal(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      toast.success(t('tenantSettings.removeSuccess'));
    } catch (err: any) {
      console.error('Failed to remove logo:', err);
      toast.error(err.response?.data?.message || 'Failed to remove logo');
    } finally {
      setRemoving(false);
    }
  };

  const displayLogo = previewUrl || currentLogoUrl;

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'rgba(15, 118, 110, 0.12)',
              color: 'var(--primary-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Building2 size={22} />
          </div>
          <div>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 800,
                color: 'var(--text-main)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              {t('tenantSettings.title')}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              {t('tenantSettings.subtitle')}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* 1. Organization Branding & Logo Management Card (FIRST) */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                {t('tenantSettings.brandingCardTitle')}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                {t('tenantSettings.brandingCardDesc')}
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '20px',
                backgroundColor: 'rgba(15, 118, 110, 0.1)',
                color: 'var(--primary-600)',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              <Sparkles size={13} />
              <span>Branding</span>
            </div>
          </div>

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
              {/* Current / Preview Logo Box */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {t('tenantSettings.currentLogo')}
                </label>

                <div
                  style={{
                    width: '100%',
                    height: '180px',
                    borderRadius: '14px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {displayLogo ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        width: '100%',
                        height: '100%',
                      }}
                    >
                      <img
                        src={displayLogo}
                        alt="Tenant Logo"
                        style={{
                          maxWidth: '160px',
                          maxHeight: '100px',
                          objectFit: 'contain',
                          borderRadius: '8px',
                          filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))',
                        }}
                      />
                      {previewUrl && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--primary-600)',
                            backgroundColor: 'rgba(15, 118, 110, 0.12)',
                            padding: '2px 8px',
                            borderRadius: '12px',
                          }}
                        >
                          New Preview (Unsaved)
                        </span>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '10px',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '14px',
                          background: 'linear-gradient(135deg, #0f766e, #0d9488)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontSize: '22px',
                          fontWeight: 800,
                          boxShadow: '0 4px 12px rgba(15, 118, 110, 0.3)',
                        }}
                      >
                        {tenantName.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '200px' }}>
                        {t('tenantSettings.noLogo')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions under preview if logo exists */}
                {currentLogoUrl && !previewUrl && (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <UploadCloud size={15} />
                      <span>{t('tenantSettings.changeBtn')}</span>
                    </button>
                    <button
                      onClick={() => setShowRemoveModal(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(244, 63, 94, 0.3)',
                        backgroundColor: 'rgba(244, 63, 94, 0.08)',
                        color: 'var(--rose-500)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={15} />
                      <span>{t('tenantSettings.removeBtn')}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Upload Drag and Drop Zone */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {t('tenantSettings.uploadLogoTitle')}
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                  style={{ display: 'none' }}
                />

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: '100%',
                    height: '180px',
                    borderRadius: '14px',
                    border: `2px dashed ${dragOver ? 'var(--primary-600)' : 'var(--border-color)'}`,
                    backgroundColor: dragOver ? 'rgba(15, 118, 110, 0.06)' : 'var(--bg-surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(15, 118, 110, 0.12)',
                      color: 'var(--primary-600)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <UploadCloud size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                      {selectedFile ? selectedFile.name : t('tenantSettings.dropzoneText')}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '4px' }}>
                      {t('tenantSettings.supportedFormats', { maxSize: 10 })}
                    </div>
                  </div>
                </div>

                {/* Confirm Upload Button if File Selected */}
                {selectedFile && (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleUploadLogo}
                      disabled={uploading}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: 'var(--primary-600)',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: uploading ? 'not-allowed' : 'pointer',
                        opacity: uploading ? 0.7 : 1,
                        boxShadow: '0 2px 6px rgba(15, 118, 110, 0.3)',
                      }}
                    >
                      <Check size={16} />
                      <span>{uploading ? t('tenantSettings.saving') : t('tenantSettings.uploadBtn')}</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      disabled={uploading}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-muted)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Organization Identity Card (Read-Only) (SECOND) */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                {t('tenantSettings.identityCardTitle')}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                {t('tenantSettings.identityCardDesc')}
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '20px',
                backgroundColor: 'var(--bg-surface-muted)',
                color: 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              <Lock size={12} />
              <span>Read-Only</span>
            </div>
          </div>

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {/* Organization Name (Read-Only) */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {t('tenantSettings.tenantName')}
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'var(--bg-input)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    padding: '10px 14px',
                    gap: '10px',
                    opacity: 0.9,
                  }}
                >
                  <Building2 size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', flex: 1 }}>
                    {tenantName}
                  </span>
                  <Lock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '4px', margin: '4px 0 0 0' }}>
                  {t('tenantSettings.tenantNameHelp')}
                </p>
              </div>

              {/* Subdomain Slug (Read-Only) */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {t('tenantSettings.subdomain')}
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'var(--bg-input)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    padding: '10px 14px',
                    gap: '10px',
                    opacity: 0.9,
                  }}
                >
                  <Globe size={16} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary-600)', flex: 1 }}>
                    {tenantSlug}
                  </span>
                  <Lock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '4px', margin: '4px 0 0 0' }}>
                  {t('tenantSettings.subdomainHelp')}
                </p>
              </div>
            </div>

            {/* Access URL */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {t('tenantSettings.accessUrl')}
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--bg-input)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  padding: '8px 12px 8px 14px',
                  gap: '10px',
                }}
              >
                <span
                  style={{
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    color: 'var(--text-main)',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {accessUrl}
                </span>
                <button
                  onClick={handleCopyUrl}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: copied ? 'var(--badge-success-bg)' : 'var(--bg-card)',
                    color: copied ? 'var(--badge-success-text)' : 'var(--text-main)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : t('tenantSettings.copyUrl')}</span>
                </button>
              </div>
            </div>

            {/* Read-Only Notice Box */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'rgba(6, 182, 212, 0.08)',
                border: '1px solid rgba(6, 182, 212, 0.2)',
                color: 'var(--text-main)',
                fontSize: '12px',
                lineHeight: 1.45,
              }}
            >
              <Info size={16} style={{ color: '#06b6d4', flexShrink: 0, marginTop: '2px' }} />
              <span>{t('tenantSettings.readOnlyNotice')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Remove Logo Confirmation Modal */}
      {showRemoveModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-color)',
              animation: 'modalSlideIn 0.2s ease-out forwards',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'rgba(244, 63, 94, 0.12)',
                color: 'var(--rose-500)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <AlertCircle size={24} />
            </div>

            <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px 0' }}>
              {t('tenantSettings.removeConfirmTitle')}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              {t('tenantSettings.removeConfirmMsg')}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowRemoveModal(false)}
                disabled={removing}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleRemoveLogo}
                disabled={removing}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--rose-500)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: removing ? 'not-allowed' : 'pointer',
                  opacity: removing ? 0.7 : 1,
                }}
              >
                {removing ? t('common.loading') : t('tenantSettings.removeConfirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
