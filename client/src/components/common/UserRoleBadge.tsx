import React from 'react';
import { ShieldCheck, Wrench, Stethoscope, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type UserRoleType = 'admin' | 'technician' | 'doctor' | 'tenant_admin' | 'super_admin' | string;

export interface UserRoleBadgeProps {
  role?: UserRoleType;
  name?: string;
  subtext?: string;
  showIcon?: boolean;
  showBadge?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
}

export const UserRoleBadge: React.FC<UserRoleBadgeProps> = ({
  role,
  name,
  subtext,
  showIcon = true,
  showBadge = true,
  size = 'sm',
  className = '',
  style,
}) => {
  const { t } = useTranslation();

  const normalizedRole = (role || '').toLowerCase();
  const isAdmin = normalizedRole.includes('admin');
  const isDoctor = normalizedRole.includes('doc');
  const isTechnician = !isAdmin && !isDoctor && (normalizedRole.includes('tech') || Boolean(role));

  let icon = <User size={size === 'sm' ? 11 : 13} />;
  let label = t('roles.user', 'User');
  let bg = 'rgba(100, 116, 139, 0.1)';
  let color = '#475569';
  let border = 'rgba(100, 116, 139, 0.25)';

  if (isAdmin) {
    icon = <ShieldCheck size={size === 'sm' ? 11 : 13} />;
    label = normalizedRole.includes('tenant')
      ? t('roles.tenantAdmin', 'Tenant Admin')
      : t('roles.labAdmin', 'Lab Admin');
    bg = 'rgba(79, 70, 229, 0.1)';
    color = '#4338ca';
    border = 'rgba(79, 70, 229, 0.25)';
  } else if (isDoctor) {
    icon = <Stethoscope size={size === 'sm' ? 11 : 13} />;
    label = t('roles.doctor', 'Doctor');
    bg = 'rgba(13, 148, 136, 0.1)';
    color = '#0f766e';
    border = 'rgba(13, 148, 136, 0.25)';
  } else if (isTechnician) {
    icon = <Wrench size={size === 'sm' ? 11 : 13} />;
    label = t('roles.technician', 'Technician');
    bg = 'rgba(2, 132, 199, 0.1)';
    color = '#0284c7';
    border = 'rgba(2, 132, 199, 0.25)';
  }

  return (
    <div
      className={`user-role-badge-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        ...style,
      }}
    >
      {name && (
        <span style={{ fontWeight: 600, color: 'var(--text-heading, #1e293b)' }}>
          {name}
        </span>
      )}
      {subtext && (
        <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
          ({subtext})
        </span>
      )}
      {showBadge && (
        <span
          className="user-role-badge-pill"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: size === 'sm' ? '10px' : '11px',
            fontWeight: 700,
            padding: size === 'sm' ? '1px 6px' : '2px 8px',
            borderRadius: '4px',
            backgroundColor: bg,
            color: color,
            border: `1px solid ${border}`,
            lineHeight: 1.3,
            letterSpacing: '0.02em',
            flexShrink: 0,
          }}
        >
          {showIcon && icon}
          <span>{label}</span>
        </span>
      )}
    </div>
  );
};

