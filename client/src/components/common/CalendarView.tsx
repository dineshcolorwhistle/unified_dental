import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  List,
  Search,
  Filter,
} from 'lucide-react';

// ─── TYPES ───────────────────────────────────────────────────
export interface CalendarEvent {
  id: string;
  date: string; // ISO date string (the date to plot on)
  title: string;
  subtitle?: string;
  badgeLabel?: string;
  badgeBg?: string;
  badgeColor?: string;
  priorityColor?: string; // small dot color
  meta?: any; // original data for onClick
}

export type CalendarViewMode = 'month' | 'week' | 'day';

interface CalendarViewProps {
  /** Page title for the calendar */
  title: string;
  /** Page subtitle */
  subtitle: string;
  /** The events to display */
  events: CalendarEvent[];
  /** Called when user clicks an event */
  onEventClick: (event: CalendarEvent) => void;
  /** Called when user clicks "List View" to go back */
  onListViewClick: () => void;
  /** Search value */
  searchValue?: string;
  /** Called when search changes */
  onSearchChange?: (value: string) => void;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Optional filter controls to render on the right of the filter bar */
  filterControls?: React.ReactNode;
  /** Icon component for page header */
  icon?: React.ReactNode;
  /** Loading state */
  loading?: boolean;
}

// ─── HELPERS ─────────────────────────────────────────────────

/**
 * Normalize a date to YYYY-MM-DD string in local time
 * Handles UTC noon dates correctly for Western Hemisphere timezones
 */
function toDateKey(dateStr: string): string {
  if (!dateStr) return '';
  // If it's just a date (no T), return as-is
  if (dateStr.length === 10 && !dateStr.includes('T')) return dateStr;
  // Parse and extract date parts to avoid timezone shifting
  const d = new Date(dateStr);
  // Use UTC date for dates stored at noon UTC (calendar dates)
  const hours = d.getUTCHours();
  if (hours >= 10 && hours <= 14) {
    // Likely a calendar date stored at UTC noon
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  // Otherwise use local date
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0 = Sunday
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function formatMonthYear(date: Date, locale: string): string {
  return date.toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function getWeekDates(date: Date): Date[] {
  const day = date.getDay();
  const start = new Date(date);
  start.setDate(start.getDate() - day);
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

const MAX_VISIBLE_EVENTS = 3;

// ─── COMPONENT ───────────────────────────────────────────────

export const CalendarView: React.FC<CalendarViewProps> = ({
  title,
  subtitle,
  events,
  onEventClick,
  onListViewClick,
  searchValue = '',
  onSearchChange,
  searchPlaceholder,
  filterControls,
  icon,
  loading = false,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'en';

  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);

  // ─── EVENT MAP ───────────────────────────────────────────
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      const key = toDateKey(ev.date);
      if (!key) continue;
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [events]);

  // ─── NAVIGATION ──────────────────────────────────────────
  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
    setExpandedDay(null);
  }, []);

  const goPrev = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === 'month') {
        d.setMonth(d.getMonth() - 1);
      } else if (viewMode === 'week') {
        d.setDate(d.getDate() - 7);
      } else {
        d.setDate(d.getDate() - 1);
      }
      return d;
    });
    setExpandedDay(null);
  }, [viewMode]);

  const goNext = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === 'month') {
        d.setMonth(d.getMonth() + 1);
      } else if (viewMode === 'week') {
        d.setDate(d.getDate() + 7);
      } else {
        d.setDate(d.getDate() + 1);
      }
      return d;
    });
    setExpandedDay(null);
  }, [viewMode]);

  // ─── DAY NAMES ───────────────────────────────────────────
  const dayNames = useMemo(() => {
    if (locale === 'es') {
      return ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    }
    return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  }, [locale]);

  // ─── MONTH GRID ──────────────────────────────────────────
  const monthGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfWeek(year, month);

    const cells: Array<{ date: Date; isCurrentMonth: boolean; dateKey: string }> = [];

    // Previous month overflow
    const prevMonthDays = getDaysInMonth(year, month - 1);
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      cells.push({
        date: d,
        isCurrentMonth: false,
        dateKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      cells.push({
        date: d,
        isCurrentMonth: true,
        dateKey: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      });
    }

    // Next month overflow to fill 6 rows (42 cells)
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      cells.push({
        date: d,
        isCurrentMonth: false,
        dateKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      });
    }

    return cells;
  }, [currentDate]);

  // ─── WEEK DATES ──────────────────────────────────────────
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);

  // ─── RENDER EVENT PILL ───────────────────────────────────
  const renderEventPill = (ev: CalendarEvent) => (
    <div
      key={ev.id}
      onClick={(e) => {
        e.stopPropagation();
        onEventClick(ev);
      }}
      style={{
        padding: '3px 6px',
        borderRadius: '5px',
        fontSize: '11px',
        fontWeight: 600,
        cursor: 'pointer',
        backgroundColor: ev.badgeBg || 'var(--badge-primary-bg)',
        color: ev.badgeColor || 'var(--primary-700)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        transition: 'opacity 0.15s ease',
        lineHeight: 1.3,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.opacity = '0.8';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.opacity = '1';
      }}
    >
      {ev.priorityColor && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: ev.priorityColor,
            flexShrink: 0,
          }}
        />
      )}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {ev.title}
      </span>
    </div>
  );

  // ─── RENDER MONTH VIEW ───────────────────────────────────
  const renderMonthView = () => (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
      {/* Day name header row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          backgroundColor: 'var(--table-th-bg, var(--bg-surface))',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        {dayNames.map((name) => (
          <div
            key={name}
            style={{
              padding: '10px 8px',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              textAlign: 'center',
              letterSpacing: '0.04em',
            }}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
        }}
      >
        {monthGrid.map((cell, idx) => {
          const isToday = isSameDay(cell.date, today);
          const dayEvents = eventsByDate[cell.dateKey] || [];
          const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
          const overflowCount = dayEvents.length - MAX_VISIBLE_EVENTS;
          const isExpanded = expandedDay === cell.dateKey;

          return (
            <div
              key={idx}
              onClick={() => {
                if (dayEvents.length > MAX_VISIBLE_EVENTS) {
                  setExpandedDay(isExpanded ? null : cell.dateKey);
                }
              }}
              style={{
                minHeight: '115px',
                padding: '6px 8px',
                borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--border-color)' : undefined,
                borderBottom: idx < 35 ? '1px solid var(--border-color)' : undefined,
                backgroundColor: isToday
                  ? 'rgba(37, 99, 235, 0.04)'
                  : !cell.isCurrentMonth
                  ? 'var(--bg-surface-muted, var(--bg-app))'
                  : 'var(--bg-card)',
                cursor: dayEvents.length > MAX_VISIBLE_EVENTS ? 'pointer' : 'default',
                transition: 'background-color 0.15s ease',
              }}
            >
              {/* Day number */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  marginBottom: '4px',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: isToday ? '28px' : 'auto',
                    height: isToday ? '28px' : 'auto',
                    borderRadius: isToday ? '50%' : undefined,
                    backgroundColor: isToday ? '#2563eb' : undefined,
                    color: isToday
                      ? '#ffffff'
                      : cell.isCurrentMonth
                      ? 'var(--text-heading)'
                      : 'var(--text-muted)',
                    fontSize: '13px',
                    fontWeight: isToday ? 800 : cell.isCurrentMonth ? 600 : 400,
                  }}
                >
                  {cell.date.getDate()}
                </span>
              </div>

              {/* Events */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {(isExpanded ? dayEvents : visibleEvents).map(renderEventPill)}

                {!isExpanded && overflowCount > 0 && (
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: 'var(--primary-600)',
                      padding: '2px 4px',
                      cursor: 'pointer',
                    }}
                  >
                    {t('calendar.moreEvents', { count: overflowCount, defaultValue: `+${overflowCount} more` })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─── RENDER WEEK VIEW ────────────────────────────────────
  const renderWeekView = () => (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          backgroundColor: 'var(--table-th-bg, var(--bg-surface))',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        {weekDates.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={i}
              style={{
                padding: '10px 8px',
                textAlign: 'center',
                borderRight: i < 6 ? '1px solid var(--border-color)' : undefined,
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.04em',
                  marginBottom: '4px',
                }}
              >
                {dayNames[d.getDay()]}
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: isToday ? '30px' : 'auto',
                  height: isToday ? '30px' : 'auto',
                  borderRadius: isToday ? '50%' : undefined,
                  backgroundColor: isToday ? '#2563eb' : undefined,
                  color: isToday ? '#fff' : 'var(--text-heading)',
                  fontSize: '14px',
                  fontWeight: isToday ? 800 : 600,
                }}
              >
                {d.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {weekDates.map((d, i) => {
          const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const dayEvents = eventsByDate[dateKey] || [];
          return (
            <div
              key={i}
              style={{
                minHeight: '300px',
                padding: '8px',
                borderRight: i < 6 ? '1px solid var(--border-color)' : undefined,
                backgroundColor: isSameDay(d, today) ? 'rgba(37, 99, 235, 0.04)' : 'var(--bg-card)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {dayEvents.map(renderEventPill)}
                {dayEvents.length === 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--text-subtle, var(--text-muted))', textAlign: 'center', paddingTop: '20px' }}>
                    —
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─── RENDER DAY VIEW ─────────────────────────────────────
  const renderDayView = () => {
    const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
    const dayEvents = eventsByDate[dateKey] || [];
    const isToday = isSameDay(currentDate, today);

    return (
      <div
        className="card"
        style={{ padding: 0, overflow: 'hidden' }}
      >
        {/* Day header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: isToday ? 'rgba(37, 99, 235, 0.04)' : 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {isToday && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#2563eb',
                color: '#fff',
                fontSize: '16px',
                fontWeight: 800,
              }}
            >
              {currentDate.getDate()}
            </span>
          )}
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)' }}>
              {currentDate.toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {dayEvents.length} {dayEvents.length === 1
                ? t('calendar.event', 'event')
                : t('calendar.events', 'events')}
            </div>
          </div>
        </div>

        {/* Events list */}
        <div style={{ padding: '16px 20px' }}>
          {dayEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>
              {t('calendar.noEventsForDay', 'No events scheduled for this day.')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {dayEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => onEventClick(ev)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-400)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                >
                  {ev.priorityColor && (
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: ev.priorityColor,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {ev.title}
                    </div>
                    {ev.subtitle && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {ev.subtitle}
                      </div>
                    )}
                  </div>
                  {ev.badgeLabel && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: ev.badgeBg || 'var(--badge-primary-bg)',
                        color: ev.badgeColor || 'var(--primary-700)',
                        whiteSpace: 'nowrap',
                        textTransform: 'uppercase',
                      }}
                    >
                      {ev.badgeLabel}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── VIEW MODE LABELS ────────────────────────────────────
  const viewModes: { key: CalendarViewMode; label: string }[] = [
    { key: 'month', label: t('calendar.month', 'Month') },
    { key: 'week', label: t('calendar.week', 'Week') },
    { key: 'day', label: t('calendar.day', 'Day') },
  ];

  // ─── RENDER ──────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ─── PAGE HEADER ───────────────────────────────────── */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Left: Icon + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
            {icon || <CalendarIcon size={20} />}
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {title}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {subtitle}
            </p>
          </div>
        </div>

        {/* Right: Navigation controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* List View button */}
          <button
            type="button"
            onClick={onListViewClick}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <List size={15} />
            <span>{t('calendar.listView', 'List View')}</span>
          </button>

          {/* Today button */}
          <button
            type="button"
            onClick={goToToday}
            className="btn btn-secondary"
            style={{ fontSize: '13px', fontWeight: 600, padding: '7px 14px' }}
          >
            {t('calendar.today', 'Today')}
          </button>

          {/* Navigation arrows */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <button
              type="button"
              onClick={goPrev}
              className="btn-icon"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="btn-icon"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Month/Year label */}
          <span
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--text-heading)',
              minWidth: '160px',
              textAlign: 'center',
              textTransform: 'capitalize',
            }}
          >
            {formatMonthYear(currentDate, locale)}
          </span>

          {/* View mode toggles */}
          <div
            style={{
              display: 'flex',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
            }}
          >
            {viewModes.map((vm) => (
              <button
                key={vm.key}
                type="button"
                onClick={() => {
                  setViewMode(vm.key);
                  setExpandedDay(null);
                }}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor:
                    viewMode === vm.key ? 'var(--primary-600)' : 'var(--bg-card)',
                  color: viewMode === vm.key ? '#ffffff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                {vm.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── FILTER BAR ────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        {onSearchChange && (
          <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              className="form-input"
              placeholder={searchPlaceholder || t('calendar.searchPlaceholder', 'Search...')}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{
                paddingLeft: '36px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
              }}
            />
          </div>
        )}

        {/* Filter icon label */}
        {filterControls && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={15} style={{ color: 'var(--text-muted)' }} />
            {filterControls}
          </div>
        )}
      </div>

      {/* ─── CALENDAR BODY ─────────────────────────────────── */}
      {loading ? (
        <div
          className="card"
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '14px',
          }}
        >
          {t('common.loading', 'Loading...')}
        </div>
      ) : (
        <>
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'day' && renderDayView()}
        </>
      )}
    </div>
  );
};
