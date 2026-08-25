import React, { useState, useEffect } from 'react';
import { useAuth } from '../core/context/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const tenantsRes = await api.get('/tenants');
        const tenantList = Array.isArray(tenantsRes.data) ? tenantsRes.data : [];
        setTenants(tenantList);
      } catch (e) {
        console.error('Failed to load dashboard stats:', e);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const activeTenantsCount = tenants.filter((t) => t.status === 'ACTIVE').length;

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
              <LayoutDashboard size={20} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {t('dashboard.welcomeTitle', { name: user?.name || 'Platform Administrator' })}
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            {t('dashboard.superAdminSubtitle')}
          </p>
        </div>
      </div>

      {/* Metrics Row - Top 3 Cards */}
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
    </div>
  );
};

