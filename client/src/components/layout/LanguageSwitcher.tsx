import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown, Check } from 'lucide-react';

interface LanguageSwitcherProps {
  variant?: 'app' | 'dark';
  compact?: boolean;
}

const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'es', label: 'Español', short: 'ES' },
];

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'app',
  compact = false,
}) => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLang = i18n.language?.startsWith('es') ? 'es' : 'en';
  const activeLangObj = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];

  const handleSelectLanguage = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('i18nextLng', code);
    sessionStorage.setItem('public_qr_lang', code);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const isDark = variant === 'dark';

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontWeight: 600,
          padding: compact ? '5px 8px' : '6px 12px',
          borderRadius: '8px',
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'var(--bg-surface)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid var(--border-color)',
          color: isDark ? '#f1f5f9' : 'var(--text-main)',
          fontSize: '12px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          outline: 'none',
          whiteSpace: 'nowrap',
        }}
        title="Select Language / Seleccionar Idioma"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Globe
          size={14}
          style={{
            color: isDark ? '#38bdf8' : 'var(--primary-600)',
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 700, letterSpacing: '0.02em' }}>
          {compact ? activeLangObj.short : activeLangObj.label}
        </span>
        <ChevronDown
          size={12}
          style={{
            color: isDark ? '#94a3b8' : 'var(--text-muted)',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            marginLeft: '1px',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 1100,
            minWidth: '150px',
            backgroundColor: isDark ? '#0f172a' : 'var(--bg-dropdown, var(--bg-card))',
            borderRadius: '10px',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid var(--border-color)',
            boxShadow: isDark
              ? '0 12px 28px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0, 0, 0, 0.4)'
              : '0 10px 25px rgba(0, 0, 0, 0.12)',
            padding: '5px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '6px 10px 4px',
              fontSize: '10.5px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: isDark ? '#64748b' : 'var(--text-muted)',
              borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid var(--border-subtle)',
              marginBottom: '4px',
            }}
          >
            {currentLang === 'es' ? 'Idioma' : 'Language'}
          </div>

          {LANGUAGES.map((lang) => {
            const isSelected = lang.code === currentLang;
            return (
              <button
                key={lang.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelectLanguage(lang.code)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: isSelected
                    ? isDark
                      ? 'rgba(56, 189, 248, 0.12)'
                      : 'var(--bg-surface-hover, rgba(14, 165, 233, 0.08))'
                    : 'transparent',
                  color: isSelected
                    ? isDark
                      ? '#38bdf8'
                      : 'var(--primary-600)'
                    : isDark
                    ? '#cbd5e1'
                    : 'var(--text-main)',
                  fontSize: '12.5px',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = isDark
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'var(--bg-surface)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '18px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 800,
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'var(--bg-surface)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid var(--border-color)',
                      color: isDark ? '#94a3b8' : 'var(--text-muted)',
                    }}
                  >
                    {lang.short}
                  </span>
                  <span>{lang.label}</span>
                </div>

                {isSelected && (
                  <Check
                    size={14}
                    style={{
                      color: isDark ? '#38bdf8' : 'var(--primary-600)',
                      marginLeft: '8px',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
