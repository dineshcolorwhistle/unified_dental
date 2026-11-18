import { ReminderItem } from '../components/reminders/CreateReminderModal';

export interface ScheduledOccurrence {
  index: number;
  date: Date;
  dateFormatted: string;
  time: string;
  status: 'COMPLETED' | 'CURRENT_DUE' | 'UPCOMING' | 'CANCELLED';
}

export interface OccurrenceScheduleResult {
  occurrences: ScheduledOccurrence[];
  completedCount: number;
  totalCount: number;
}

/**
 * Safely parse date parts (year, month, day) from string or Date to avoid timezone shift
 */
export function parseDateParts(d: string | Date): { year: number; month: number; day: number } {
  if (typeof d === 'string') {
    const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: parseInt(match[1], 10),
        month: parseInt(match[2], 10) - 1,
        day: parseInt(match[3], 10),
      };
    }
  }
  const dateObj = new Date(d);
  return {
    year: dateObj.getFullYear(),
    month: dateObj.getMonth(),
    day: dateObj.getDate(),
  };
}

/**
 * Format a date in the format: "Tue, Nov 17, 2026"
 */
export function formatOccurrenceDate(date: Date, locale = 'en-US'): string {
  try {
    return date.toLocaleDateString(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${weekdays[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }
}

/**
 * Generate full schedule breakdown and status for a reminder
 */
export function generateOccurrenceSchedule(
  reminder: ReminderItem,
  locale = 'en-US',
  now: Date = new Date(),
): OccurrenceScheduleResult {
  if (!reminder || !reminder.startDate) {
    return { occurrences: [], completedCount: 0, totalCount: 0 };
  }

  const { year, month, day } = parseDateParts(reminder.startDate);
  const timeStr = reminder.reminderTime || '09:00';
  const [hourStr, minStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10) || 0;
  const minute = parseInt(minStr, 10) || 0;

  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  // 1. One Time reminder
  if (reminder.recurrence === 'ONE_TIME') {
    const occDate = new Date(year, month, day);
    const occDateTime = new Date(year, month, day, hour, minute, 0).getTime();
    const occMidnight = occDate.getTime();

    let status: 'COMPLETED' | 'CURRENT_DUE' | 'UPCOMING' | 'CANCELLED';

    if (reminder.isActive === false || reminder.computedStatus === 'CANCELLED') {
      if (now.getTime() >= occDateTime || (reminder.sentCount ?? 0) > 0) {
        status = 'COMPLETED';
      } else {
        status = 'CANCELLED';
      }
    } else if (now.getTime() >= occDateTime || (reminder.sentCount ?? 0) > 0) {
      status = 'COMPLETED';
    } else if (occMidnight === todayMidnight) {
      status = 'CURRENT_DUE';
    } else {
      status = 'UPCOMING';
    }

    const singleOcc: ScheduledOccurrence = {
      index: 1,
      date: occDate,
      dateFormatted: formatOccurrenceDate(occDate, locale),
      time: timeStr,
      status,
    };

    return {
      occurrences: [singleOcc],
      completedCount: status === 'COMPLETED' ? 1 : 0,
      totalCount: 1,
    };
  }

  // 2. Recurring reminder
  const occurrences: ScheduledOccurrence[] = [];
  const repeatEvery = Math.max(1, Number(reminder.recurrenceConfig?.repeatEvery) || 1);

  // Determine termination condition
  let targetCount: number | null = null;
  let endMidnight: number | null = null;

  if (reminder.endType === 'AFTER_OCCURRENCES' && reminder.endOccurrences && reminder.endOccurrences > 0) {
    targetCount = reminder.endOccurrences;
  } else if (reminder.endType === 'ON_DATE' && reminder.endDate) {
    const endParts = parseDateParts(reminder.endDate);
    endMidnight = new Date(endParts.year, endParts.month, endParts.day).getTime();
  } else {
    // Default or NEVER: generate up to 10 occurrences
    targetCount = 10;
  }

  const startDateObj = new Date(year, month, day);

  if (reminder.recurrence === 'DAILY') {
    const cur = new Date(startDateObj);
    let count = 0;
    while (true) {
      count++;
      if (targetCount !== null && count > targetCount) break;
      if (endMidnight !== null && cur.getTime() > endMidnight) break;
      if (count > 200) break; // Safety cap

      occurrences.push(buildOccurrence(count, new Date(cur), timeStr, hour, minute, reminder, todayMidnight, now, locale));
      cur.setDate(cur.getDate() + repeatEvery);
    }
  } else if (reminder.recurrence === 'WEEKLY') {
    const repeatOnDays: number[] =
      Array.isArray(reminder.recurrenceConfig?.repeatOnDays) && reminder.recurrenceConfig.repeatOnDays.length > 0
        ? [...reminder.recurrenceConfig.repeatOnDays].sort((a, b) => a - b)
        : [startDateObj.getDay()];

    const cur = new Date(startDateObj);
    let count = 0;
    let safetyDays = 0;

    while (true) {
      safetyDays++;
      if (safetyDays > 730) break; // 2 years safety limit

      const dayOfWeek = cur.getDay();
      if (repeatOnDays.includes(dayOfWeek)) {
        if (cur.getTime() >= startDateObj.getTime()) {
          count++;
          if (targetCount !== null && count > targetCount) break;
          if (endMidnight !== null && cur.getTime() > endMidnight) break;

          occurrences.push(buildOccurrence(count, new Date(cur), timeStr, hour, minute, reminder, todayMidnight, now, locale));
        }
      }

      // Check if we need to advance to the next week
      if (dayOfWeek === 6 && repeatEvery > 1) {
        cur.setDate(cur.getDate() + (repeatEvery - 1) * 7 + 1);
      } else {
        cur.setDate(cur.getDate() + 1);
      }

      if (targetCount !== null && count >= targetCount) break;
      if (endMidnight !== null && cur.getTime() > endMidnight) break;
    }
  } else if (reminder.recurrence === 'MONTHLY') {
    const cur = new Date(startDateObj);
    let count = 0;
    while (true) {
      count++;
      if (targetCount !== null && count > targetCount) break;
      if (endMidnight !== null && cur.getTime() > endMidnight) break;
      if (count > 120) break; // 10 years safety

      occurrences.push(buildOccurrence(count, new Date(cur), timeStr, hour, minute, reminder, todayMidnight, now, locale));
      cur.setMonth(cur.getMonth() + repeatEvery);
    }
  } else if (reminder.recurrence === 'YEARLY') {
    const cur = new Date(startDateObj);
    let count = 0;
    while (true) {
      count++;
      if (targetCount !== null && count > targetCount) break;
      if (endMidnight !== null && cur.getTime() > endMidnight) break;
      if (count > 50) break;

      occurrences.push(buildOccurrence(count, new Date(cur), timeStr, hour, minute, reminder, todayMidnight, now, locale));
      cur.setFullYear(cur.getFullYear() + repeatEvery);
    }
  } else {
    // Fallback: single occurrence
    occurrences.push(buildOccurrence(1, startDateObj, timeStr, hour, minute, reminder, todayMidnight, now, locale));
  }

  const completedCount = occurrences.filter((o) => o.status === 'COMPLETED').length;
  const totalCount = targetCount !== null ? Math.max(targetCount, occurrences.length) : occurrences.length;

  return {
    occurrences,
    completedCount,
    totalCount,
  };
}

function buildOccurrence(
  index: number,
  date: Date,
  timeStr: string,
  hour: number,
  minute: number,
  reminder: ReminderItem,
  todayMidnight: number,
  now: Date,
  locale: string,
): ScheduledOccurrence {
  const occMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const occDateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0).getTime();

  let status: 'COMPLETED' | 'CURRENT_DUE' | 'UPCOMING' | 'CANCELLED';

  const isCancelled = reminder.isActive === false || reminder.computedStatus === 'CANCELLED';

  if (occMidnight < todayMidnight) {
    status = 'COMPLETED';
  } else if (occMidnight === todayMidnight) {
    if (now.getTime() >= occDateTime) {
      status = 'COMPLETED';
    } else if (isCancelled) {
      status = 'CANCELLED';
    } else {
      status = 'CURRENT_DUE';
    }
  } else {
    // Future occurrence
    if (isCancelled) {
      status = 'CANCELLED';
    } else {
      status = 'UPCOMING';
    }
  }

  return {
    index,
    date,
    dateFormatted: formatOccurrenceDate(date, locale),
    time: timeStr,
    status,
  };
}
