import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { MailService } from '../../core/mail/mail.service';
import {
  DEFAULT_TIMEZONE,
  getTimePartsInTz,
  getDateKeyInTz,
} from '../../shared/common/utils/timezone.util';
import { ReminderRecurrence, ReminderEndType } from '@prisma/client';

@Injectable()
export class RemindersScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersScheduler.name);
  private checkInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  onModuleInit() {
    this.logger.log('⏰ Starting Reminders 2-Hour Pre-Notification Scheduler...');
    // Run initial scan after 10 seconds, then every 60 seconds
    setTimeout(() => {
      this.processPendingReminders();
    }, 10000);

    this.checkInterval = setInterval(() => {
      this.processPendingReminders();
    }, 60000);
  }

  onModuleDestroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.logger.log('🛑 Reminders Scheduler stopped.');
    }
  }

  /**
   * Main scheduler cycle: scans all active reminders and dispatches 2-hour alerts.
   */
  async processPendingReminders() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const activeReminders = await this.prisma.reminder.findMany({
        where: { isActive: true },
        include: {
          assignees: true,
          tenant: { select: { id: true, name: true, slug: true, settings: true } },
        },
      });

      const now = new Date();

      for (const reminder of activeReminders) {
        try {
          await this.evaluateReminderForAlert(reminder, now);
        } catch (err) {
          this.logger.error(`Error processing reminder ${reminder.id}: ${err.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process reminders: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Evaluates if a reminder has an occurrence due within the 2-hour alert window.
   */
  private async evaluateReminderForAlert(reminder: any, now: Date) {
    const tz = (reminder.tenant?.settings as any)?.timezone || DEFAULT_TIMEZONE;
    const nowTz = getTimePartsInTz(now, tz);

    const [remHourStr, remMinStr] = reminder.reminderTime.split(':');
    const remHour = parseInt(remHourStr, 10);
    const remMin = parseInt(remMinStr, 10);

    // Check candidate days: today and tomorrow in tenant timezone
    const candidateDates = this.getCandidateDateKeys(now, tz);

    for (const dateKey of candidateDates) {
      const isDue = this.isOccurrenceOnDate(reminder, dateKey, tz);
      if (!isDue) continue;

      // Construct scheduled timestamp in tenant timezone
      const [y, m, d] = dateKey.split('-').map((v) => parseInt(v, 10));
      // Local time in target timezone
      const scheduledDateUtc = this.createUtcDateFromTzParts(y, m, d, remHour, remMin, tz);
      const diffMs = scheduledDateUtc.getTime() - now.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      // Check if scheduled time is between 105 and 135 minutes away (around 2 hours prior)
      // or if it's within the next 2 hours and hasn't been notified yet (catch-up safety)
      if (diffMinutes >= 0 && diffMinutes <= 135) {
        const occurrenceKey = `${dateKey}_${reminder.reminderTime}`;

        // Check if already notified
        const existingLog = await this.prisma.reminderNotificationLog.findUnique({
          where: {
            reminderId_occurrenceKey: {
              reminderId: reminder.id,
              occurrenceKey,
            },
          },
        });

        if (existingLog) {
          continue; // Already notified
        }

        await this.dispatchNotifications(reminder, occurrenceKey, scheduledDateUtc, dateKey, tz);
      }
    }
  }

  /**
   * Dispatches email notifications and in-app notifications to all assignees.
   */
  private async dispatchNotifications(
    reminder: any,
    occurrenceKey: string,
    scheduledAt: Date,
    dateKey: string,
    tz: string,
  ) {
    const scheduledFormatted = `${dateKey} at ${reminder.reminderTime} (${tz})`;
    const assigneesList = reminder.assignees.map((a: any) => `${a.name} (${a.profession})`).join(', ');

    let recipientCount = 0;

    for (const assignee of reminder.assignees) {
      // 1. Send Email Notification if email is available
      if (assignee.email) {
        try {
          await this.mailService.sendReminderAlert({
            to: assignee.email,
            assigneeName: assignee.name,
            tenantName: reminder.tenant?.name || 'Unified Dental',
            tenantSlug: reminder.tenant?.slug,
            title: reminder.title,
            priority: reminder.priority,
            category: reminder.category,
            scheduledDateTime: scheduledFormatted,
            recurrenceLabel: this.formatRecurrenceLabel(reminder),
            description: reminder.description,
            assigneesList,
          });
          recipientCount++;
        } catch (mailError) {
          this.logger.warn(`Failed to send reminder email to ${assignee.email}: ${mailError.message}`);
        }
      }

      // 2. Dispatch In-App Notification if assignee has a registered system account
      if (assignee.userId) {
        try {
          await this.prisma.notification.create({
            data: {
              tenantId: reminder.tenantId,
              userId: assignee.userId,
              type: 'REMINDER',
              title: `⏰ Reminder in 2 Hours: ${reminder.title}`,
              body: `Scheduled for ${scheduledFormatted}. ${reminder.description ? reminder.description.substring(0, 100) : ''}`,
              data: {
                reminderId: reminder.id,
                occurrenceKey,
                priority: reminder.priority,
                category: reminder.category,
              },
            },
          });
        } catch (notifErr) {
          this.logger.warn(`Failed to create in-app notification for user ${assignee.userId}: ${notifErr.message}`);
        }
      }
    }

    // Record notification log to prevent duplicate sends
    await this.prisma.reminderNotificationLog.create({
      data: {
        reminderId: reminder.id,
        occurrenceKey,
        scheduledAt,
        recipientCount,
        status: 'SENT',
      },
    });

    this.logger.log(
      `🔔 2-Hour reminder alert dispatched for "${reminder.title}" (${occurrenceKey}) to ${recipientCount} assignees.`,
    );
  }

  /**
   * Determine if an occurrence falls on a specific dateKey (YYYY-MM-DD)
   */
  private isOccurrenceOnDate(reminder: any, dateKey: string, tz: string): boolean {
    const [y, m, d] = dateKey.split('-').map((v) => parseInt(v, 10));
    const targetDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

    const startDateKey = getDateKeyInTz(reminder.startDate, tz);
    if (dateKey < startDateKey) return false;

    // Check end condition
    if (reminder.endType === ReminderEndType.ON_DATE && reminder.endDate) {
      const endDateKey = getDateKeyInTz(reminder.endDate, tz);
      if (dateKey > endDateKey) return false;
    }

    const startParts = getTimePartsInTz(reminder.startDate, tz);
    const startObj = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));
    const targetObj = new Date(Date.UTC(y, m - 1, d));
    const diffDays = Math.round((targetObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return false;

    const config = (reminder.recurrenceConfig as any) || {};
    const repeatEvery = config.repeatEvery || 1;

    switch (reminder.recurrence) {
      case ReminderRecurrence.ONE_TIME:
        return dateKey === startDateKey;

      case ReminderRecurrence.DAILY:
        return diffDays % repeatEvery === 0;

      case ReminderRecurrence.WEEKLY: {
        const diffWeeks = Math.floor(diffDays / 7);
        if (diffWeeks % repeatEvery !== 0) return false;
        const dayOfWeek = targetObj.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const repeatOnDays = config.repeatOnDays || [startObj.getUTCDay()];
        return repeatOnDays.includes(dayOfWeek);
      }

      case ReminderRecurrence.MONTHLY: {
        const monthDiff = (y - startParts.year) * 12 + (m - startParts.month);
        if (monthDiff < 0 || monthDiff % repeatEvery !== 0) return false;

        if (config.monthlyType === 'ON_THE') {
          return this.matchesMonthlyRankDay(targetDate, config.monthlyRank, config.monthlyWeekday);
        } else {
          const targetDay = config.monthlyDay || startParts.day;
          return d === targetDay;
        }
      }

      case ReminderRecurrence.YEARLY: {
        const yearDiff = y - startParts.year;
        if (yearDiff < 0 || yearDiff % repeatEvery !== 0) return false;
        return m === startParts.month && d === startParts.day;
      }

      default:
        return false;
    }
  }

  private matchesMonthlyRankDay(date: Date, rank?: string, weekdayName?: string): boolean {
    const weekdayMap: Record<string, number> = {
      SUNDAY: 0,
      MONDAY: 1,
      TUESDAY: 2,
      WEDNESDAY: 3,
      THURSDAY: 4,
      FRIDAY: 5,
      SATURDAY: 6,
    };

    const targetDayOfWeek = weekdayMap[weekdayName?.toUpperCase() || ''] ?? 1;
    if (date.getUTCDay() !== targetDayOfWeek) return false;

    const dayOfMonth = date.getUTCDate();
    const rankUpper = rank?.toUpperCase() || 'FIRST';

    if (rankUpper === 'FIRST') return dayOfMonth <= 7;
    if (rankUpper === 'SECOND') return dayOfMonth > 7 && dayOfMonth <= 14;
    if (rankUpper === 'THIRD') return dayOfMonth > 14 && dayOfMonth <= 21;
    if (rankUpper === 'FOURTH') return dayOfMonth > 21 && dayOfMonth <= 28;
    if (rankUpper === 'LAST') {
      const nextWeek = new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);
      return nextWeek.getUTCMonth() !== date.getUTCMonth();
    }
    return false;
  }

  private getCandidateDateKeys(now: Date, tz: string): string[] {
    const today = getDateKeyInTz(now, tz);
    const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrow = getDateKeyInTz(tomorrowDate, tz);
    return [today, tomorrow];
  }

  private createUtcDateFromTzParts(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    tz: string,
  ): Date {
    const approx = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    const parts = getTimePartsInTz(approx, tz);
    const diffMs =
      Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) -
      Date.UTC(year, month - 1, day, hour, minute, 0);
    return new Date(approx.getTime() - diffMs);
  }

  private formatRecurrenceLabel(reminder: any): string {
    switch (reminder.recurrence) {
      case ReminderRecurrence.ONE_TIME:
        return 'One time';
      case ReminderRecurrence.DAILY:
        return `Daily (every ${reminder.recurrenceConfig?.repeatEvery || 1} day(s))`;
      case ReminderRecurrence.WEEKLY:
        return `Weekly (every ${reminder.recurrenceConfig?.repeatEvery || 1} week(s))`;
      case ReminderRecurrence.MONTHLY:
        return `Monthly (every ${reminder.recurrenceConfig?.repeatEvery || 1} month(s))`;
      case ReminderRecurrence.YEARLY:
        return `Yearly (every ${reminder.recurrenceConfig?.repeatEvery || 1} year(s))`;
      default:
        return 'Custom';
    }
  }
}
