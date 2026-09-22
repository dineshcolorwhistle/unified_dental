import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, LayoutDashboard, Stethoscope, Info } from 'lucide-react';
import { useAuth } from '../../core/context/AuthContext';
import { useModule } from '../../core/context/ModuleContext';
import { useToast } from '../../core/context/ToastContext';
import {
  tenantDashboardService,
  TenantAdminDashboardResponse,
  LabModuleSectionData,
} from '../../services/tenantDashboardService';
import { SubscriptionPlanCard } from '../../components/dashboard/SubscriptionPlanCard';
import { TenantAdminLabSection } from '../../components/dashboard/TenantAdminLabSection';
import { Tooltip } from '../../components/common/Tooltip';

export const TenantAdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeModuleMode } = useModule();
  const { toast } = useToast();

  const [data, setData] = useState<TenantAdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const result = await tenantDashboardService.getDashboard(activeModuleMode);
        setData(result);
      } catch (err: any) {
        console.error('Failed to load tenant admin dashboard:', err);
        if (!silent) {
          toast.error(
            err?.response?.data?.message || t('dashboard.tenantAdmin.loadFailed')
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeModuleMode, toast, t]
  );

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading && !data) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '350px',
          color: 'var(--text-muted)',
          fontSize: '15px',
        }}
      >
        <RefreshCw size={22} style={{ marginRight: '10px', animation: 'spin 1s linear infinite' }} />
        {t('common.loading')}
      </div>
    );
  }

  const isLabMode = activeModuleMode === 'LAB';
  const isClinicMode = activeModuleMode === 'CLINIC';

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '32px' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
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
              <LayoutDashboard size={20} />
            </div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 800,
                color: 'var(--text-heading)',
                margin: 0,
                fontFamily: 'var(--font-heading)',
              }}
            >
              {t('dashboard.tenantAdmin.welcomeTitle', {
                name: user?.name || 'Administrator',
              })}
            </h1>
          </div>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0 }}>
            {t('dashboard.tenantAdmin.pageSubtitle')}
          </p>
        </div>

        {/* Refresh Action */}
        <Tooltip content={t('common.refresh')}>
          <button
            type="button"
            className="btn-icon"
            onClick={() => fetchDashboard(true)}
            disabled={refreshing}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: refreshing ? 'wait' : 'pointer',
              color: 'var(--text-main)',
            }}
          >
            <RefreshCw
              size={16}
              style={{
                animation: refreshing ? 'spin 1s linear infinite' : 'none',
              }}
            />
          </button>
        </Tooltip>
      </div>

      {/* ─── Common Section: Subscription Plan & Resource Quotas ─── */}
      {data?.subscription && <SubscriptionPlanCard data={data.subscription} />}

      {/* ─── Dynamic Module Section ─── */}
      {isLabMode && data?.module && (
        <TenantAdminLabSection data={data.module as LabModuleSectionData} />
      )}

      {isClinicMode && (
        <div>
          <div
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '20px 24px',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              borderLeft: '4px solid var(--primary-600)',
            }}
          >
            <Stethoscope size={22} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)' }}>
                {t('common.moduleDentalClinic')}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                {t('dashboard.clinicDashboardSubtitle')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
