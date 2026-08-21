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
          border: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
        }}
      >
        <Building2 size={15} style={{ color: '#0f766e' }} />
        <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeBranch ? activeBranch.name : t('header.selectBranch')}
        </span>
        {activeBranch?.code && (
          <span className="badge badge-primary" style={{ fontSize: '10px', padding: '1px 6px' }}>
            {activeBranch.code}
          </span>
        )}
        <ChevronDown size={14} style={{ color: '#94a3b8' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '110%',
            left: 0,
            width: '240px',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
            border: '1px solid #e2e8f0',
            padding: '6px',
            zIndex: 60,
          }}
        >
          <div style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
            {t('header.activeBranch')}
          </div>
          {branches.map((b) => (
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
                backgroundColor: b.id === activeBranch?.id ? '#f0fdfa' : 'transparent',
                color: b.id === activeBranch?.id ? '#0f766e' : '#1e293b',
                fontSize: '13px',
                fontWeight: b.id === activeBranch?.id ? 600 : 400,
                textAlign: 'left',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <div>
                <div>{b.name}</div>
                {b.code && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{b.code}</div>}
              </div>
              {b.id === activeBranch?.id && <Check size={14} style={{ color: '#0f766e' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
