import { ReminderRecurrence, ReminderEndType } from '@prisma/client';
import {
  getDateKeyInTz,
  getTimePartsInTz,
  DEFAULT_TIMEZONE,
} from '../../../shared/common/utils/timezone.util';

export function createUtcDateFromTzParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string = DEFAULT_TIMEZONE,
): Date {
  const approx = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = getTimePartsInTz(approx, tz);
  const diffMs =
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) -
    Date.UTC(year, month - 1, day, hour, minute, 0);
  return new Date(approx.getTime() - diffMs);
}

export interface ComputedReminderStatusResult {
  computedStatus: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  sentCount: number;
  canCancel: boolean;
  isStarted: boolean;
  scheduledAtUtc?: Date;
  targetOccurrences?: number | null;
}

export function computeReminderStatus(
  reminder: {
    isActive: boolean;
    recurrence: ReminderRecurrence | string;
    startDate: Date | string;
    reminderTime: string;
    endType?: ReminderEndType | string | null;
    endDate?: Date | string | null;
    endOccurrences?: number | null;
    _count?: { notificationLogs: number };
    notificationLogs?: Array<any>;
  },
  tz: string = DEFAULT_TIMEZONE,
  now: Date = new Date(),
): ComputedReminderStatusResult {
  const sentCount =
    reminder.notificationLogs !== undefined
      ? reminder.notificationLogs.length
      : reminder._count?.notificationLogs ?? 0;

  // 1. Manually deactivated / Cancelled
  if (!reminder.isActive) {
    return {
      computedStatus: 'CANCELLED',
      sentCount,
      canCancel: false,
      isStarted: sentCount > 0,
      targetOccurrences: reminder.endOccurrences || null,
    };
  }

  // 2. ONE_TIME Reminder
  if (reminder.recurrence === ReminderRecurrence.ONE_TIME || reminder.recurrence === 'ONE_TIME') {
    const startDateKey = getDateKeyInTz(reminder.startDate, tz);
    const [y, m, d] = startDateKey.split('-').map((v) => parseInt(v, 10));
    const [hourStr, minStr] = (reminder.reminderTime || '09:00').split(':');
    const hour = parseInt(hourStr, 10) || 0;
    const minute = parseInt(minStr, 10) || 0;
    const scheduledAtUtc = createUtcDateFromTzParts(y, m, d, hour, minute, tz);

    const isPast = now.getTime() >= scheduledAtUtc.getTime();
    const isStarted = sentCount > 0 || isPast;

    if (isStarted) {
      return {
        computedStatus: 'COMPLETED',
        sentCount,
        canCancel: false,
        isStarted: true,
        scheduledAtUtc,
        targetOccurrences: 1,
      };
    }

    return {
      computedStatus: 'ACTIVE',
      sentCount,
      canCancel: true,
      isStarted: false,
      scheduledAtUtc,
      targetOccurrences: 1,
    };
  }

  // 3. RECURRING Reminder
  // Check completion: AFTER_OCCURRENCES
  if (
    (reminder.endType === ReminderEndType.AFTER_OCCURRENCES ||
      reminder.endType === 'AFTER_OCCURRENCES') &&
    typeof reminder.endOccurrences === 'number' &&
    reminder.endOccurrences > 0
  ) {
    if (sentCount >= reminder.endOccurrences) {
      return {
        computedStatus: 'COMPLETED',
        sentCount,
        canCancel: false,
        isStarted: true,
        targetOccurrences: reminder.endOccurrences,
      };
    }

    return {
      computedStatus: 'ACTIVE',
      sentCount,
      canCancel: true,
      isStarted: sentCount > 0,
      targetOccurrences: reminder.endOccurrences,
    };
  }

  // Check completion: ON_DATE
  if (
    (reminder.endType === ReminderEndType.ON_DATE || reminder.endType === 'ON_DATE') &&
    reminder.endDate
  ) {
    const todayDateKey = getDateKeyInTz(now, tz);
    const endDateKey = getDateKeyInTz(reminder.endDate, tz);

    if (todayDateKey > endDateKey) {
      return {
        computedStatus: 'COMPLETED',
        sentCount,
        canCancel: false,
        isStarted: true,
        targetOccurrences: null,
      };
    }

    return {
      computedStatus: 'ACTIVE',
      sentCount,
      canCancel: true,
      isStarted: sentCount > 0,
      targetOccurrences: null,
    };
  }

  // Recurring (Never ends or indefinite until cancelled)
  return {
    computedStatus: 'ACTIVE',
    sentCount,
    canCancel: true,
    isStarted: sentCount > 0,
    targetOccurrences: null,
  };
}

