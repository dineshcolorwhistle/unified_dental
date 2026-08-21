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
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
      }}
      title="Switch Language / Cambiar Idioma"
    >
      <Globe size={15} style={{ color: '#0f766e' }} />
      <span style={{ fontSize: '12px', letterSpacing: '0.04em' }}>
        {currentLang.startsWith('es') ? 'ES' : 'EN'}
      </span>
      <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '2px' }}>
        ({currentLang.startsWith('es') ? 'Español' : 'English'})
      </span>
    </button>
  );
};
