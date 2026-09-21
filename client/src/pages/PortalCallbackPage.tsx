import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useToast } from '../core/context/ToastContext';
import { getPlatformRootUrl, getTenantSlug } from '../core/utils/tenantContext';
import { Shield, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';

export const PortalCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { toast } = useToast();
  const hasExchangedRef = useRef(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const token = searchParams.get('token');
  const tenantSlug = getTenantSlug();

  useEffect(() => {
    if (!token) {
      setErrorMessage(t('tenants.portalExchangeFailed'));
      return;
    }

    if (hasExchangedRef.current) return;
    hasExchangedRef.current = true;

    async function exchangeToken() {
      try {
        const res = await api.post('/auth/exchange-portal-token', { token });
        const { accessToken, refreshToken, tenant } = res.data;

        if (accessToken) {
          localStorage.setItem('access_token', accessToken);
        }
        if (refreshToken) {
          localStorage.setItem('refresh_token', refreshToken);
        }
        if (tenant?.slug) {
          localStorage.setItem('active_tenant_slug', tenant.slug);
        }
        localStorage.setItem('is_impersonating', 'true');
        localStorage.setItem('ud_last_activity', String(Date.now()));

        toast.success(
          t('tenants.portalLoginSuccess', { name: tenant?.name || tenant?.slug || '' })
        );
        window.location.href = '/';
      } catch (err: any) {
        const backendMsg = err.response?.data?.message;
        setErrorMessage(backendMsg || t('tenants.portalExchangeFailed'));
      }
    }

    exchangeToken();
  }, [token, t, toast]);

  const handleReturnToPlatform = () => {
    window.location.href = getPlatformRootUrl('tenants');
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
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '36px 32px',
          borderRadius: '18px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08)',
          border: '1px solid var(--border-color)',
        }}
      >
        {errorMessage ? (
          <div>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                backgroundColor: 'var(--badge-danger-bg)',
                color: 'var(--badge-danger-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <AlertCircle size={28} />
            </div>

            <h2
              style={{
                fontSize: '19px',
                fontWeight: 700,
                color: 'var(--text-heading)',
                marginBottom: '8px',
              }}
            >
              {t('tenants.portalExchangeFailed')}
            </h2>

            <p
              style={{
                fontSize: '13.5px',
                color: 'var(--text-muted)',
                marginBottom: '24px',
                lineHeight: 1.5,
              }}
            >
              {errorMessage}
            </p>

            <button
              onClick={handleReturnToPlatform}
              className="btn btn-primary"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 16px',
                fontSize: '13.5px',
              }}
            >
              <ArrowLeft size={16} />
              <span>{t('tenants.portalReturnToPlatform')}</span>
            </button>
          </div>
        ) : (
          <div>
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '16px',
                backgroundColor: 'var(--badge-primary-bg)',
                color: 'var(--primary-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <Shield size={30} />
            </div>

            <h2
              style={{
                fontSize: '19px',
                fontWeight: 700,
                color: 'var(--text-heading)',
                marginBottom: '8px',
              }}
            >
              {t('tenants.portalAuthenticatingTitle')}
            </h2>

            <p
              style={{
                fontSize: '13.5px',
                color: 'var(--text-muted)',
                marginBottom: '28px',
                lineHeight: 1.5,
              }}
            >
              {t('tenants.portalAuthenticatingDesc', {
                tenant: tenantSlug || 'Organization',
              })}
            </p>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                color: 'var(--primary-600)',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              <Loader2 size={20} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span>{t('common.loading')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
