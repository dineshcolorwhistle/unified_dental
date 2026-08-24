import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language || 'en';

  const toggleLanguage = () => {
    const nextLang = currentLang.startsWith('es') ? 'en' : 'es';
    i18n.changeLanguage(nextLang);
    localStorage.setItem('i18nextLng', nextLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="btn btn-secondary btn-sm"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: 600,
        padding: '6px 12px',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        color: 'var(--text-main)',
        transition: 'all 0.15s ease',
      }}
      title="Switch Language / Cambiar Idioma"
    >
      <Globe size={15} style={{ color: 'var(--primary-600)' }} />
      <span style={{ fontSize: '12px', letterSpacing: '0.04em' }}>
        {currentLang.startsWith('es') ? 'ES' : 'EN'}
      </span>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '2px' }}>
        ({currentLang.startsWith('es') ? 'Español' : 'English'})
      </span>
    </button>
  );
};
