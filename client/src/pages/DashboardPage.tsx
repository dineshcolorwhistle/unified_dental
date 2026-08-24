import React, { useState, useEffect } from 'react';
import { useAuth } from '../core/context/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Clock,
  Activity,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [tenants, setTenants] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [tenantsRes, auditRes] = await Promise.allSettled([
          api.get('/tenants'),
          api.get('/audit-logs?limit=5'),
        ]);

        const tenantList = tenantsRes.status === 'fulfilled' ? tenantsRes.value.data : [];
        const audit = auditRes.status === 'fulfilled' ? auditRes.value.data.logs || [] : [];

        setTenants(Array.isArray(tenantList) ? tenantList : []);
        setRecentLogs(audit);
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
            Unified Dental Platform — Super Admin Control Center
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px',
          marginBottom: '28px',
        }}
      >
        {/* Total Tenants */}
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
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Organizations
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)' }}>
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
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Active Tenants
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)' }}>
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
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Platform Role
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
              Platform Super Admin
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Phase 1 Announcement Card */}
          <div
            className="card"
            style={{
              background: 'linear-gradient(135deg, var(--primary-800), var(--primary-700))',
              color: '#ffffff',
              border: 'none',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Sparkles size={20} style={{ color: '#5eead4' }} />
              <h3 style={{ color: '#ffffff', fontSize: '18px' }}>
                Phase 1 Platform Foundation
              </h3>
            </div>
            <p style={{ color: '#ccfbf1', fontSize: '14px', lineHeight: 1.6, maxWidth: '600px' }}>
              Multi-tenant architecture is active with subdomain isolation, native JWT authentication, and tenant lifecycle provisioning.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginTop: '18px',
                borderTop: '1px solid rgba(255,255,255,0.15)',
                paddingTop: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#f0fdfa' }}>
                <CheckCircle2 size={16} style={{ color: '#5eead4' }} /> Native NestJS Auth (JWT + bcrypt)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#f0fdfa' }}>
                <CheckCircle2 size={16} style={{ color: '#5eead4' }} /> Subdomain Multi-Tenancy
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#f0fdfa' }}>
                <CheckCircle2 size={16} style={{ color: '#5eead4' }} /> Subdomain Login Isolation
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#f0fdfa' }}>
                <CheckCircle2 size={16} style={{ color: '#5eead4' }} /> Bilingual i18n (English & Español)
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="card">
            <h3 style={{ fontSize: '16px', marginBottom: '16px', color: 'var(--text-heading)' }}>
              {t('dashboard.quickActions')}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <Link to="/tenants" className="btn btn-primary" style={{ justifyContent: 'space-between', padding: '12px 16px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={16} /> Provision New Tenant
                </span>
                <ArrowRight size={14} />
              </Link>
              <Link to="/tenants" className="btn btn-secondary" style={{ justifyContent: 'space-between', padding: '12px 16px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={16} style={{ color: 'var(--primary-600)' }} /> View Organizations ({tenants.length})
                </span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Activity Feed */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Activity size={18} style={{ color: 'var(--primary-600)' }} />
            <h3 style={{ fontSize: '16px', color: 'var(--text-heading)' }}>{t('dashboard.recentActivity')}</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
            {recentLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-subtle)', fontSize: '13px' }}>
                No recent activity recorded yet.
              </div>
            ) : (
              recentLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-surface-hover)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="badge badge-info" style={{ fontSize: '10px' }}>
                      {log.action}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={10} /> {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginTop: '4px' }}>
                    {log.resourceType} {log.resourceId ? `(#${log.resourceId.substring(0, 8)})` : ''}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    By: {log.user?.name || 'Platform Admin'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
