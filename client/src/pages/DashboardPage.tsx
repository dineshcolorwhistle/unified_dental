import React, { useState, useEffect } from 'react';
import { useAuth } from '../core/context/AuthContext';
import { useModule } from '../core/context/ModuleContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { TechnicianDashboardPage } from './lab/TechnicianDashboardPage';
import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Stethoscope,
  FlaskConical,
  ClipboardList,
  Workflow,
  Truck,
  Users,
  CalendarCheck,
  HeartPulse,
  Info,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, isLabTechnician } = useAuth();
  const { activeModuleMode } = useModule();
  const { t } = useTranslation();

  if (isLabTechnician) {
    return <TechnicianDashboardPage />;
  }

  const isTenantContext = Boolean(user?.activeTenant);

  // Platform super admin states
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        if (!isTenantContext && user?.isSuperAdmin) {
          const tenantsRes = await api.get('/tenants');
          setTenants(Array.isArray(tenantsRes.data) ? tenantsRes.data : []);
        }
      } catch (e) {
        console.error('Failed to load dashboard stats:', e);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [isTenantContext, user?.isSuperAdmin]);

  const activeTenantsCount = tenants.filter((t) => t.status === 'ACTIVE').length;
  const isLabMode = activeModuleMode === 'LAB';
  const isClinicMode = activeModuleMode === 'CLINIC';

  return (
    <div>
      {/* Page Header / Welcome Message */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
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
              {isTenantContext ? (
                isLabMode ? <FlaskConical size={20} /> : <Stethoscope size={20} />
              ) : (
                <LayoutDashboard size={20} />
              )}
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {t('dashboard.welcomeTitle', { name: user?.name || 'Administrator' })}
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            {isTenantContext
              ? isLabMode
                ? t('dashboard.labDashboardSubtitle')
                : t('dashboard.clinicDashboardSubtitle')
              : t('dashboard.superAdminSubtitle')}
          </p>
        </div>
      </div>

      {/* ─── Platform Super Admin Metric Cards ─── */}
      {!isTenantContext && user?.isSuperAdmin && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
          }}
        >
          {/* Total Organizations */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
              }}
            >
              <Building2 size={24} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('dashboard.totalTenants')}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                {loading ? '...' : tenants.length}
              </div>
            </div>
          </div>

          {/* Active Organizations */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'var(--badge-info-bg)',
                color: 'var(--sky-500)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('dashboard.activeTenants')}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                {loading ? '...' : activeTenantsCount}
              </div>
            </div>
          </div>

          {/* Permissions / Security Stat */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'var(--badge-warning-bg)',
                color: 'var(--amber-500)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={24} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('dashboard.platformRole')}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                {t('dashboard.platformSuperAdmin')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tenant: Lab Module Dashboard ─── */}
      {isTenantContext && isLabMode && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '20px',
              marginBottom: '24px',
            }}
          >
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
                }}
              >
                <ClipboardList size={24} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('dashboard.labWorkOrders')}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                  0
                </div>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--badge-info-bg)',
                  color: 'var(--sky-500)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Workflow size={24} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('dashboard.labActiveProcesses')}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                  0
                </div>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--badge-success-bg)',
                  color: 'var(--emerald-500)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Truck size={24} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('dashboard.labDeliveries')}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                  0
                </div>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--badge-warning-bg)',
                  color: 'var(--amber-500)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Users size={24} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('dashboard.labStaffCount')}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                  0
                </div>
              </div>
            </div>
          </div>

          {/* Coming Soon Notice */}
          <div
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px 20px',
              borderLeft: '4px solid var(--primary-600)',
            }}
          >
            <Info size={18} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              {t('dashboard.comingSoon')}
            </p>
          </div>
        </>
      )}

      {/* ─── Tenant: Clinic Module Dashboard ─── */}
      {isTenantContext && isClinicMode && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '20px',
              marginBottom: '24px',
            }}
          >
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
                }}
              >
                <Users size={24} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('dashboard.clinicPatients')}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                  0
                </div>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--badge-info-bg)',
                  color: 'var(--sky-500)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CalendarCheck size={24} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('dashboard.clinicTodayAppointments')}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                  0
                </div>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--badge-success-bg)',
                  color: 'var(--emerald-500)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <HeartPulse size={24} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('dashboard.clinicTreatments')}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                  0
                </div>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--badge-warning-bg)',
                  color: 'var(--amber-500)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Users size={24} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('dashboard.clinicStaffCount')}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                  0
                </div>
              </div>
            </div>
          </div>

          {/* Coming Soon Notice */}
          <div
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px 20px',
              borderLeft: '4px solid var(--primary-600)',
            }}
          >
            <Info size={18} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              {t('dashboard.comingSoon')}
            </p>
          </div>
        </>
      )}
    </div>
  );
};
