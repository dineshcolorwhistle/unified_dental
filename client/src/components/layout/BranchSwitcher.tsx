import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../core/context/AuthContext';
import { useModule } from '../../core/context/ModuleContext';
import { Building2, ChevronDown, Check, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const BranchSwitcher: React.FC = () => {
  const { user, switchBranch } = useAuth();
  const { activeModuleMode } = useModule();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allBranches = user?.availableBranches || [];
  const branches = allBranches.filter((b) => {
    if (activeModuleMode === 'PLATFORM') return true;
    return (b.moduleKey || 'CLINIC').toUpperCase() === activeModuleMode;
  });

  const isAllSelected = !user?.activeBranchId || user?.activeBranchId === 'all';
  const activeBranch = isAllSelected ? null : branches.find((b) => b.id === user?.activeBranchId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user || !user.activeTenant) return null;

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="btn btn-secondary btn-sm"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: '8px',
          fontWeight: 600,
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-main)',
          transition: 'all 0.15s ease',
        }}
        aria-label={t('header.activeBranch')}
      >
        {isAllSelected ? (
          <Layers size={16} style={{ color: 'var(--primary-600)' }} />
        ) : (
          <Building2 size={16} style={{ color: 'var(--primary-600)' }} />
        )}
        <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' }}>
          {isAllSelected ? t('header.allBranches') : activeBranch?.name || t('header.selectBranch')}
        </span>
        <span
          className={isAllSelected ? 'badge badge-info' : 'badge badge-primary'}
          style={{ fontSize: '10px', padding: '1px 6px', letterSpacing: '0.04em' }}
        >
          {isAllSelected ? t('header.allBranchesBadge') : activeBranch?.code || 'BR'}
        </span>
        <ChevronDown size={14} style={{ color: 'var(--text-subtle)', marginLeft: '2px' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '115%',
            left: 0,
            width: '260px',
            backgroundColor: 'var(--bg-dropdown)',
            borderRadius: '10px',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-color)',
            padding: '6px',
            zIndex: 60,
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            {t('header.activeBranch')}
          </div>

          {/* All Branches Option (Default) */}
          <button
            onClick={() => {
              switchBranch('all');
              setOpen(false);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: '6px',
              backgroundColor: isAllSelected ? 'var(--bg-surface-hover)' : 'transparent',
              color: isAllSelected ? 'var(--primary-600)' : 'var(--text-main)',
              fontSize: '13px',
              fontWeight: isAllSelected ? 700 : 500,
              textAlign: 'left',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
              marginBottom: '4px',
            }}
            onMouseEnter={(e) => {
              if (!isAllSelected) e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
            }}
            onMouseLeave={(e) => {
              if (!isAllSelected) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} style={{ color: isAllSelected ? 'var(--primary-600)' : 'var(--text-subtle)' }} />
              <div>
                <div style={{ color: isAllSelected ? 'var(--primary-600)' : 'var(--text-main)' }}>
                  {t('header.allBranches')}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {t('dashboard.allBranchesSelected')}
                </div>
              </div>
            </div>
            {isAllSelected && <Check size={14} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />}
          </button>

          {branches.length > 0 && <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />}

          {/* Individual Branches */}
          {branches.map((b) => {
            const isActive = !isAllSelected && b.id === activeBranch?.id;
            return (
              <button
                key={b.id}
                onClick={() => {
                  switchBranch(b.id);
                  setOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  backgroundColor: isActive ? 'var(--bg-surface-hover)' : 'transparent',
                  color: isActive ? 'var(--primary-600)' : 'var(--text-main)',
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 400,
                  textAlign: 'left',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <Building2 size={16} style={{ color: isActive ? 'var(--primary-600)' : 'var(--text-subtle)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ color: isActive ? 'var(--primary-600)' : 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {b.name}
                    </div>
                    {b.code && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{b.code}</div>}
                  </div>
                </div>
                {isActive && <Check size={14} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
