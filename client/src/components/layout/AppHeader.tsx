import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/context/AuthContext';
import { useModule } from '../../core/context/ModuleContext';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NotificationDropdown } from './NotificationDropdown';
import { ThemeSwitcher } from './ThemeSwitcher';
import { BranchSwitcher } from './BranchSwitcher';
import {
  LogOut,
  Shield,
  Stethoscope,
  FlaskConical,
  ChevronDown,
} from 'lucide-react';

interface AppHeaderProps {
  activeModuleMode: 'PLATFORM' | 'CLINIC' | 'LAB';
  onModuleModeChange: (mode: 'PLATFORM' | 'CLINIC' | 'LAB') => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeModuleMode,
  onModuleModeChange,
}) => {
  const { user, logout } = useAuth();
  const { canSwitchModules, isClinicEnabled, isLabEnabled } = useModule();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const handleModuleSwitch = (mode: 'PLATFORM' | 'CLINIC' | 'LAB') => {
    onModuleModeChange(mode);
    navigate('/');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tenant = user?.activeTenant;

  return (
    <header className="app-header">
      {/* Header Left */}
      <div className="header-left">
        {user?.isSuperAdmin && !tenant && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} style={{ color: 'var(--primary-600)' }} />
            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>Platform Super Admin</span>
          </div>
        )}
      </div>

      {/* Header Right: Module Selector, Branch, Language Switcher, Theme Switcher, Notifications, Profile */}
      <div className="header-right">
        {/* Module Mode Selector / Badge */}
        {user?.isSuperAdmin && !tenant ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--primary-600)',
            }}
          >
            <Shield size={14} /> {t('header.platformAdmin')}
          </div>
        ) : canSwitchModules ? (
          /* Tenant Admin with Multiple Modules: Render Interactive Switcher Tabs */
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-surface-hover)',
              padding: '3px',
              borderRadius: '8px',
              gap: '2px',
              border: '1px solid var(--border-color)',
            }}
          >
            {isClinicEnabled && (
              <button
                onClick={() => handleModuleSwitch('CLINIC')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeModuleMode === 'CLINIC' ? 'var(--bg-surface)' : 'transparent',
                  color: activeModuleMode === 'CLINIC' ? 'var(--primary-600)' : 'var(--text-muted)',
                  boxShadow: activeModuleMode === 'CLINIC' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Stethoscope size={13} /> {t('header.clinicModule')}
              </button>
            )}

            {isLabEnabled && (
              <button
                onClick={() => handleModuleSwitch('LAB')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeModuleMode === 'LAB' ? 'var(--bg-surface)' : 'transparent',
                  color: activeModuleMode === 'LAB' ? 'var(--primary-600)' : 'var(--text-muted)',
                  boxShadow: activeModuleMode === 'LAB' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <FlaskConical size={13} /> {t('header.labModule')}
              </button>
            )}
          </div>
        ) : activeModuleMode === 'LAB' ? (
          /* Non-Tenant Admin locked to Lab: Static Badge */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--primary-600)',
            }}
          >
            <FlaskConical size={14} /> {t('header.labModule')}
          </div>
        ) : activeModuleMode === 'CLINIC' ? (
          /* Non-Tenant Admin locked to Clinic: Static Badge */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--primary-600)',
            }}
          >
            <Stethoscope size={14} /> {t('header.clinicModule')}
          </div>
        ) : null}

        {/* Branch Switcher */}
        {tenant && <BranchSwitcher />}

        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Theme Switcher */}
        <ThemeSwitcher />

        {/* Notifications */}
        <NotificationDropdown />

        {/* User Profile Dropdown */}
        <div style={{ position: 'relative' }} ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-surface)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-700)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '12px',
              }}
            >
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ textAlign: 'left', maxWidth: '120px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {user?.roles[0] || 'User'}
              </div>
            </div>
            <ChevronDown size={14} style={{ color: 'var(--text-subtle)' }} />
          </button>

          {profileOpen && (
            <div
              style={{
                position: 'absolute',
                top: '110%',
                right: 0,
                width: '220px',
                backgroundColor: 'var(--bg-dropdown)',
                borderRadius: '10px',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--border-color)',
                padding: '6px',
                zIndex: 60,
                animation: 'fadeIn 0.15s ease-out',
              }}
            >
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{user?.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user?.email}</div>
              </div>
              <button
                onClick={logout}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'transparent',
                  color: 'var(--rose-500)',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  marginTop: '4px',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--badge-danger-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <LogOut size={14} /> {t('nav.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
