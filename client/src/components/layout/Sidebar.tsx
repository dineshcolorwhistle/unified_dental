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
  LogOut,
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

function formatTitleCase(str: string): string {
  if (!str) return '';
  return str
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function getBrandInitials(name: string): string {
  if (!name) return 'UD';
  const words = name.replace(/[-_]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
  if (words.length === 1 && words[0].length >= 2) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0]?.charAt(0) || 'U').toUpperCase();
}

export const Sidebar: React.FC<SidebarProps> = ({ activeModuleMode }) => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
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

  const isTenantContext = Boolean(user?.activeTenant);
  const rawBrandName = isTenantContext ? user!.activeTenant!.name : 'Unified Dental';
  const brandName = formatTitleCase(rawBrandName);
  const brandInitials = isTenantContext ? getBrandInitials(rawBrandName) : '🦷';

  return (
    <aside className={`app-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Brand & Collapse Header */}
      <div className="sidebar-brand">
        {!isCollapsed ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, overflow: 'hidden' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '9px',
                  background: 'linear-gradient(135deg, #0f766e, #0d9488)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isTenantContext ? '13px' : '18px',
                  flexShrink: 0,
                  color: '#ffffff',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  boxShadow: '0 2px 6px rgba(15, 118, 110, 0.35)',
                }}
              >
                {brandInitials}
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
                  title={brandName}
                >
                  {brandName}
                </span>
                {!isTenantContext && (
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
                )}
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
              <span className="brand-logo-icon">{brandInitials}</span>
              <span className="expand-overlay-icon">
                <PanelLeftOpen size={16} />
              </span>
            </button>
            <div className="sidebar-tooltip brand-tooltip" role="tooltip">
              <div style={{ fontWeight: 700, color: '#ffffff' }}>{brandName}</div>
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

        {/* Tenant Specific Management Menu Items (Connected to selected module) */}
        {isTenantContext && (
          <SidebarNavItem
            to="/branches"
            icon={<Building2 size={19} />}
            label={t('nav.branches')}
            isCollapsed={isCollapsed}
          />
        )}

        {/* Platform Super Admin Items */}
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

      {/* Sidebar Footer: User Login Profile & Logout Action */}
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
            <button
              onClick={logout}
              className="sidebar-logout-btn"
              title={t('nav.logout')}
              aria-label={t('nav.logout')}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="sidebar-collapsed-footer-container">
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

            <button
              onClick={logout}
              className="sidebar-collapsed-logout-btn"
              title={t('nav.logout')}
              aria-label={t('nav.logout')}
            >
              <LogOut size={16} />
              <div className="sidebar-tooltip" role="tooltip">
                {t('nav.logout')}
              </div>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
