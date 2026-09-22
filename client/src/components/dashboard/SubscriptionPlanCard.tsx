import React from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, Building2, Users, Layers, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { SubscriptionSectionData } from '../../services/tenantDashboardService';
import { formatDate } from '../../core/utils/dateUtils';

interface SubscriptionPlanCardProps {
  data: SubscriptionSectionData;
}

export const SubscriptionPlanCard: React.FC<SubscriptionPlanCardProps> = ({ data }) => {
  const { t } = useTranslation();
  const { plan, quotas } = data;

  const getProgressColor = (pct: number) => {
    if (pct >= 90) return 'var(--rose-500, #ef4444)';
    if (pct >= 75) return 'var(--amber-500, #f59e0b)';
    return 'var(--primary-600)';
  };

  return (
    <div
      className="card"
      style={{
        padding: '24px',
        marginBottom: '24px',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-card)',
        boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Top Row: Plan Header & Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--primary-700), var(--primary-600))',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(15, 118, 110, 0.25)',
              flexShrink: 0,
            }}
          >
            <CreditCard size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: 'var(--text-heading)',
                  margin: 0,
                  fontFamily: 'var(--font-heading)',
                }}
              >
                {plan.name || t('dashboard.tenantAdmin.subscription.defaultPlanName')}
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  backgroundColor: 'var(--badge-success-bg)',
                  color: 'var(--emerald-600)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <CheckCircle2 size={12} />
                {plan.status === 'ACTIVE'
                  ? t('dashboard.tenantAdmin.subscription.activeStatus')
                  : plan.status}
              </span>
            </div>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--text-muted)',
                margin: '4px 0 0 0',
              }}
            >
              {t('dashboard.tenantAdmin.subscription.subtitle')}
            </p>
          </div>
        </div>

        {/* Plan Dates & Validity */}
        {plan.endDate && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <ShieldCheck size={15} style={{ color: 'var(--primary-600)' }} />
            <span>
              {t('dashboard.tenantAdmin.subscription.renewalDate')}:{' '}
              <strong style={{ color: 'var(--text-main)' }}>{formatDate(plan.endDate)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Resource Quotas Grid: Branches, Members, Modules */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Quota 1: Branches Allocated vs Used */}
        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--badge-primary-bg)',
                  color: 'var(--primary-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Building2 size={18} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-heading)' }}>
                  {t('dashboard.tenantAdmin.subscription.branchesQuota')}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {t('dashboard.tenantAdmin.subscription.branchesSubtitle')}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                {quotas.branches.used}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
                {' '}/ {quotas.branches.allocated}
              </span>
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div
            style={{
              width: '100%',
              height: '8px',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-app)',
              overflow: 'hidden',
              marginBottom: '8px',
            }}
          >
            <div
              style={{
                width: `${quotas.branches.percentage}%`,
                height: '100%',
                backgroundColor: getProgressColor(quotas.branches.percentage),
                borderRadius: '4px',
                transition: 'width 0.4s ease',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11.5px',
              color: 'var(--text-muted)',
            }}
          >
            <span>
              {quotas.branches.percentage}% {t('dashboard.tenantAdmin.subscription.used')}
            </span>
            <span>
              {quotas.branches.remaining}{' '}
              {t('dashboard.tenantAdmin.subscription.remaining')}
            </span>
          </div>
        </div>

        {/* Quota 2: Members Allocated vs Used */}
        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--badge-info-bg)',
                  color: 'var(--sky-500)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Users size={18} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-heading)' }}>
                  {t('dashboard.tenantAdmin.subscription.membersQuota')}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {t('dashboard.tenantAdmin.subscription.membersSubtitle')}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                {quotas.members.used}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
                {' '}/ {quotas.members.allocated}
              </span>
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div
            style={{
              width: '100%',
              height: '8px',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-app)',
              overflow: 'hidden',
              marginBottom: '8px',
            }}
          >
            <div
              style={{
                width: `${quotas.members.percentage}%`,
                height: '100%',
                backgroundColor: getProgressColor(quotas.members.percentage),
                borderRadius: '4px',
                transition: 'width 0.4s ease',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11.5px',
              color: 'var(--text-muted)',
            }}
          >
            <span>
              {quotas.members.percentage}% {t('dashboard.tenantAdmin.subscription.used')}
            </span>
            <span>
              {quotas.members.remaining}{' '}
              {t('dashboard.tenantAdmin.subscription.remaining')}
            </span>
          </div>
        </div>

        {/* Quota 3: Enabled Modules */}
        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--badge-warning-bg)',
                  color: 'var(--amber-500)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Layers size={18} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-heading)' }}>
                  {t('dashboard.tenantAdmin.subscription.modulesQuota')}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {t('dashboard.tenantAdmin.subscription.modulesSubtitle')}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                {quotas.modules.used}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
                {' '}/ {quotas.modules.allocated}
              </span>
            </div>
          </div>

          {/* Module Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
            {quotas.modules.enabledList.map((modKey) => (
              <span
                key={modKey}
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--badge-primary-bg)',
                  color: 'var(--primary-600)',
                  border: '1px solid rgba(15, 118, 110, 0.2)',
                }}
              >
                {modKey === 'LAB'
                  ? t('common.moduleDentalLab')
                  : modKey === 'CLINIC'
                  ? t('common.moduleDentalClinic')
                  : modKey}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
