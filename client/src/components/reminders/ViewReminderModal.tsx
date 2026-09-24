import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Calendar, Clock, Repeat, Users, Tag, AlertCircle } from 'lucide-react';
import { ReminderItem } from './CreateReminderModal';
import { formatDate } from '../../core/utils/dateUtils';

interface ViewReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminder: ReminderItem | null;
}

export const ViewReminderModal: React.FC<ViewReminderModalProps> = ({
  isOpen,
  onClose,
  reminder,
}) => {
  const { t } = useTranslation();

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

  const badgeStyle = getPriorityBadge(reminder.priority);

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
          maxWidth: '520px',
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
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                {reminder.title}
              </h2>
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
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              {t('reminders.viewReminderSubtitle', 'Overview of scheduled alert, recurrence rule, and assigned recipients.')}
            </p>
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
        <div style={{ padding: '24px', overflowY: 'auto' }}>
          {/* Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
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
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface, #f8fafc)',
                border: '1px solid var(--border-color)',
                marginBottom: '20px',
                fontSize: '13px',
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

          {/* Assignees Section */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Users size={16} style={{ color: 'var(--primary-600)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                {t('reminders.assignedTo', 'Assigned To')} ({reminder.assignees.length})
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {reminder.assignees.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-surface, #f8fafc)',
                    border: '1px solid var(--border-color)',
                    fontSize: '12.5px',
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{a.name}</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
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
                    }}
                  >
                    {a.profession}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          {reminder.description && (
            <div style={{ marginBottom: '16px' }}>
              <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                {t('reminders.description', 'Description')}
              </span>
              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
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
            justifyContent: 'flex-end',
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
