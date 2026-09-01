/**
 * Client-side Date, Time, and Currency Localization Utilities.
 * Adheres to tenant business timezone and Mexican client conventions.
 */

export const DEFAULT_TIMEZONE = 'America/Mexico_City';
export const DEFAULT_CURRENCY = 'MXN';

export interface TimezoneOption {
  value: string;
  label: string;
  offset: string;
  region: string;
}

export const SUPPORTED_TIMEZONES: TimezoneOption[] = [
  {
    value: 'America/Mexico_City',
    label: 'Mexico City, Guadalajara, Monterrey (Central)',
    offset: 'UTC-6',
    region: 'Mexico',
  },
  {
    value: 'America/Cancun',
    label: 'Cancún, Quintana Roo (Southeast)',
    offset: 'UTC-5',
    region: 'Mexico',
  },
  {
    value: 'America/Tijuana',
    label: 'Tijuana, Baja California (Northwest)',
    offset: 'UTC-8 / UTC-7',
    region: 'Mexico',
  },
  {
    value: 'America/Hermosillo',
    label: 'Hermosillo, Sonora (No DST)',
    offset: 'UTC-7',
    region: 'Mexico',
  },
  {
    value: 'America/Mazatlan',
    label: 'Mazatlán, Sinaloa, Baja California Sur',
    offset: 'UTC-7',
    region: 'Mexico',
  },
  {
    value: 'America/Chihuahua',
    label: 'Chihuahua, Cd. Juárez',
    offset: 'UTC-6',
    region: 'Mexico',
  },
  {
    value: 'America/Bogota',
    label: 'Bogotá, Colombia',
    offset: 'UTC-5',
    region: 'Latin America',
  },
  {
    value: 'America/Lima',
    label: 'Lima, Peru',
    offset: 'UTC-5',
    region: 'Latin America',
  },
  {
    value: 'America/New_York',
    label: 'New York, Boston, Miami (US Eastern)',
    offset: 'UTC-5 / UTC-4',
    region: 'North America',
  },
  {
    value: 'America/Chicago',
    label: 'Chicago, Dallas, Houston (US Central)',
    offset: 'UTC-6 / UTC-5',
    region: 'North America',
  },
  {
    value: 'America/Los_Angeles',
    label: 'Los Angeles, San Francisco (US Pacific)',
    offset: 'UTC-8 / UTC-7',
    region: 'North America',
  },
  {
    value: 'UTC',
    label: 'Coordinated Universal Time (UTC)',
    offset: 'UTC+0',
    region: 'Standard',
  },
];

export const SUPPORTED_CURRENCIES = [
  { code: 'MXN', symbol: '$', label: 'MXN - Mexican Peso ($)' },
  { code: 'USD', symbol: '$', label: 'USD - US Dollar ($)' },
  { code: 'EUR', symbol: '€', label: 'EUR - Euro (€)' },
  { code: 'COP', symbol: '$', label: 'COP - Colombian Peso ($)' },
];

export const SUPPORTED_DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (e.g. 02/09/2026 - Mexico / LATAM)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (e.g. 2026-09-02 - ISO Standard)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (e.g. 09/02/2026 - US Standard)' },
];

/**
 * Normalizes calendar dates (dates without deliberate time components, such as
 * delivery dates, appointment days, and birth dates) to UTC noon (12:00:00Z).
 * This prevents off-by-one day regressions when displayed in Western Hemisphere timezones (e.g. Mexico UTC-6).
 */
export function normalizeCalendarDate(date: string | Date | null | undefined): Date | null {
  if (!date) return null;
  if (date instanceof Date) {
    if (isNaN(date.getTime())) return null;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0, 0));
  }

  // Handle YYYY-MM-DD strings
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), 12, 0, 0, 0));
  }

  const parsed = new Date(date);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export interface FormatDateOptions {
  locale?: string;
  timeZone?: string;
  format?: 'short' | 'medium' | 'long';
}

/**
 * Formats a date into a localized string with tenant timezone awareness.
 */
export function formatDate(
  date: string | Date | null | undefined,
  options: FormatDateOptions = {},
): string {
  if (!date) return '—';
  const d = normalizeCalendarDate(date);
  if (!d) return '—';

  const locale = options.locale || 'es-MX';
  const timeZone = options.timeZone || DEFAULT_TIMEZONE;
  const style = options.format || 'short';

  try {
    if (style === 'long') {
      return new Intl.DateTimeFormat(locale, {
        timeZone,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(d);
    }

    if (style === 'medium') {
      return new Intl.DateTimeFormat(locale, {
        timeZone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(d);
    }

    // Default short format: DD/MM/YYYY for es-MX, MM/DD/YYYY for en-US
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

export interface FormatTimeOptions {
  locale?: string;
  timeZone?: string;
  hour12?: boolean;
}

/**
 * Formats a timestamp into a localized time string (HH:mm) in the tenant timezone.
 */
export function formatTime(
  date: string | Date | null | undefined,
  options: FormatTimeOptions = {},
): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  const locale = options.locale || 'es-MX';
  const timeZone = options.timeZone || DEFAULT_TIMEZONE;
  const hour12 = options.hour12 !== undefined ? options.hour12 : true;

  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12,
    }).format(d);
  } catch {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

/**
 * Formats a full timestamp (date + time) in the tenant timezone.
 */
export function formatDateTime(
  date: string | Date | null | undefined,
  options: FormatDateOptions & FormatTimeOptions = {},
): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  const locale = options.locale || 'es-MX';
  const timeZone = options.timeZone || DEFAULT_TIMEZONE;

  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: options.hour12 !== undefined ? options.hour12 : true,
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

/**
 * Formats a numeric currency value according to tenant currency code.
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = DEFAULT_CURRENCY,
  locale: string = 'es-MX',
): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '$ 0.00';
  }

  const num = Number(amount);
  try {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-MX', {
      style: 'currency',
      currency: currency || DEFAULT_CURRENCY,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `$ ${num.toFixed(2)} ${currency}`;
  }
}

/**
 * Returns today's calendar date as a YYYY-MM-DD string in the target business timezone.
 */
export function getTodayDateString(timeZone: string = DEFAULT_TIMEZONE): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Converts a date string or Date object into a YYYY-MM-DD string suitable for HTML <input type="date">.
 * Preserves the calendar day without UTC/local time drift.
 */
export function toInputDateString(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = normalizeCalendarDate(date);
  if (!d) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
