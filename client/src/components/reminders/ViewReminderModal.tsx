import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Calendar,
  Clock,
  Repeat,
  Users,
  Tag,
  Send,
  XCircle,
  CheckCircle,
  Edit2,
  Eye,
} from 'lucide-react';
import { ReminderItem } from './CreateReminderModal';
import { formatDate } from '../../core/utils/dateUtils';
import { generateOccurrenceSchedule } from '../../utils/reminderOccurrences';

interface ViewReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminder: ReminderItem | null;
  onCancelReminder?: (reminder: ReminderItem) => void;
  canCancel?: boolean;
  canEdit?: boolean;
  onEditReminder?: (reminder: ReminderItem) => void;
}

export const ViewReminderModal: React.FC<ViewReminderModalProps> = ({
  isOpen,
  onClose,
  reminder,
  onCancelReminder,
  canCancel = false,
  canEdit = false,
  onEditReminder,
}) => {
  const { t, i18n } = useTranslation();

  const scheduleResult = useMemo(() => {
    if (!reminder) return { occurrences: [], completedCount: 0, totalCount: 0 };
    return generateOccurrenceSchedule(reminder, i18n.language || 'en-US');
  }, [reminder, i18n.language]);

  const lastNotifiedText = useMemo(() => {
    if (reminder?.notificationLogs && reminder.notificationLogs.length > 0) {
      const latest = reminder.notificationLogs[0];
      return formatDate(latest.notifiedAt);
    }
    return t('reminders.notNotifiedYet', 'Not notified yet');
  }, [reminder?.notificationLogs, t]);

  if (!isOpen || !reminder) return null;

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'URGENT':
        return { bg: 'var(--badge-danger-bg)', text: 'var(--rose-700, #b91c1c)' };
      case 'HIGH':
        return { bg: 'var(--badge-warning-bg)', text: 'var(--amber-700, #b45309)' };
      case 'MEDIUM':
        return { bg: 'var(--badge-primary-bg)', text: 'var(--primary-700, #0f766e)' };
      default:
        return { bg: 'var(--badge-gray-bg, #f1f5f9)', text: 'var(--text-muted)' };
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'ACTIVE':
        return {
          bg: 'var(--badge-success-bg, #dcfce7)',
          text: 'var(--emerald-700, #15803d)',
          border: 'var(--emerald-200, #a7f3d0)',
          label: t('reminders.status.active', 'Active'),
        };
      case 'COMPLETED':
        return {
          bg: 'var(--badge-gray-bg, #f1f5f9)',
          text: 'var(--text-muted, #64748b)',
          border: 'var(--border-color, #e2e8f0)',
          label: t('reminders.status.completed', 'Completed'),
        };
      case 'CANCELLED':
        return {
          bg: 'var(--badge-danger-bg, #fee2e2)',
          text: 'var(--rose-700, #b91c1c)',
          border: 'var(--rose-200, #fecdd3)',
          label: t('reminders.status.cancelled', 'Cancelled'),
        };
      default:
        return {
          bg: 'var(--badge-primary-bg, #f0fdfa)',
          text: 'var(--primary-700, #0f766e)',
          border: 'var(--primary-200, #99f6e4)',
          label: status || t('reminders.status.active', 'Active'),
        };
    }
  };

  const badgeStyle = getPriorityBadge(reminder.priority);
  const statusBadge = getStatusBadge(reminder.computedStatus);

  const formatRecurrenceText = () => {
    switch (reminder.recurrence) {
      case 'ONE_TIME':
        return t('reminders.oneTime', 'One time');
      case 'DAILY':
        return `${t('reminders.daily', 'Daily')} (${t('reminders.repeatEvery', 'Every')} ${reminder.recurrenceConfig?.repeatEvery || 1} ${t('reminders.days', 'day(s)')})`;
      case 'WEEKLY': {
        const daysMap: Record<number, string> = {
          0: 'Sun',
          1: 'Mon',
          2: 'Tue',
          3: 'Wed',
          4: 'Thu',
          5: 'Fri',
          6: 'Sat',
        };
        const selectedDays = (reminder.recurrenceConfig?.repeatOnDays || []).map((d) => daysMap[d]).filter(Boolean).join(', ');
        return `${t('reminders.weekly', 'Weekly')} (${selectedDays || 'Weekly'})`;
      }
      case 'MONTHLY':
        return `${t('reminders.monthly', 'Monthly')} (${t('reminders.repeatEvery', 'Every')} ${reminder.recurrenceConfig?.repeatEvery || 1} ${t('reminders.months', 'month(s)')})`;
      case 'YEARLY':
        return `${t('reminders.yearly', 'Yearly')} (${t('reminders.repeatEvery', 'Every')} ${reminder.recurrenceConfig?.repeatEvery || 1} ${t('reminders.years', 'year(s)')})`;
      default:
        return reminder.recurrence;
    }
  };

  const formatDispatchesText = () => {
    const sent = reminder.sentCount ?? 0;
    if (reminder.recurrence === 'ONE_TIME') {
      if (reminder.computedStatus === 'COMPLETED' || sent > 0) {
        return `${t('reminders.sent', 'Sent')} (1/1)`;
      }
      return `${t('reminders.pending', 'Pending')} (0/1)`;
    }
    if (reminder.endType === 'AFTER_OCCURRENCES' && reminder.endOccurrences) {
      return `${sent} / ${reminder.endOccurrences} ${t('reminders.sent', 'sent')}`;
    }
    return `${sent} ${t('reminders.sent', 'sent')}`;
  };


  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '16px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '580px',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-modal, var(--bg-card))',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexShrink: 0,
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'var(--badge-primary-bg, #eff6ff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-600, #2563eb)',
                flexShrink: 0,
              }}
            >
              <Eye size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                  {reminder.title}
                </h2>

                {/* Status Badge */}
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: statusBadge.bg,
                    color: statusBadge.text,
                    border: `1px solid ${statusBadge.border}`,
                    textTransform: 'uppercase',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: statusBadge.text,
                      display: 'inline-block',
                    }}
                  />
                  {statusBadge.label}
                </span>

                {/* Priority Badge */}
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: badgeStyle.bg,
                    color: badgeStyle.text,
                    textTransform: 'uppercase',
                  }}
                >
                  {t(`reminders.priorities.${reminder.priority.toLowerCase()}`, reminder.priority)}
                </span>
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                {t('reminders.viewReminderSubtitle', 'Overview of scheduled alert, recurrence rule, and assigned recipients.')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-icon"
            style={{ width: '32px', height: '32px', border: 'none', background: 'none' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto' }}>
          {/* Top Quick Status Row (Last Notified) */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-surface, #f8fafc)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '18px',
            }}
          >
            <Clock size={16} style={{ color: 'var(--primary-600, #2563eb)', flexShrink: 0 }} />
            <div>
              <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t('reminders.lastNotified', 'Last Notified')}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                {lastNotifiedText}
              </span>
            </div>
          </div>

          {/* Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <Calendar size={18} style={{ color: 'var(--primary-600)', marginTop: '2px', flexShrink: 0 }} />
              <div>
                <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('reminders.startDate', 'Start Date')}
                </span>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                  {formatDate(reminder.startDate)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <Clock size={18} style={{ color: 'var(--primary-600)', marginTop: '2px', flexShrink: 0 }} />
              <div>
                <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('reminders.reminderTime', 'Reminder Time')}
                </span>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                  {reminder.reminderTime}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <Repeat size={18} style={{ color: 'var(--primary-600)', marginTop: '2px', flexShrink: 0 }} />
              <div>
                <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('reminders.recurrence', 'Recurrence')}
                </span>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                  {formatRecurrenceText()}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <Send size={18} style={{ color: 'var(--primary-600)', marginTop: '2px', flexShrink: 0 }} />
              <div>
                <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('reminders.dispatches', 'Dispatches')}
                </span>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                  {formatDispatchesText()}
                </span>
              </div>
            </div>

            {reminder.category && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <Tag size={18} style={{ color: 'var(--primary-600)', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {t('reminders.category', 'Category')}
                  </span>
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                    {reminder.category}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* End Condition if recurring */}
          {reminder.recurrence !== 'ONE_TIME' && reminder.endType && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface, #f8fafc)',
                border: '1px solid var(--border-color)',
                marginBottom: '18px',
                fontSize: '12.5px',
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                {t('reminders.ends', 'Ends')}:{' '}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                {reminder.endType === 'ON_DATE' && reminder.endDate
                  ? `${t('reminders.onDate', 'On date')} ${formatDate(reminder.endDate)}`
                  : reminder.endType === 'AFTER_OCCURRENCES'
                  ? `${t('reminders.after', 'After')} ${reminder.endOccurrences} ${t('reminders.occurrences', 'occurrences')}`
                  : t('reminders.never', 'Never')}
              </span>
            </div>
          )}

          {/* Description */}
          {reminder.description && (
            <div style={{ marginBottom: '18px' }}>
              <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                {t('reminders.description', 'Description')}
              </span>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-surface, #f8fafc)',
                  border: '1px solid var(--border-color)',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  color: 'var(--text-main)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {reminder.description}
              </div>
            </div>
          )}

          {/* Assigned Team Members Section */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Users size={16} style={{ color: 'var(--primary-600)' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-heading)' }}>
                {t('reminders.assignedTo', 'Assigned Team Members')} ({reminder.assignees.length})
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {reminder.assignees.map((a) => {
                const initial = (a.name || 'U').charAt(0).toUpperCase();
                return (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--bg-surface, #f8fafc)',
                      border: '1px solid var(--border-color)',
                      fontSize: '13px',
                    }}
                  >
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: '#3b82f6',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '15px',
                        flexShrink: 0,
                      }}
                    >
                      {initial}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: '13.5px' }}>
                        {a.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {a.email && <span>{a.email}</span>}
                        {a.email && <span>•</span>}
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor:
                              a.profession === 'Doctor'
                                ? 'var(--badge-primary-bg, #f0fdfa)'
                                : a.profession === 'Tenant Admin'
                                ? 'var(--badge-warning-bg, #fef3c7)'
                                : a.profession === 'Lab Admin'
                                ? 'var(--badge-success-bg, #dcfce7)'
                                : 'var(--badge-gray-bg, #f1f5f9)',
                            color:
                              a.profession === 'Doctor'
                                ? 'var(--primary-700, #0f766e)'
                                : a.profession === 'Tenant Admin'
                                ? 'var(--amber-700, #b45309)'
                                : a.profession === 'Lab Admin'
                                ? 'var(--emerald-700, #15803d)'
                                : 'var(--text-muted, #64748b)',
                            textTransform: 'uppercase',
                          }}
                        >
                          {a.profession}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Occurrence Schedule & Breakdown */}
          <div style={{ marginBottom: '18px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} style={{ color: 'var(--primary-600)' }} />
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)' }}>
                  {t('reminders.scheduleBreakdown', 'Occurrence Schedule & Breakdown')}
                </span>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                {t('reminders.breakdownCompleted', '{{completed}} of {{total}} completed', {
                  completed: scheduleResult.completedCount,
                  total: scheduleResult.totalCount,
                })}
              </span>
            </div>

            <div
              style={{
                maxHeight: '260px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingRight: '4px',
              }}
            >
              {scheduleResult.occurrences.map((occ) => {
                const isCompleted = occ.status === 'COMPLETED';
                const isCurrentDue = occ.status === 'CURRENT_DUE';
                const isCancelled = occ.status === 'CANCELLED';

                let cardBg = 'var(--bg-card, #ffffff)';
                let cardBorder = 'var(--border-color, #e2e8f0)';
                if (isCompleted) {
                  cardBg = 'rgba(220, 252, 231, 0.3)';
                  cardBorder = 'rgba(34, 197, 94, 0.35)';
                } else if (isCurrentDue) {
                  cardBg = 'rgba(219, 234, 254, 0.35)';
                  cardBorder = 'rgba(59, 130, 246, 0.45)';
                } else if (isCancelled) {
                  cardBg = 'rgba(254, 226, 226, 0.3)';
                  cardBorder = 'rgba(239, 68, 68, 0.35)';
                }

                let badgeBg = 'var(--bg-surface, #f1f5f9)';
                let badgeText = 'var(--text-muted, #64748b)';
                if (isCompleted) {
                  badgeBg = 'var(--emerald-600, #10b981)';
                  badgeText = '#ffffff';
                } else if (isCurrentDue) {
                  badgeBg = 'var(--blue-600, #2563eb)';
                  badgeText = '#ffffff';
                } else if (isCancelled) {
                  badgeBg = 'var(--rose-600, #e11d48)';
                  badgeText = '#ffffff';
                }

                return (
                  <div
                    key={occ.index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: cardBg,
                      border: `1px solid ${cardBorder}`,
                      gap: '12px',
                      flexWrap: 'wrap',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '28px',
                          height: '24px',
                          padding: '0 6px',
                          borderRadius: '6px',
                          backgroundColor: badgeBg,
                          color: badgeText,
                          fontSize: '11.5px',
                          fontWeight: 700,
                        }}
                      >
                        #{occ.index}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                        {occ.dateFormatted}
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <Clock size={12} style={{ color: 'var(--amber-600, #d97706)' }} />
                        <span>{occ.time}</span>
                      </span>
                    </div>

                    <div>
                      {isCompleted ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #bbf7d0',
                            fontSize: '11.5px',
                            fontWeight: 600,
                          }}
                        >
                          <CheckCircle size={12} />
                          <span>{t('reminders.status.completedBadge', 'Completed')}</span>
                        </span>
                      ) : isCurrentDue ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            backgroundColor: '#dbeafe',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            fontSize: '11.5px',
                            fontWeight: 600,
                          }}
                        >
                          <Clock size={12} />
                          <span>{t('reminders.status.currentDue', 'Current Due')}</span>
                        </span>
                      ) : isCancelled ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            backgroundColor: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fecdd3',
                            fontSize: '11.5px',
                            fontWeight: 600,
                          }}
                        >
                          <XCircle size={12} />
                          <span>{t('reminders.status.cancelled', 'Cancelled')}</span>
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            backgroundColor: '#f1f5f9',
                            color: '#64748b',
                            border: '1px solid #e2e8f0',
                            fontSize: '11.5px',
                            fontWeight: 600,
                          }}
                        >
                          <Calendar size={12} />
                          <span>{t('reminders.status.upcoming', 'Upcoming')}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2-Hour Notification banner notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--badge-primary-bg, #f0fdfa)',
              border: '1px solid var(--primary-200, #99f6e4)',
              color: 'var(--primary-700, #0f766e)',
              fontSize: '12.5px',
            }}
          >
            <Clock size={16} style={{ flexShrink: 0 }} />
            <span>{t('reminders.timeHelper', 'You will be notified 2 hours before the scheduled time.')}</span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            {canCancel && reminder.canCancel && onCancelReminder && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  onClose();
                  onCancelReminder(reminder);
                }}
                style={{
                  color: 'var(--rose-600, #e11d48)',
                  borderColor: 'var(--rose-200, #fecdd3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <XCircle size={15} />
                <span>{t('reminders.cancelReminder', 'Cancel Reminder')}</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t('common.close', 'Close')}
            </button>
            {canEdit && onEditReminder && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onClose();
                  onEditReminder(reminder);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Edit2 size={15} />
                <span>{t('reminders.actions.edit', 'Edit')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
