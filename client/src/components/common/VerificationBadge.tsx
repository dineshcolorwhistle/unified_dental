import React from 'react';
import { ShieldCheck, Stethoscope } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type ProcessTypeVariant = 'PRODUCTION' | 'INTERNAL_VERIFICATION' | 'EXTERNAL_VERIFICATION' | string;

export interface VerificationBadgeProps {
  type?: ProcessTypeVariant;
  isVerification?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  type,
  isVerification,
  size = 'sm',
  className = '',
  style,
}) => {
  const { t } = useTranslation();

  const isExt =
    type === 'EXTERNAL_VERIFICATION' ||
    (typeof type === 'string' && type.toLowerCase().includes('external'));
  const isInt =
    type === 'INTERNAL_VERIFICATION' ||
    Boolean(isVerification) ||
    (typeof type === 'string' && type.toLowerCase().includes('internal'));

  // Production processes remain baseline/neutral without loud badges
  if (!isExt && !isInt) {
    return null;
  }

  if (isExt) {
    return (
      <span
        className={`verification-badge ext-verification-badge ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: size === 'sm' ? '10px' : '11px',
          fontWeight: 700,
          padding: size === 'sm' ? '1px 7px' : '3px 9px',
          borderRadius: '5px',
          backgroundColor: 'rgba(13, 148, 136, 0.12)',
          color: '#0d9488',
          border: '1px solid rgba(13, 148, 136, 0.28)',
          letterSpacing: '0.02em',
          flexShrink: 0,
          ...style,
        }}
      >
        <Stethoscope size={size === 'sm' ? 11 : 13} />
        <span>{t('labProcesses.types.EXTERNAL_VERIFICATION', 'External Verification')}</span>
      </span>
    );
  }

  return (
    <span
      className={`verification-badge int-verification-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: size === 'sm' ? '10px' : '11px',
        fontWeight: 700,
        padding: size === 'sm' ? '1px 7px' : '3px 9px',
        borderRadius: '5px',
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        color: '#d97706',
        border: '1px solid rgba(245, 158, 11, 0.28)',
        letterSpacing: '0.02em',
        flexShrink: 0,
        ...style,
      }}
    >
      <ShieldCheck size={size === 'sm' ? 11 : 13} />
      <span>{t('labProcesses.types.INTERNAL_VERIFICATION', 'Internal Verification')}</span>
    </span>
  );
};

