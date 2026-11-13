import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon, ChevronDown, Check } from 'lucide-react';
import { formatDate } from '../../core/utils/dateUtils';

export interface DateRange {
  startDate: string; // YYYY-MM-DD (or empty string for all)
  endDate: string;   // YYYY-MM-DD (or empty string for all)
  preset?: string;
}

export type PresetKey =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last7Days'
  | 'last30Days'
  | 'thisMonth'
  | 'lastMonth'
  | 'last3Months'
  | 'last6Months'
  | 'thisYear'
  | 'lastYear'
  | 'customRange';

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
  style?: React.CSSProperties;
  align?: 'left' | 'right' | 'auto';
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function calculatePresetRange(key: PresetKey): { startDate: string; endDate: string } {
  const today = new Date();
  const todayStr = toYMD(today);

  switch (key) {
    case 'all':
      return { startDate: '', endDate: '' };

    case 'today':
      return { startDate: todayStr, endDate: todayStr };

    case 'yesterday': {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      const yStr = toYMD(y);
      return { startDate: yStr, endDate: yStr };
    }

    case 'last7Days': {
      const d = new Date(today);
      d.setDate(today.getDate() - 6);
      return { startDate: toYMD(d), endDate: todayStr };
    }

    case 'last30Days': {
      const d = new Date(today);
      d.setDate(today.getDate() - 29);
      return { startDate: toYMD(d), endDate: todayStr };
    }

    case 'thisMonth': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      const e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { startDate: toYMD(s), endDate: toYMD(e) };
    }

    case 'lastMonth': {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      return { startDate: toYMD(s), endDate: toYMD(e) };
    }

    case 'last3Months': {
      const s = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      const e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { startDate: toYMD(s), endDate: toYMD(e) };
    }

    case 'last6Months': {
      const s = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      const e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { startDate: toYMD(s), endDate: toYMD(e) };
    }

    case 'thisYear': {
      return {
        startDate: `${today.getFullYear()}-01-01`,
        endDate: `${today.getFullYear()}-12-31`,
      };
    }

    case 'lastYear': {
      const prevYear = today.getFullYear() - 1;
      return {
        startDate: `${prevYear}-01-01`,
        endDate: `${prevYear}-12-31`,
      };
    }

    default:
      return { startDate: '', endDate: '' };
  }
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  className = '',
  style,
  align = 'auto',
}) => {
  const { i18n } = useTranslation();
  const isSpanish = i18n.language?.startsWith('es');
  const locale = isSpanish ? 'es-MX' : 'en-US';

  const [isOpen, setIsOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetKey>(() => {
    if (!value.startDate && !value.endDate) {
      return 'all';
    }
    return (value.preset as PresetKey) || 'customRange';
  });

  const [customStartDate, setCustomStartDate] = useState<string>(() => value.startDate || toYMD(new Date()));
  const [customEndDate, setCustomEndDate] = useState<string>(() => value.endDate || toYMD(new Date()));
  const [computedAlign, setComputedAlign] = useState<'left' | 'right'>('left');

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external changes
  useEffect(() => {
    if (!value.startDate && !value.endDate) {
      setActivePreset('all');
    } else if (value.preset) {
      setActivePreset(value.preset as PresetKey);
    }
    if (value.startDate) setCustomStartDate(value.startDate);
    if (value.endDate) setCustomEndDate(value.endDate);
  }, [value.startDate, value.endDate, value.preset]);

  // Viewport detection to eliminate right/left overflow
  useEffect(() => {
    if (isOpen && containerRef.current) {
      if (align === 'right') {
        setComputedAlign('right');
      } else if (align === 'left') {
        setComputedAlign('left');
      } else {
        const rect = containerRef.current.getBoundingClientRect();
        // If placing left-aligned popover (230px wide) would cross screen boundary, anchor right
        if (rect.left + 240 > window.innerWidth || window.innerWidth - rect.right < 120) {
          setComputedAlign('right');
        } else {
          setComputedAlign('left');
        }
      }
    }
  }, [isOpen, align]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const presets: { key: PresetKey; label: string }[] = useMemo(() => [
    { key: 'all', label: isSpanish ? 'Todas las Fechas (ALL)' : 'All Dates (ALL)' },
    { key: 'today', label: isSpanish ? 'Hoy' : 'Today' },
    { key: 'yesterday', label: isSpanish ? 'Ayer' : 'Yesterday' },
    { key: 'last7Days', label: isSpanish ? 'Últimos 7 Días' : 'Last 7 Days' },
    { key: 'last30Days', label: isSpanish ? 'Últimos 30 Días' : 'Last 30 Days' },
    { key: 'thisMonth', label: isSpanish ? 'Este Mes' : 'This Month' },
    { key: 'lastMonth', label: isSpanish ? 'Mes Pasado' : 'Last Month' },
    { key: 'last3Months', label: isSpanish ? 'Últimos 3 Meses' : 'Last 3 Months' },
    { key: 'last6Months', label: isSpanish ? 'Últimos 6 Meses' : 'Last 6 Months' },
    { key: 'thisYear', label: isSpanish ? 'Este Año' : 'This Year' },
    { key: 'lastYear', label: isSpanish ? 'Año Pasado' : 'Last Year' },
    { key: 'customRange', label: isSpanish ? 'Rango Personalizado' : 'Custom Range' },
  ], [isSpanish]);

  const handleSelectPreset = (key: PresetKey) => {
    if (key === 'customRange') {
      setActivePreset('customRange');
      setCustomStartDate(value.startDate || toYMD(new Date()));
      setCustomEndDate(value.endDate || toYMD(new Date()));
      return;
    }

    const range = calculatePresetRange(key);
    setActivePreset(key);
    onChange({ ...range, preset: key });
    setIsOpen(false);
  };

  const handleApplyCustomRange = () => {
    if (!customStartDate || !customEndDate) return;
    let s = customStartDate;
    let e = customEndDate;
    if (s > e) {
      s = customEndDate;
      e = customStartDate;
    }
    setActivePreset('customRange');
    onChange({ startDate: s, endDate: e, preset: 'customRange' });
    setIsOpen(false);
  };

  // Formatted trigger label
  const formattedDisplay = useMemo(() => {
    if (!value.startDate && !value.endDate) {
      return 'ALL';
    }
    if (value.startDate && value.endDate) {
      if (value.startDate === value.endDate) {
        return formatDate(value.startDate, { locale });
      }
      return `${formatDate(value.startDate, { locale })} ${isSpanish ? 'a' : 'to'} ${formatDate(value.endDate, { locale })}`;
    }
    if (value.startDate) {
      return `${isSpanish ? 'Desde' : 'From'} ${formatDate(value.startDate, { locale })}`;
    }
    return 'ALL';
  }, [value.startDate, value.endDate, isSpanish, locale]);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', ...style }} className={className}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          height: '38px',
          padding: '0 12px',
          borderRadius: '8px',
          border: isOpen ? '1px solid var(--primary-600)' : '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-input)',
          color: 'var(--text-main)',
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
          boxShadow: isOpen ? '0 0 0 3px rgba(37, 99, 235, 0.12)' : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <CalendarIcon size={15} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
          <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', fontWeight: !value.startDate && !value.endDate ? 700 : 500 }}>
            {formattedDisplay}
          </span>
        </span>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: '2px' }} />
      </button>

      {/* Compact Popover Dropdown */}
      {isOpen && (
        <div
          className="date-picker-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            ...(computedAlign === 'right' ? { right: 0, left: 'auto' } : { left: 0, right: 'auto' }),
            zIndex: 1050,
            width: '230px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {/* Caret pointing up */}
          <div
            style={{
              position: 'absolute',
              top: '-5px',
              ...(computedAlign === 'right' ? { right: '18px' } : { left: '18px' }),
              width: '10px',
              height: '10px',
              backgroundColor: 'var(--bg-card)',
              borderLeft: '1px solid var(--border-color)',
              borderTop: '1px solid var(--border-color)',
              transform: 'rotate(45deg)',
            }}
          />

          {/* Preset Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '280px', overflowY: 'auto' }}>
            {presets.map((preset) => {
              const isActive = activePreset === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => handleSelectPreset(preset.key)}
                  style={{
                    width: '100%',
                    padding: '7px 12px',
                    borderRadius: '7px',
                    border: 'none',
                    backgroundColor: isActive ? 'var(--primary-600)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-main)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '12.5px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <span>{preset.label}</span>
                  {isActive && <Check size={14} style={{ color: '#ffffff' }} />}
                </button>
              );
            })}
          </div>

          {/* Custom Range Expansion */}
          {activePreset === 'customRange' && (
            <div
              style={{
                padding: '8px 4px 4px',
                borderTop: '1px solid var(--border-color)',
                marginTop: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                  {isSpanish ? 'Desde:' : 'From:'}
                </label>
                <input
                  type="date"
                  className="input"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  style={{ width: '100%', height: '32px', fontSize: '12px', padding: '4px 8px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                  {isSpanish ? 'Hasta:' : 'To:'}
                </label>
                <input
                  type="date"
                  className="input"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  style={{ width: '100%', height: '32px', fontSize: '12px', padding: '4px 8px' }}
                />
              </div>
              <button
                type="button"
                onClick={handleApplyCustomRange}
                className="btn btn-primary btn-sm"
                style={{
                  width: '100%',
                  height: '30px',
                  fontSize: '12px',
                  fontWeight: 600,
                  justifyContent: 'center',
                  marginTop: '2px',
                }}
              >
                {isSpanish ? 'Aplicar' : 'Apply'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
