import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../core/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher';
import { ThemeSwitcher } from '../components/layout/ThemeSwitcher';
import { Shield, Building2, AlertTriangle } from 'lucide-react';
import { getTenantSlug, isPlatformDomain } from '../core/utils/tenantContext';
import api from '../services/api';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Subdomain-based tenant detection
  const tenantSlug = getTenantSlug();
  const isPlatform = isPlatformDomain();

  // Tenant info fetched from subdomain
  const [tenantInfo, setTenantInfo] = useState<{ name: string; slug: string } | null>(null);
  const [tenantNotFound, setTenantNotFound] = useState(false);

  useEffect(() => {
    if (tenantSlug) {
      // Fetch tenant info to display name and validate existence
      api.get(`/tenants/by-slug/${tenantSlug}`)
        .then((res) => {
          setTenantInfo({ name: res.data.name, slug: res.data.slug });
          setTenantNotFound(false);
        })
        .catch(() => {
          setTenantNotFound(true);
          setTenantInfo(null);
        });
    }
  }, [tenantSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password, tenantSlug || undefined);
      navigate('/');
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Authentication failed. Please check your credentials.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-app)',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'background-color 0.2s ease',
      }}
    >
      {/* Background ambient lighting */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-10%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: isPlatform
            ? 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(15, 118, 110, 0.2) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-10%',
          right: '-10%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: isPlatform
            ? 'radial-gradient(circle, rgba(234, 88, 12, 0.15) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />

      {/* Top right utility bar: Language Switcher & Theme Switcher */}
      <div
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'var(--bg-card)',
          borderRadius: '20px',
          padding: '36px',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border-color)',
          position: 'relative',
          zIndex: 1,
          transition: 'all 0.2s ease',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: isPlatform
                ? 'linear-gradient(135deg, #f59e0b, #ea580c)'
                : 'linear-gradient(135deg, #0f766e, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              margin: '0 auto 12px',
              boxShadow: isPlatform
                ? '0 8px 16px rgba(245, 158, 11, 0.3)'
                : '0 8px 16px rgba(15, 118, 110, 0.3)',
            }}
          >
            {isPlatform ? <Shield size={26} color="#fff" /> : '🦷'}
          </div>

          {/* Title changes based on context */}
          {isPlatform ? (
            <>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)' }}>
                Platform Admin Login
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Unified Dental Platform — Super Admin Access
              </p>
            </>
          ) : tenantNotFound ? (
            <>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--rose-500)' }}>
                Organization Not Found
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                The organization <strong>"{tenantSlug}"</strong> does not exist.
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)' }}>
                {tenantInfo ? tenantInfo.name : 'Loading...'}
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Sign in to your organization workspace
              </p>
            </>
          )}
        </div>

        {/* Tenant not found — don't show login form */}
        {tenantNotFound ? (
          <div
            style={{
              backgroundColor: 'var(--badge-danger-bg)',
              border: '1px solid var(--border-color)',
              color: 'var(--badge-danger-text)',
              padding: '16px',
              borderRadius: '10px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>
              <strong>Organization not found.</strong>
              <br />
              Please check the URL or contact your administrator for the correct login address.
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div
                style={{
                  backgroundColor: 'var(--badge-danger-bg)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--badge-danger-text)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            {/* Tenant subdomain badge (when on tenant domain) */}
            {!isPlatform && tenantInfo && (
              <div
                style={{
                  backgroundColor: 'var(--badge-primary-bg)',
                  border: '1px solid var(--border-color)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--badge-primary-text)',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Building2 size={14} />
                <span>
                  Signing in to <strong>{tenantInfo.name}</strong>{' '}
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    ({tenantInfo.slug})
                  </span>
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t('auth.emailLabel')}</label>
                <input
                  type="email"
                  className="form-input"
                  required
                  placeholder="user@organization.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">{t('auth.passwordLabel')}</label>
                  <Link
                    to="/forgot-password"
                    style={{
                      fontSize: '12px',
                      color: 'var(--primary-600)',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  className="form-input"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ width: '100%', padding: '12px', marginTop: '8px', fontSize: '15px' }}
              >
                {loading ? t('common.loading') : t('auth.signInBtn')}
              </button>
            </form>
          </>
        )}

        {/* Footer context info */}
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
            🦷 Unified Dental Platform
          </span>
        </div>
      </div>
    </div>
  );
};
