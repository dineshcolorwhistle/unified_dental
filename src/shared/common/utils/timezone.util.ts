/**
 * Zero-dependency timezone and date utilities using native Intl.DateTimeFormat.
 * Standardizes time calculations across Boston VPS, developer local machines,
 * and Mexico-based client dental clinics/laboratories.
 */

export const DEFAULT_TIMEZONE = 'America/Mexico_City';
export const DEFAULT_CURRENCY = 'MXN';

/**
 * Returns the current date/time parts in the specified IANA timezone.
 */
export function getTimePartsInTz(date: Date = new Date(), tz: string = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      partMap[part.type] = part.value;
    }
  }

  return {
    year: parseInt(partMap.year, 10),
    month: parseInt(partMap.month, 10),
    day: parseInt(partMap.day, 10),
    hour: parseInt(partMap.hour === '24' ? '0' : partMap.hour, 10),
    minute: parseInt(partMap.minute, 10),
    second: parseInt(partMap.second, 10),
  };
}

/**
 * Returns YYYY-MM-DD representing the date in the specified timezone.
 */
export function getDateKeyInTz(date: Date | string = new Date(), tz: string = DEFAULT_TIMEZONE): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const { year, month, day } = getTimePartsInTz(d, tz);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Returns HH:mm representation in the specified timezone.
 */
export function getHHmmInTz(date: Date | string = new Date(), tz: string = DEFAULT_TIMEZONE): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const { hour, minute } = getTimePartsInTz(d, tz);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Returns a Date representing 00:00:00.000 (start of day) in the given timezone.
 */
export function startOfDayInTz(date: Date | string = new Date(), tz: string = DEFAULT_TIMEZONE): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dateKey = getDateKeyInTz(d, tz);
  const [yearStr, monthStr, dayStr] = dateKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  // Approximate UTC start:
  // We refine by checking the offset using Intl.DateTimeFormat
  const approx = new Date(Date.UTC(year, month, day, 0, 0, 0));
  const tzParts = getTimePartsInTz(approx, tz);

  const diffMs =
    Date.UTC(tzParts.year, tzParts.month - 1, tzParts.day, tzParts.hour, tzParts.minute, tzParts.second) -
    Date.UTC(year, month, day, 0, 0, 0);

  return new Date(approx.getTime() - diffMs);
}

/**
 * Returns a Date representing 23:59:59.999 (end of day) in the given timezone.
 */
export function endOfDayInTz(date: Date | string = new Date(), tz: string = DEFAULT_TIMEZONE): Date {
  const start = startOfDayInTz(date, tz);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/**
 * Stores calendar dates (e.g. delivery date, birth date, appointment day) at UTC 12:00:00.
 * In any global timezone (UTC-11 to UTC+11), noon UTC is guaranteed to remain on
 * the exact same calendar day, preventing off-by-one day bugs.
 */
export function parseCalendarDate(dateStr: string): Date {
  // If format is YYYY-MM-DD
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), 12, 0, 0, 0));
  }
  return new Date(dateStr);
}

/**
 * Checks whether a given calendar date string (YYYY-MM-DD) is in the past
 * relative to the tenant's current day in their business timezone.
 */
export function isDateBeforeTodayInTz(dateStr: string, tz: string = DEFAULT_TIMEZONE): boolean {
  const todayKey = getDateKeyInTz(new Date(), tz);
  const targetKey = getDateKeyInTz(parseCalendarDate(dateStr), tz);
  return targetKey < todayKey;
}
