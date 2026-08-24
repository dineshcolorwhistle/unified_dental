import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../core/context/AuthContext';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const BranchSwitcher: React.FC = () => {
  const { user, switchBranch } = useAuth();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const branches = user?.availableBranches || [];
  const activeBranch = branches.find((b) => b.id === user?.activeBranchId) || branches[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user || branches.length === 0) return null;

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
      >
        <Building2 size={15} style={{ color: 'var(--primary-600)' }} />
        <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeBranch ? activeBranch.name : t('header.selectBranch')}
        </span>
        {activeBranch?.code && (
          <span className="badge badge-primary" style={{ fontSize: '10px', padding: '1px 6px' }}>
            {activeBranch.code}
          </span>
        )}
        <ChevronDown size={14} style={{ color: 'var(--text-subtle)' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '110%',
            left: 0,
            width: '240px',
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
          {branches.map((b) => {
            const isActive = b.id === activeBranch?.id;
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
                  fontWeight: isActive ? 600 : 400,
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
                <div>
                  <div style={{ color: isActive ? 'var(--primary-600)' : 'var(--text-main)' }}>{b.name}</div>
                  {b.code && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{b.code}</div>}
                </div>
                {isActive && <Check size={14} style={{ color: 'var(--primary-600)' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
