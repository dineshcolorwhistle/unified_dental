import React from 'react';
import { useTheme } from '../../core/context/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ThemeSwitcherProps {
  variant?: 'icon' | 'pill';
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ variant = 'icon' }) => {
  const { theme, toggleTheme, isDark } = useTheme();
  const { t } = useTranslation();

  const tooltipText = isDark ? t('header.switchToLight') : t('header.switchToDark');

  if (variant === 'pill') {
    return (
      <button
        onClick={toggleTheme}
        className="btn btn-secondary btn-sm"
        title={tooltipText}
        aria-label={tooltipText}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '20px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          color: isDark ? '#38bdf8' : '#f59e0b',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', transition: 'transform 0.2s ease' }}>
          {isDark ? <Moon size={15} /> : <Sun size={15} />}
        </span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
          {isDark ? t('header.themeDark') : t('header.themeLight')}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="btn btn-secondary btn-sm"
      title={tooltipText}
      aria-label={tooltipText}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        padding: 0,
        borderRadius: '8px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        color: isDark ? '#38bdf8' : '#f59e0b',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: isDark ? 'rotate(0deg)' : 'rotate(180deg)',
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {isDark ? <Moon size={17} /> : <Sun size={17} />}
      </span>
    </button>
  );
};
