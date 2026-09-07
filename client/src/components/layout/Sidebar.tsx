import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../core/context/AuthContext';
import { useModule } from '../../core/context/ModuleContext';
import {
  LayoutDashboard,
  Building2,
  Settings,
  CreditCard,
  Bell,
  Package,
  Receipt,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  LogOut,
  ChevronDown,
  Sparkles,
  DollarSign,
  ClipboardList,
  Clock,
  // Lab module icons
  FlaskConical,
  Users,
  Shapes,
  Workflow,
  Layers,
  MessageSquare,
  // Clinic module icons
  Stethoscope,
  CalendarCheck,
  UserRound,
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
  const location = useLocation();
  const { user, isTenantAdmin, isLabAdmin, logout } = useAuth();
  const { isClinicEnabled, isLabEnabled } = useModule();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('ud_sidebar_collapsed') === 'true';
  });

  const isTenantContext = Boolean(user?.activeTenant);
  const isPlatformAdmin = Boolean(user?.isSuperAdmin && !isTenantContext);

  const isLabTechnician = Boolean(
    !isTenantAdmin &&
      !isLabAdmin &&
      user?.roles?.some((r) => {
        const lower = r.toLowerCase();
        return lower === 'lab technician' || lower === 'technician' || lower === 'lab-technician';
      }),
  );

  // Determine active section from initial route, default to 'core' on page load
  const getInitialActiveGroup = (): 'core' | 'lab' | 'clinic' | null => {
    const p = location.pathname;
    if (p.startsWith('/lab')) return 'lab';
    if (p.startsWith('/clinic')) return 'clinic';
    return 'core';
  };

  // Single-expand accordion state: only ONE menu group can be expanded at a time
  const [expandedGroup, setExpandedGroup] = useState<'core' | 'lab' | 'clinic' | null>(getInitialActiveGroup);

  // Submenu states for Users inside Dental Lab & Dental Clinic
  const [isLabUsersOpen, setIsLabUsersOpen] = useState<boolean>(() => {
    return location.pathname.startsWith('/lab/users') || location.pathname.startsWith('/lab/staff');
  });

  const [isClinicUsersOpen, setIsClinicUsersOpen] = useState<boolean>(() => {
    return location.pathname.startsWith('/clinic/users') || location.pathname.startsWith('/clinic/staff');
  });

  // Automatically keep accordion in sync with the currently active / selected menu route
  useEffect(() => {
    const p = location.pathname;
    if (p.startsWith('/lab')) {
      setExpandedGroup('lab');
      if (p.startsWith('/lab/users') || p.startsWith('/lab/staff')) {
        setIsLabUsersOpen(true);
      }
    } else if (p.startsWith('/clinic')) {
      setExpandedGroup('clinic');
      if (p.startsWith('/clinic/users') || p.startsWith('/clinic/staff')) {
        setIsClinicUsersOpen(true);
      }
    } else {
      // Core Operations: '/', '/branches', '/settings', '/finance', '/reminders', '/inventory', '/expenses'
      setExpandedGroup('core');
    }
  }, [location.pathname]);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('ud_sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleGroupToggle = (groupKey: 'core' | 'lab' | 'clinic') => {
    setExpandedGroup((prev) => (prev === groupKey ? null : groupKey));
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';
  const roleName = user?.roles?.[0] || (user?.isSuperAdmin ? 'Super Admin' : 'User');

  const rawBrandName = isTenantContext ? user!.activeTenant!.name : 'Unified Dental';
  const brandName = formatTitleCase(rawBrandName);
  const tenantLogoUrl = isTenantContext ? (user?.activeTenant?.settings as any)?.logoUrl : null;
  const brandInitials = isTenantContext ? getBrandInitials(rawBrandName) : '🦷';

  const isCoreActive = ['/', '/branches', '/settings', '/finance', '/reminders', '/inventory', '/expenses'].includes(
    location.pathname,
  );
  const isLabActive = location.pathname.startsWith('/lab');
  const isClinicActive = location.pathname.startsWith('/clinic');

  const isLabUsersActive =
    location.pathname.startsWith('/lab/users') || location.pathname.startsWith('/lab/staff');
  const isClinicUsersActive =
    location.pathname.startsWith('/clinic/users') || location.pathname.startsWith('/clinic/staff');

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
                  background: tenantLogoUrl ? 'var(--bg-surface)' : 'linear-gradient(135deg, #0f766e, #0d9488)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isTenantContext ? '13px' : '18px',
                  flexShrink: 0,
                  color: '#ffffff',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  boxShadow: '0 2px 6px rgba(15, 118, 110, 0.35)',
                  border: tenantLogoUrl ? '1px solid var(--border-color)' : 'none',
                  overflow: 'hidden',
                }}
              >
                {tenantLogoUrl ? (
                  <img
                    src={tenantLogoUrl}
                    alt={brandName}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}
                  />
                ) : (
                  brandInitials
                )}
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
              {tenantLogoUrl ? (
                <img
                  src={tenantLogoUrl}
                  alt={brandName}
                  style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                />
              ) : (
                <span className="brand-logo-icon">{brandInitials}</span>
              )}
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
        {/* ───── 1. Flat Menu for Platform Super Admin ───── */}
        {isPlatformAdmin ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px 0' }}>
            <SidebarNavItem
              to="/"
              end
              icon={<LayoutDashboard size={17} />}
              label={t('nav.dashboard')}
              isCollapsed={isCollapsed}
            />
            <SidebarNavItem
              to="/tenants"
              icon={<Building2 size={17} />}
              label={t('nav.tenants')}
              isCollapsed={isCollapsed}
            />
            <SidebarNavItem
              to="/modules"
              icon={<Layers size={17} />}
              label={t('nav.modules')}
              isCollapsed={isCollapsed}
            />
            <SidebarNavItem
              to="/plans"
              icon={<CreditCard size={17} />}
              label={t('nav.subscriptionPlans')}
              isCollapsed={isCollapsed}
            />
          </div>
        ) : isLabTechnician ? (
          /* ───── 2. Flat Menu for Lab Technician (Finalized) ───── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px 0' }}>
            <SidebarNavItem
              to="/"
              end
              icon={<LayoutDashboard size={17} />}
              label={t('nav.dashboard')}
              isCollapsed={isCollapsed}
            />

            <SidebarNavItem
              to="/lab/work-orders/my"
              icon={<ClipboardList size={17} />}
              label={t('nav.myWorkorder')}
              isCollapsed={isCollapsed}
            />

            <SidebarNavItem
              to="/lab/work-orders/requested"
              icon={<Clock size={17} />}
              label={t('nav.requestedOrder')}
              isCollapsed={isCollapsed}
            />
          </div>
        ) : (isTenantAdmin || isLabAdmin) && activeModuleMode === 'LAB' && isLabEnabled ? (
          /* ───── 3. Collapsible Accordion Menu for Tenant Admin & Lab Admin (Lab Module) ───── */
          <>
            {/* Group 1: Core Operations */}
            <div className="nav-accordion-group">
              {!isCollapsed ? (
                <button
                  type="button"
                  className={`nav-accordion-header ${expandedGroup === 'core' ? 'is-open' : ''} ${
                    isCoreActive ? 'has-active-child' : ''
                  }`}
                  onClick={() => handleGroupToggle('core')}
                  aria-expanded={expandedGroup === 'core'}
                >
                  <div className="nav-accordion-header-left">
                    <Sparkles size={14} style={{ opacity: 0.85, color: '#38bdf8' }} />
                    <span>{t('nav.coreOperations')}</span>
                  </div>
                  <div className="nav-accordion-header-right">
                    <span className={`accordion-chevron ${expandedGroup === 'core' ? 'is-open' : ''}`}>
                      <ChevronDown size={14} />
                    </span>
                  </div>
                </button>
              ) : (
                <div className="nav-section-divider" />
              )}

              <div
                className={`nav-accordion-content has-tree-line ${
                  isCollapsed || expandedGroup === 'core' ? 'is-expanded' : 'is-collapsed'
                }`}
              >
                <SidebarNavItem
                  to="/"
                  end
                  icon={<LayoutDashboard size={17} />}
                  label={t('nav.dashboard')}
                  isCollapsed={isCollapsed}
                />

                {isTenantAdmin && (
                  <SidebarNavItem
                    to="/branches"
                    icon={<Building2 size={17} />}
                    label={t('nav.branches')}
                    isCollapsed={isCollapsed}
                  />
                )}

                <SidebarNavItem
                  to="/settings"
                  icon={<Settings size={17} />}
                  label={t('nav.settings')}
                  isCollapsed={isCollapsed}
                />

                <SidebarNavItem
                  to="/finance"
                  icon={<CreditCard size={17} />}
                  label={t('nav.finance')}
                  isCollapsed={isCollapsed}
                />

                <SidebarNavItem
                  to="/reminders"
                  icon={<Bell size={17} />}
                  label={t('nav.remainder')}
                  isCollapsed={isCollapsed}
                />

                <SidebarNavItem
                  to="/inventory"
                  icon={<Package size={17} />}
                  label={t('nav.inventory')}
                  isCollapsed={isCollapsed}
                />

                <SidebarNavItem
                  to="/expenses"
                  icon={<Receipt size={17} />}
                  label={t('nav.expenses')}
                  isCollapsed={isCollapsed}
                />
              </div>
            </div>

            {/* Group 2: Dental Lab */}
            <div className="nav-accordion-group">
              {!isCollapsed ? (
                <button
                  type="button"
                  className={`nav-accordion-header ${expandedGroup === 'lab' ? 'is-open' : ''} ${
                    isLabActive ? 'has-active-child' : ''
                  }`}
                  onClick={() => handleGroupToggle('lab')}
                  aria-expanded={expandedGroup === 'lab'}
                >
                  <div className="nav-accordion-header-left">
                    <FlaskConical size={14} style={{ opacity: 0.85, color: '#2dd4bf' }} />
                    <span>{t('nav.dentalLab')}</span>
                  </div>
                  <div className="nav-accordion-header-right">
                    <span className={`accordion-chevron ${expandedGroup === 'lab' ? 'is-open' : ''}`}>
                      <ChevronDown size={14} />
                    </span>
                  </div>
                </button>
              ) : (
                <div className="nav-section-divider" />
              )}

              <div
                className={`nav-accordion-content has-tree-line ${
                  isCollapsed || expandedGroup === 'lab' ? 'is-expanded' : 'is-collapsed'
                }`}
              >
                {/* Nested Users Sub-menu (Tree-Line Indented) */}
                {!isCollapsed ? (
                  <div className="nav-sub-group">
                    <button
                      type="button"
                      className={`nav-sub-header ${isLabUsersActive ? 'has-active' : ''}`}
                      onClick={() => setIsLabUsersOpen((prev) => !prev)}
                      aria-expanded={isLabUsersOpen}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="nav-link-icon">
                          <Users size={17} />
                        </span>
                        <span className="nav-link-text">{t('nav.labUsers')}</span>
                      </div>
                      <span className={`accordion-chevron ${isLabUsersOpen ? 'is-open' : ''}`}>
                        <ChevronDown size={13} />
                      </span>
                    </button>

                    <div className={`nav-sub-list ${isLabUsersOpen ? 'is-expanded' : 'is-collapsed'}`}>
                      {isTenantAdmin && (
                        <NavLink
                          to="/lab/users/admin"
                          className={({ isActive }) => `nav-sub-link ${isActive ? 'active' : ''}`}
                        >
                          <span>{t('nav.labAdmin')}</span>
                        </NavLink>
                      )}
                      <NavLink
                        to="/lab/users/technicians"
                        className={({ isActive }) => `nav-sub-link ${isActive ? 'active' : ''}`}
                      >
                        <span>{t('nav.technician')}</span>
                      </NavLink>
                      <NavLink
                        to="/lab/users/doctors"
                        className={({ isActive }) => `nav-sub-link ${isActive ? 'active' : ''}`}
                      >
                        <span>{t('nav.doctors')}</span>
                      </NavLink>
                    </div>
                  </div>
                ) : (
                  <>
                    {isTenantAdmin && (
                      <SidebarNavItem
                        to="/lab/users/admin"
                        icon={<Users size={17} />}
                        label={t('nav.labAdmin')}
                        isCollapsed={isCollapsed}
                      />
                    )}
                    <SidebarNavItem
                      to="/lab/users/technicians"
                      icon={<Users size={17} />}
                      label={t('nav.technician')}
                      isCollapsed={isCollapsed}
                    />
                    <SidebarNavItem
                      to="/lab/users/doctors"
                      icon={<Users size={17} />}
                      label={t('nav.doctors')}
                      isCollapsed={isCollapsed}
                    />
                  </>
                )}

                <SidebarNavItem
                  to="/lab/work-orders"
                  icon={<ClipboardList size={17} />}
                  label={t('nav.labWorkOrdersMenu')}
                  isCollapsed={isCollapsed}
                />

                <SidebarNavItem
                  to="/lab/prosthesis-types"
                  icon={<Shapes size={17} />}
                  label={t('nav.prosthesisType')}
                  isCollapsed={isCollapsed}
                />

                <SidebarNavItem
                  to="/lab/processes"
                  icon={<Workflow size={17} />}
                  label={t('nav.process')}
                  isCollapsed={isCollapsed}
                />

                <SidebarNavItem
                  to="/lab/process-areas"
                  icon={<Layers size={17} />}
                  label={t('nav.processAreas')}
                  isCollapsed={isCollapsed}
                />

                <SidebarNavItem
                  to="/lab/whatsapp-templates"
                  icon={<MessageSquare size={17} />}
                  label={t('nav.whatsappTemplate')}
                  isCollapsed={isCollapsed}
                />
              </div>
            </div>
          </>
        ) : activeModuleMode === 'CLINIC' && isClinicEnabled ? (
          /* ───── 4. Clinic Mode (Preserved until finalized later) ───── */
          <>
            <div className="nav-accordion-group">
              {!isCollapsed ? (
                <button
                  type="button"
                  className={`nav-accordion-header ${expandedGroup === 'core' ? 'is-open' : ''} ${
                    isCoreActive ? 'has-active-child' : ''
                  }`}
                  onClick={() => handleGroupToggle('core')}
                  aria-expanded={expandedGroup === 'core'}
                >
                  <div className="nav-accordion-header-left">
                    <Sparkles size={14} style={{ opacity: 0.85, color: '#38bdf8' }} />
                    <span>{t('nav.coreOperations')}</span>
                  </div>
                  <div className="nav-accordion-header-right">
                    <span className={`accordion-chevron ${expandedGroup === 'core' ? 'is-open' : ''}`}>
                      <ChevronDown size={14} />
                    </span>
                  </div>
                </button>
              ) : (
                <div className="nav-section-divider" />
              )}

              <div
                className={`nav-accordion-content has-tree-line ${
                  isCollapsed || expandedGroup === 'core' ? 'is-expanded' : 'is-collapsed'
                }`}
              >
                <SidebarNavItem
                  to="/"
                  end
                  icon={<LayoutDashboard size={17} />}
                  label={t('nav.dashboard')}
                  isCollapsed={isCollapsed}
                />

                {isTenantAdmin && (
                  <SidebarNavItem
                    to="/branches"
                    icon={<Building2 size={17} />}
                    label={t('nav.branches')}
                    isCollapsed={isCollapsed}
                  />
                )}

                <SidebarNavItem
                  to="/settings"
                  icon={<Settings size={17} />}
                  label={t('nav.settings')}
                  isCollapsed={isCollapsed}
                />

                <SidebarNavItem
                  to="/finance"
                  icon={<CreditCard size={17} />}
                  label={t('nav.finance')}
                  isCollapsed={isCollapsed}
                />

                <SidebarNavItem
                  to="/reminders"
                  icon={<Bell size={17} />}
                  label={t('nav.remainder')}
                  isCollapsed={isCollapsed}
                />

                <SidebarNavItem
                  to="/inventory"
                  icon={<Package size={17} />}
                  label={t('nav.inventory')}
                  isCollapsed={isCollapsed}
                />

                <SidebarNavItem
                  to="/expenses"
                  icon={<Receipt size={17} />}
                  label={t('nav.expenses')}
                  isCollapsed={isCollapsed}
                />
              </div>
            </div>

            <div className="nav-accordion-group">
              {!isCollapsed ? (
                <button
                  type="button"
                  className={`nav-accordion-header ${expandedGroup === 'clinic' ? 'is-open' : ''} ${
                    isClinicActive ? 'has-active-child' : ''
                  }`}
                  onClick={() => handleGroupToggle('clinic')}
                  aria-expanded={expandedGroup === 'clinic'}
                >
                  <div className="nav-accordion-header-left">
                    <Stethoscope size={14} style={{ opacity: 0.85, color: '#38bdf8' }} />
                    <span>{t('nav.dentalClinic')}</span>
                  </div>
                  <div className="nav-accordion-header-right">
                    <span className={`accordion-chevron ${expandedGroup === 'clinic' ? 'is-open' : ''}`}>
                      <ChevronDown size={14} />
                    </span>
                  </div>
                </button>
              ) : (
                <div className="nav-section-divider" />
              )}

              <div
                className={`nav-accordion-content has-tree-line ${
                  isCollapsed || expandedGroup === 'clinic' ? 'is-expanded' : 'is-collapsed'
                }`}
              >
                {!isCollapsed ? (
                  <div className="nav-sub-group">
                    <button
                      type="button"
                      className={`nav-sub-header ${isClinicUsersActive ? 'has-active' : ''}`}
                      onClick={() => setIsClinicUsersOpen((prev) => !prev)}
                      aria-expanded={isClinicUsersOpen}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="nav-link-icon">
                          <Users size={17} />
                        </span>
                        <span className="nav-link-text">{t('nav.clinicUsers')}</span>
                      </div>
                      <span className={`accordion-chevron ${isClinicUsersOpen ? 'is-open' : ''}`}>
                        <ChevronDown size={13} />
                      </span>
                    </button>

                    <div className={`nav-sub-list ${isClinicUsersOpen ? 'is-expanded' : 'is-collapsed'}`}>
                      <NavLink
                        to="/clinic/users/admin"
                        className={({ isActive }) => `nav-sub-link ${isActive ? 'active' : ''}`}
                      >
                        <span>{t('nav.clinicAdmin')}</span>
                      </NavLink>
                      <NavLink
                        to="/clinic/users/staff"
                        className={({ isActive }) => `nav-sub-link ${isActive ? 'active' : ''}`}
                      >
                        <span>{t('nav.clinicStaff')}</span>
                      </NavLink>
                      <NavLink
                        to="/clinic/users/doctors"
                        className={({ isActive }) => `nav-sub-link ${isActive ? 'active' : ''}`}
                      >
                        <span>{t('nav.clinicDoctors')}</span>
                      </NavLink>
                    </div>
                  </div>
                ) : (
                  <>
                    <SidebarNavItem
                      to="/clinic/users/admin"
                      icon={<Users size={17} />}
                      label={t('nav.clinicAdmin')}
                      isCollapsed={isCollapsed}
                    />
                    <SidebarNavItem
                      to="/clinic/users/staff"
                      icon={<Users size={17} />}
                      label={t('nav.clinicStaff')}
                      isCollapsed={isCollapsed}
                    />
                    <SidebarNavItem
                      to="/clinic/users/doctors"
                      icon={<Users size={17} />}
                      label={t('nav.clinicDoctors')}
                      isCollapsed={isCollapsed}
                    />
                  </>
                )}

                <SidebarNavItem
                  to="/clinic/patients"
                  icon={<UserRound size={17} />}
                  label={t('nav.patient')}
                  isCollapsed={isCollapsed}
                />

                <SidebarNavItem
                  to="/clinic/appointments"
                  icon={<CalendarCheck size={17} />}
                  label={t('nav.appointment')}
                  isCollapsed={isCollapsed}
                />

                <SidebarNavItem
                  to="/clinic/income"
                  icon={<DollarSign size={17} />}
                  label={t('nav.income')}
                  isCollapsed={isCollapsed}
                />
              </div>
            </div>
          </>
        ) : (
          /* ───── 5. Fallback Standard Menus for other authenticated users ───── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px 0' }}>
            <SidebarNavItem
              to="/"
              end
              icon={<LayoutDashboard size={17} />}
              label={t('nav.dashboard')}
              isCollapsed={isCollapsed}
            />
          </div>
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
