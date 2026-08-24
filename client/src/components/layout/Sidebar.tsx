import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../core/context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Layers,
  CreditCard,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Shield,
  User as UserIcon,
} from 'lucide-react';

interface SidebarProps {
  activeModuleMode: 'PLATFORM' | 'CLINIC' | 'LAB';
}

interface SidebarNavItemProps {
  to: string;
  end?: boolean;
  icon: React.ReactNode;
  label: string;
  isCollapsed: boolean;
}

const SidebarNavItem: React.FC<SidebarNavItemProps> = ({
  to,
  end = false,
  icon,
  label,
  isCollapsed,
}) => {
  return (
    <div className="nav-item-wrapper">
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        aria-label={label}
      >
        <span className="nav-link-icon">{icon}</span>
        {!isCollapsed && <span className="nav-link-text">{label}</span>}
      </NavLink>
      {isCollapsed && (
        <div className="sidebar-tooltip" role="tooltip">
          <span>{label}</span>
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ activeModuleMode }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('ud_sidebar_collapsed') === 'true';
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('ud_sidebar_collapsed', String(next));
      return next;
    });
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';
  const roleName = user?.roles?.[0] || (user?.isSuperAdmin ? 'Super Admin' : 'User');

  return (
    <aside className={`app-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Brand & Collapse Header */}
      <div className="sidebar-brand">
        {!isCollapsed ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, overflow: 'hidden' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: '#0f766e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  flexShrink: 0,
                }}
              >
                🦷
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '15px',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: '#ffffff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Unified Dental
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    color: '#06b6d4',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  {t('nav.platformAdmin')}
                </span>
              </div>
            </div>

            <button
              onClick={toggleCollapse}
              className="sidebar-collapse-btn"
              title={t('nav.collapseSidebar')}
              aria-label={t('nav.collapseSidebar')}
            >
              <PanelLeftClose size={16} />
            </button>
          </>
        ) : (
          <div className="sidebar-collapsed-brand">
            <button
              onClick={toggleCollapse}
              className="sidebar-expand-btn-top"
              title={t('nav.expandSidebar')}
              aria-label={t('nav.expandSidebar')}
            >
              <span className="brand-logo-icon">🦷</span>
              <span className="expand-overlay-icon">
                <PanelLeftOpen size={16} />
              </span>
            </button>
            <div className="sidebar-tooltip brand-tooltip" role="tooltip">
              <div style={{ fontWeight: 700, color: '#ffffff' }}>Unified Dental</div>
              <div style={{ fontSize: '11px', color: '#06b6d4', marginTop: '1px' }}>
                {t('nav.expandSidebar')}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        {!isCollapsed && (
          <div className="nav-section-title">{t('nav.coreOperations')}</div>
        )}
        {isCollapsed && <div className="nav-section-divider" />}

        <SidebarNavItem
          to="/"
          end
          icon={<LayoutDashboard size={19} />}
          label={t('nav.dashboard')}
          isCollapsed={isCollapsed}
        />

        {user?.isSuperAdmin && (
          <>
            <SidebarNavItem
              to="/tenants"
              icon={<Building2 size={19} />}
              label={t('nav.tenants')}
              isCollapsed={isCollapsed}
            />

            <SidebarNavItem
              to="/modules"
              icon={<Layers size={19} />}
              label={t('nav.modules')}
              isCollapsed={isCollapsed}
            />

            <SidebarNavItem
              to="/plans"
              icon={<CreditCard size={19} />}
              label={t('nav.subscriptionPlans')}
              isCollapsed={isCollapsed}
            />
          </>
        )}
      </nav>

      {/* Sidebar Footer: User Login Profile & Expand Action */}
      <div className="sidebar-footer">
        {!isCollapsed ? (
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar">
              {userInitial}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name" title={user?.name}>
                {user?.name || 'Administrator'}
              </div>
              <div className="sidebar-user-email" title={user?.email}>
                {user?.email || 'admin@example.com'}
              </div>
              <div className="sidebar-user-role-badge">
                <Shield size={10} style={{ color: '#2dd4bf' }} />
                <span>{roleName}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="sidebar-collapsed-user-wrapper">
            <div className="sidebar-user-avatar-collapsed" onClick={toggleCollapse}>
              {userInitial}
            </div>
            <div className="sidebar-tooltip user-tooltip" role="tooltip">
              <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '13px' }}>
                {user?.name || 'Administrator'}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                {user?.email}
              </div>
              <div
                style={{
                  fontSize: '10px',
                  color: '#2dd4bf',
                  fontWeight: 600,
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  textTransform: 'uppercase',
                }}
              >
                <Shield size={10} /> {roleName}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
