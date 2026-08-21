import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../core/context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Layers,
  CreditCard,
  Sparkles,
} from 'lucide-react';

interface SidebarProps {
  activeModuleMode: 'PLATFORM' | 'CLINIC' | 'LAB';
}

export const Sidebar: React.FC<SidebarProps> = ({ activeModuleMode }) => {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <aside className="app-sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: '#0f766e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
          }}
        >
          🦷
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
            Unified Dental
          </span>
          <span style={{ fontSize: '10px', color: '#06b6d4', fontWeight: 600, letterSpacing: '0.04em' }}>
            PLATFORM ADMIN
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        <div className="nav-section-title">Core Operations</div>

        <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={18} />
          <span>{t('nav.dashboard')}</span>
        </NavLink>

        {user?.isSuperAdmin && (
          <>
            <NavLink to="/tenants" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Building2 size={18} />
              <span>{t('nav.tenants')}</span>
            </NavLink>

            <NavLink to="/modules" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Layers size={18} />
              <span>Modules</span>
            </NavLink>

            <NavLink to="/plans" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <CreditCard size={18} />
              <span>Subscription Plans</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Phase status bottom pill */}
      <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div
          style={{
            backgroundColor: 'rgba(15, 118, 110, 0.25)',
            border: '1px solid rgba(20, 184, 166, 0.4)',
            borderRadius: '10px',
            padding: '10px 12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#2dd4bf' }}>
            <Sparkles size={14} /> Phase 1 Foundation
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
            Platform Admin & Tenancy
          </div>
        </div>
      </div>
    </aside>
  );
};
