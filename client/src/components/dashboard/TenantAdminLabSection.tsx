import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Activity,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Users,
  ChevronRight,
  FlaskConical,
} from 'lucide-react';
import { LabModuleSectionData } from '../../services/tenantDashboardService';
import { Tooltip } from '../common/Tooltip';

interface TenantAdminLabSectionProps {
  data: LabModuleSectionData;
}

export const TenantAdminLabSection: React.FC<TenantAdminLabSectionProps> = ({ data }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { branches, kpis } = data;

  const kpiCards = [
    {
      label: t('dashboard.tenantAdmin.lab.activeWorkOrders'),
      value: kpis.activeOrders,
      icon: <Activity size={22} />,
      color: 'var(--primary-600)',
      bg: 'var(--badge-primary-bg)',
      borderColor: 'var(--primary-400)',
      onClick: () => navigate('/lab/work-orders?status=ACTIVE'),
    },
    {
      label: t('dashboard.tenantAdmin.lab.inProgressPipeline'),
      value: kpis.inProgressOrders,
      icon: <Clock size={22} />,
      color: 'var(--sky-500)',
      bg: 'var(--badge-info-bg)',
      borderColor: 'var(--sky-400)',
      onClick: () => navigate('/lab/work-orders?status=IN_PROGRESS'),
    },
    {
      label: t('dashboard.tenantAdmin.lab.pendingVerifications'),
      value: kpis.pendingVerifications,
      icon: <ShieldCheck size={22} />,
      color: 'var(--amber-500)',
      bg: 'var(--badge-warning-bg)',
      borderColor: 'var(--amber-400)',
      onClick: () => navigate('/lab/work-orders?status=INTERNAL_VERIFICATION'),
    },
    {
      label: t('dashboard.tenantAdmin.lab.completedOrders'),
      value: kpis.completedOrders,
      icon: <CheckCircle2 size={22} />,
      color: 'var(--emerald-500)',
      bg: 'var(--badge-success-bg)',
      borderColor: 'var(--emerald-400)',
      onClick: () => navigate('/lab/work-orders?status=COMPLETED'),
    },
    {
      label: t('dashboard.tenantAdmin.lab.totalTechnicians'),
      value: kpis.totalTechnicians,
      icon: <Users size={22} />,
      color: '#9333ea',
      bg: 'rgba(147, 51, 234, 0.1)',
      borderColor: 'rgba(147, 51, 234, 0.3)',
      onClick: () => navigate('/lab/staff/technicians'),
    },
  ];

  return (
    <div>
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
            <FlaskConical size={18} />
          </div>
          <div>
            <h3
              style={{
                fontSize: '17px',
                fontWeight: 800,
                color: 'var(--text-heading)',
                margin: 0,
                fontFamily: 'var(--font-heading)',
              }}
            >
              {t('dashboard.tenantAdmin.lab.sectionTitle')}
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
              {t('dashboard.tenantAdmin.lab.sectionSubtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Lab Branch Count Highlight Card */}
      <div
        className="card"
        style={{
          padding: '18px 24px',
          marginBottom: '20px',
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'var(--badge-primary-bg)',
              color: 'var(--primary-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Building2 size={24} />
          </div>
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {t('dashboard.tenantAdmin.lab.labBranchesCountTitle')}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '2px' }}>
              <span
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  lineHeight: 1.1,
                }}
              >
                {branches.totalLabBranches}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                ({branches.activeLabBranches} {t('dashboard.tenantAdmin.lab.activeBranches')})
              </span>
            </div>
          </div>
        </div>

        <Tooltip content={t('dashboard.tenantAdmin.lab.manageBranchesTooltip')}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/branches')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <Building2 size={16} />
            <span>{t('dashboard.tenantAdmin.lab.viewBranches')}</span>
            <ChevronRight size={15} />
          </button>
        </Tooltip>
      </div>

      {/* Aggregate KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {kpiCards.map((kpi, idx) => (
          <div
            key={idx}
            onClick={kpi.onClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '18px 20px',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              borderLeft: `4px solid ${kpi.borderColor}`,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.06)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: kpi.bg,
                color: kpi.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {kpi.icon}
            </div>
            <div>
              <div
                style={{
                  fontSize: '26px',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  lineHeight: 1.1,
                }}
              >
                {kpi.value}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginTop: '4px',
                }}
              >
                {kpi.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
