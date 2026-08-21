import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../core/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import { BranchSwitcher } from './BranchSwitcher';
import { NotificationDropdown } from './NotificationDropdown';
import {
  User,
  LogOut,
  Shield,
  Stethoscope,
  FlaskConical,
  ChevronDown,
  Building,
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
  const { t } = useTranslation();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

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
  const isLabEnabled = tenant?.enabledModules.includes('LAB');
  const isClinicEnabled = tenant?.enabledModules.includes('CLINIC');

  return (
    <header className="app-header">
      {/* Header Left: Tenant Info & Branch Switcher */}
      <div className="header-left">
        {tenant ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0f766e, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              {tenant.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', lineHeight: 1.2 }}>
                {tenant.name}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                <span style={{ color: '#0f766e', fontWeight: 600 }}>{tenant.slug}</span>.app.example.com
              </div>
            </div>
          </div>
        ) : user?.isSuperAdmin ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} style={{ color: '#0f766e' }} />
            <span style={{ fontWeight: 700, fontSize: '14px' }}>Platform Super Admin</span>
          </div>
        ) : null}

        {/* Branch Switcher */}
        {tenant && <BranchSwitcher />}
      </div>

      {/* Header Right: Module Selector, Language Switcher, Notifications, Profile */}
      <div className="header-right">
        {/* Module Mode Pills */}
        <div
          style={{
            display: 'flex',
            backgroundColor: '#f1f5f9',
            padding: '3px',
            borderRadius: '8px',
            gap: '2px',
          }}
        >
          {user?.isSuperAdmin && (
            <button
              onClick={() => onModuleModeChange('PLATFORM')}
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
                backgroundColor: activeModuleMode === 'PLATFORM' ? '#ffffff' : 'transparent',
                color: activeModuleMode === 'PLATFORM' ? '#0f172a' : '#64748b',
                boxShadow: activeModuleMode === 'PLATFORM' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <Shield size={13} /> {t('header.platformAdmin')}
            </button>
          )}

          {isClinicEnabled && (
            <button
              onClick={() => onModuleModeChange('CLINIC')}
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
                backgroundColor: activeModuleMode === 'CLINIC' ? '#ffffff' : 'transparent',
                color: activeModuleMode === 'CLINIC' ? '#0f766e' : '#64748b',
                boxShadow: activeModuleMode === 'CLINIC' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <Stethoscope size={13} /> {t('header.clinicModule')}
            </button>
          )}

          {isLabEnabled && (
            <button
              onClick={() => onModuleModeChange('LAB')}
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
                backgroundColor: activeModuleMode === 'LAB' ? '#ffffff' : 'transparent',
                color: activeModuleMode === 'LAB' ? '#0f766e' : '#64748b',
                boxShadow: activeModuleMode === 'LAB' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <FlaskConical size={13} /> {t('header.labModule')}
            </button>
          )}
        </div>

        {/* Language Switcher */}
        <LanguageSwitcher />

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
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#0f766e',
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
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {user?.roles[0] || 'User'}
              </div>
            </div>
            <ChevronDown size={14} style={{ color: '#94a3b8' }} />
          </button>

          {profileOpen && (
            <div
              style={{
                position: 'absolute',
                top: '110%',
                right: 0,
                width: '220px',
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                border: '1px solid #e2e8f0',
                padding: '6px',
                zIndex: 60,
              }}
            >
              <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{user?.name}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>{user?.email}</div>
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
                  color: '#e11d48',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  marginTop: '4px',
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
