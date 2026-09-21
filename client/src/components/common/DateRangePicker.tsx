import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '../../core/utils/dateUtils';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export type PresetKey =
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

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
  style?: React.CSSProperties;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  className = '',
  style,
}) => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetKey>('thisMonth');

  // Viewing month for left calendar (first day of that month)
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (value.startDate) {
      const d = parseYMD(value.startDate);
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Range selection in-progress state
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [pickingStart, setPickingStart] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setPickingStart(null);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle preset calculations
  const applyPreset = (key: PresetKey) => {
    const today = new Date();
    let start: Date;
    let end: Date = today;

    switch (key) {
      case 'today':
        start = today;
        end = today;
        break;
      case 'yesterday': {
        const y = new Date(today);
        y.setDate(today.getDate() - 1);
        start = y;
        end = y;
        break;
      }
      case 'last7Days': {
        const d = new Date(today);
        d.setDate(today.getDate() - 6);
        start = d;
        break;
      }
      case 'last30Days': {
        const d = new Date(today);
        d.setDate(today.getDate() - 29);
        start = d;
        break;
      }
      case 'thisMonth': {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      }
      case 'lastMonth': {
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      }
      case 'last3Months': {
        start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      }
      case 'last6Months': {
        start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      }
      case 'thisYear': {
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        break;
      }
      case 'lastYear': {
        start = new Date(today.getFullYear() - 1, 0, 1);
        end = new Date(today.getFullYear() - 1, 11, 31);
        break;
      }
      case 'customRange':
        setActivePreset('customRange');
        return;
      default:
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    const sStr = toDateString(start);
    const eStr = toDateString(end);
    setActivePreset(key);
    setViewDate(new Date(start.getFullYear(), start.getMonth(), 1));
    setPickingStart(null);
    onChange({ startDate: sStr, endDate: eStr });
  };

  const handleDateClick = (dateStr: string) => {
    if (!pickingStart) {
      setPickingStart(dateStr);
      setActivePreset('customRange');
    } else {
      let finalStart = pickingStart;
      let finalEnd = dateStr;
      if (new Date(dateStr) < new Date(pickingStart)) {
        finalStart = dateStr;
        finalEnd = pickingStart;
      }
      setPickingStart(null);
      setActivePreset('customRange');
      onChange({ startDate: finalStart, endDate: finalEnd });
    }
  };

  const navMonth = (delta: number) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const leftMonth = viewDate;
  const rightMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);

  // Preset list
  const presets: { key: PresetKey; label: string }[] = [
    { key: 'today', label: t('expenses.presets.today', 'Today') },
    { key: 'yesterday', label: t('expenses.presets.yesterday', 'Yesterday') },
    { key: 'last7Days', label: t('expenses.presets.last7Days', 'Last 7 Days') },
    { key: 'last30Days', label: t('expenses.presets.last30Days', 'Last 30 Days') },
    { key: 'thisMonth', label: t('expenses.presets.thisMonth', 'This Month') },
    { key: 'lastMonth', label: t('expenses.presets.lastMonth', 'Last Month') },
    { key: 'last3Months', label: t('expenses.presets.last3Months', 'Last 3 Months') },
    { key: 'last6Months', label: t('expenses.presets.last6Months', 'Last 6 Months') },
    { key: 'thisYear', label: t('expenses.presets.thisYear', 'This Year') },
    { key: 'lastYear', label: t('expenses.presets.lastYear', 'Last Year') },
    { key: 'customRange', label: t('expenses.presets.customRange', 'Custom Range') },
  ];

  // Render a calendar month
  const renderMonth = (monthDate: Date) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const monthName = monthDate.toLocaleString(i18n.language === 'es' ? 'es-MX' : 'en-US', {
      month: 'long',
      year: 'numeric',
    });

    const capitalizedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    const dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    const cells = [];

    // Prev month days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      cells.push({
        day: dayNum,
        isCurrentMonth: false,
        dateStr: toDateString(new Date(year, month - 1, dayNum)),
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({
        day: i,
        isCurrentMonth: true,
        dateStr: toDateString(new Date(year, month, i)),
      });
    }

    // Next month days to fill 35 or 42 cells
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        day: i,
        isCurrentMonth: false,
        dateStr: toDateString(new Date(year, month + 1, i)),
      });
    }

    // Effective start and end for highlighting
    const effectiveStart = pickingStart || value.startDate;
    const effectiveEnd = pickingStart ? (hoverDate || pickingStart) : value.endDate;
    const sDate = effectiveStart ? parseYMD(effectiveStart) : null;
    const eDate = effectiveEnd ? parseYMD(effectiveEnd) : null;
    const isReversed = sDate && eDate && sDate > eDate;
    const rangeStart = isReversed ? eDate : sDate;
    const rangeEnd = isReversed ? sDate : eDate;

    return (
      <div style={{ width: '250px' }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--text-heading)',
            textAlign: 'center',
            marginBottom: '12px',
          }}
        >
          {capitalizedMonthName}
        </div>

        {/* Days of week */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '6px' }}>
          {dayHeaders.map((dh) => (
            <div
              key={dh}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '4px 0',
              }}
            >
              {dh}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
          {cells.map((cell, idx) => {
            const cellDate = parseYMD(cell.dateStr);
            const isStart = rangeStart && toDateString(cellDate) === toDateString(rangeStart);
            const isEnd = rangeEnd && toDateString(cellDate) === toDateString(rangeEnd);
            const inRange = rangeStart && rangeEnd && cellDate >= rangeStart && cellDate <= rangeEnd;

            let bgColor = 'transparent';
            let textColor = cell.isCurrentMonth ? 'var(--text-main)' : 'var(--text-muted)';
            let borderRadius = '6px';

            if (isStart || isEnd) {
              bgColor = 'var(--primary-600)';
              textColor = '#ffffff';
              borderRadius = '6px';
            } else if (inRange) {
              bgColor = 'var(--badge-primary-bg)';
              textColor = 'var(--primary-700)';
              borderRadius = '0px';
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleDateClick(cell.dateStr)}
                onMouseEnter={() => pickingStart && setHoverDate(cell.dateStr)}
                style={{
                  height: '30px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: isStart || isEnd ? 700 : 500,
                  backgroundColor: bgColor,
                  color: textColor,
                  borderRadius,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                  opacity: cell.isCurrentMonth ? 1 : 0.45,
                }}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Formatted trigger label
  const formattedDisplay = `${formatDate(value.startDate, { locale: i18n.language === 'es' ? 'es-MX' : 'en-US' })} ${t(
    'expenses.dateTo',
    'to',
  )} ${formatDate(value.endDate, { locale: i18n.language === 'es' ? 'es-MX' : 'en-US' })}`;

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', ...style }} className={className}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          height: '38px',
          padding: '0 12px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-input)',
          color: 'var(--text-main)',
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <CalendarIcon size={16} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
        <span>{formattedDisplay}</span>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: '2px' }} />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 1000,
            display: 'flex',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
            overflow: 'hidden',
          }}
        >
          {/* Left Presets Sidebar */}
          <div
            style={{
              width: '160px',
              padding: '12px 8px',
              borderRight: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            {presets.map((preset) => {
              const isActive = activePreset === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyPreset(preset.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: isActive ? 700 : 500,
                    textAlign: 'left',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: isActive ? 'var(--primary-600)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-main)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Right Dual Calendar */}
          <div style={{ padding: '16px 20px', position: 'relative' }}>
            {/* Prev / Next Navigation buttons */}
            <div
              style={{
                position: 'absolute',
                top: '16px',
                left: '20px',
                right: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                pointerEvents: 'none',
              }}
            >
              <button
                type="button"
                onClick={() => navMonth(-1)}
                style={{
                  pointerEvents: 'auto',
                  background: 'none',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                  backgroundColor: 'var(--bg-card)',
                }}
              >
                <ChevronLeft size={16} />
              </button>

              <button
                type="button"
                onClick={() => navMonth(1)}
                style={{
                  pointerEvents: 'auto',
                  background: 'none',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                  backgroundColor: 'var(--bg-card)',
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Calendars side-by-side */}
            <div style={{ display: 'flex', gap: '32px' }}>
              {renderMonth(leftMonth)}
              {renderMonth(rightMonth)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
