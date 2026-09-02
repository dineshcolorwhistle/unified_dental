import React from 'react';
import { useTranslation } from 'react-i18next';
import { Stethoscope, Clock } from 'lucide-react';

export const ClinicDoctorsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'var(--badge-primary-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-600)',
            }}
          >
            <Stethoscope size={20} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
            {t('modulePage.clinicDoctorsTitle')}
          </h1>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
          {t('modulePage.clinicDoctorsDesc')}
        </p>
      </div>

      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            backgroundColor: 'var(--badge-warning-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--amber-500)',
            marginBottom: '16px',
          }}
        >
          <Clock size={28} />
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', margin: '0 0 6px' }}>
          {t('modulePage.comingSoonTitle')}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, maxWidth: '420px' }}>
          {t('modulePage.comingSoonDesc')}
        </p>
      </div>
    </div>
  );
};
