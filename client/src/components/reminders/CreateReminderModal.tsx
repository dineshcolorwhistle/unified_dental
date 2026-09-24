import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Clock, Calendar } from 'lucide-react';
import { SearchableSelect } from '../common/SearchableSelect';
import { MultiSearchableSelect, MultiSelectOption } from '../common/MultiSearchableSelect';
import api from '../../services/api';
import { useToast } from '../../core/context/ToastContext';

export interface ReminderItem {
  id: string;
  title: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  category?: string;
  description?: string;
  recurrence: 'ONE_TIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  startDate: string;
  reminderTime: string;
  recurrenceConfig?: {
    repeatEvery?: number;
    repeatOnDays?: number[];
    monthlyType?: 'ON_DAY' | 'ON_THE';
    monthlyDay?: number;
    monthlyRank?: 'FIRST' | 'SECOND' | 'THIRD' | 'FOURTH' | 'LAST';
    monthlyWeekday?: string;
  };
  endType?: 'ON_DATE' | 'AFTER_OCCURRENCES' | 'NEVER';
  endDate?: string;
  endOccurrences?: number;
  branchId?: string;
  assignees: Array<{
    id: string;
    userId?: string;
    doctorId?: string;
    name: string;
    email?: string;
    profession: string;
  }>;
}

interface CreateReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reminderToEdit?: ReminderItem | null;
}

export const CreateReminderModal: React.FC<CreateReminderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  reminderToEdit,
}) => {
  const { t } = useTranslation();
  const toast = useToast();

  const isEditing = Boolean(reminderToEdit);

  // Form states
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [category, setCategory] = useState('');
  const [assignedValues, setAssignedValues] = useState<string[]>([]);
  const [recurrence, setRecurrence] = useState<'ONE_TIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('ONE_TIME');
  const [startDate, setStartDate] = useState('');
  const [reminderTime, setReminderTime] = useState('09:00');
  const [description, setDescription] = useState('');

  // Recurrence box states
  const [repeatEvery, setRepeatEvery] = useState(1);
  const [repeatOnDays, setRepeatOnDays] = useState<number[]>([4]); // default Thu (4)
  const [monthlyType, setMonthlyType] = useState<'ON_DAY' | 'ON_THE'>('ON_DAY');
  const [monthlyDay, setMonthlyDay] = useState(24);
  const [monthlyRank, setMonthlyRank] = useState<'FIRST' | 'SECOND' | 'THIRD' | 'FOURTH' | 'LAST'>('LAST');
  const [monthlyWeekday, setMonthlyWeekday] = useState('MONDAY');

  // End conditions
  const [endType, setEndType] = useState<'ON_DATE' | 'AFTER_OCCURRENCES' | 'NEVER'>('ON_DATE');
  const [endDate, setEndDate] = useState('');
  const [endOccurrences, setEndOccurrences] = useState(10);

  // Candidate assignees
  const [assigneeOptions, setAssigneeOptions] = useState<MultiSelectOption[]>([]);
  const [loadingAssignees, setLoadingAssignees] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Helper to format Date to YYYY-MM-DD
  const toDateString = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // Fetch candidate assignees
  useEffect(() => {
    if (!isOpen) return;

    const fetchAssignees = async () => {
      setLoadingAssignees(true);
      try {
        const res = await api.get('/reminders/assignees');
        const options: MultiSelectOption[] = (res.data || []).map((c: any) => ({
          value: c.id,
          label: c.label,
          sublabel: c.email || undefined,
          profession: c.profession,
        }));
        setAssigneeOptions(options);
      } catch (err: any) {
        toast.error(t('reminders.notifications.loadAssigneesFailed', 'Failed to load assignee candidates.'));
      } finally {
        setLoadingAssignees(false);
      }
    };

    fetchAssignees();
  }, [isOpen]);

  // Initialize or reset form values
  useEffect(() => {
    if (!isOpen) return;

    if (reminderToEdit) {
      setTitle(reminderToEdit.title);
      setPriority(reminderToEdit.priority || 'MEDIUM');
      setCategory(reminderToEdit.category || '');
      setRecurrence(reminderToEdit.recurrence || 'ONE_TIME');
      setReminderTime(reminderToEdit.reminderTime || '09:00');
      setDescription(reminderToEdit.description || '');

      const sDate = reminderToEdit.startDate ? reminderToEdit.startDate.substring(0, 10) : toDateString(new Date());
      setStartDate(sDate);

      // Pre-select assignees
      const selectedIds = (reminderToEdit.assignees || []).map((a) =>
        a.userId ? `u:${a.userId}` : a.doctorId ? `d:${a.doctorId}` : a.id,
      );
      setAssignedValues(selectedIds);

      // Config
      const cfg = reminderToEdit.recurrenceConfig || {};
      setRepeatEvery(cfg.repeatEvery || 1);
      setRepeatOnDays(cfg.repeatOnDays && cfg.repeatOnDays.length > 0 ? cfg.repeatOnDays : [new Date().getDay()]);
      setMonthlyType(cfg.monthlyType || 'ON_DAY');
      setMonthlyDay(cfg.monthlyDay || new Date().getDate());
      setMonthlyRank(cfg.monthlyRank || 'LAST');
      setMonthlyWeekday(cfg.monthlyWeekday || 'MONDAY');

      // End conditions
      setEndType(reminderToEdit.endType || 'ON_DATE');
      setEndDate(reminderToEdit.endDate ? reminderToEdit.endDate.substring(0, 10) : '');
      setEndOccurrences(reminderToEdit.endOccurrences || 10);
    } else {
      const today = new Date();
      setTitle('');
      setPriority('MEDIUM');
      setCategory('');
      setAssignedValues([]);
      setRecurrence('ONE_TIME');
      setStartDate(toDateString(today));
      setReminderTime('09:00');
      setDescription('');

      setRepeatEvery(1);
      setRepeatOnDays([today.getDay()]);
      setMonthlyType('ON_DAY');
      setMonthlyDay(today.getDate());
      setMonthlyRank('LAST');
      setMonthlyWeekday('MONDAY');

      setEndType('ON_DATE');
      setEndDate('');
      setEndOccurrences(10);
    }
  }, [isOpen, reminderToEdit]);

  if (!isOpen) return null;

  const priorityOptions = [
    { value: 'LOW', label: t('reminders.priorities.low', 'Low') },
    { value: 'MEDIUM', label: t('reminders.priorities.medium', 'Medium') },
    { value: 'HIGH', label: t('reminders.priorities.high', 'High') },
    { value: 'URGENT', label: t('reminders.priorities.urgent', 'Urgent') },
  ];

  const recurrenceOptions = [
    { value: 'ONE_TIME', label: t('reminders.oneTime', 'One time') },
    { value: 'DAILY', label: t('reminders.daily', 'Daily') },
    { value: 'WEEKLY', label: t('reminders.weekly', 'Weekly') },
    { value: 'MONTHLY', label: t('reminders.monthly', 'Monthly') },
    { value: 'YEARLY', label: t('reminders.yearly', 'Yearly') },
  ];

  const monthlyRankOptions = [
    { value: 'FIRST', label: t('reminders.first', 'First') },
    { value: 'SECOND', label: t('reminders.second', 'Second') },
    { value: 'THIRD', label: t('reminders.third', 'Third') },
    { value: 'FOURTH', label: t('reminders.fourth', 'Fourth') },
    { value: 'LAST', label: t('reminders.last', 'Last') },
  ];

  const monthlyWeekdayOptions = [
    { value: 'MONDAY', label: t('reminders.monday', 'Monday') },
    { value: 'TUESDAY', label: t('reminders.tuesday', 'Tuesday') },
    { value: 'WEDNESDAY', label: t('reminders.wednesday', 'Wednesday') },
    { value: 'THURSDAY', label: t('reminders.thursday', 'Thursday') },
    { value: 'FRIDAY', label: t('reminders.friday', 'Friday') },
    { value: 'SATURDAY', label: t('reminders.saturday', 'Saturday') },
    { value: 'SUNDAY', label: t('reminders.sunday', 'Sunday') },
  ];

  const daysOfWeek = [
    { day: 0, label: t('reminders.daysOfWeekShort.sun', 'Sun') },
    { day: 1, label: t('reminders.daysOfWeekShort.mon', 'Mon') },
    { day: 2, label: t('reminders.daysOfWeekShort.tue', 'Tue') },
    { day: 3, label: t('reminders.daysOfWeekShort.wed', 'Wed') },
    { day: 4, label: t('reminders.daysOfWeekShort.thu', 'Thu') },
    { day: 5, label: t('reminders.daysOfWeekShort.fri', 'Fri') },
    { day: 6, label: t('reminders.daysOfWeekShort.sat', 'Sat') },
  ];

  const toggleDayOfWeek = (dayNumber: number) => {
    if (repeatOnDays.includes(dayNumber)) {
      if (repeatOnDays.length === 1) return; // keep at least one day
      setRepeatOnDays(repeatOnDays.filter((d) => d !== dayNumber));
    } else {
      setRepeatOnDays([...repeatOnDays, dayNumber].sort((a, b) => a - b));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error(t('reminders.notifications.validationTitle', 'Reminder title is required.'));
      return;
    }

    if (assignedValues.length === 0) {
      toast.error(t('reminders.notifications.validationAssignees', 'Please select at least one assignee.'));
      return;
    }

    if (!startDate) {
      toast.error(t('reminders.notifications.validationDate', 'Please specify a valid start date.'));
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        title: title.trim(),
        priority,
        category: category.trim() || undefined,
        assigneeIds: assignedValues,
        recurrence,
        startDate,
        reminderTime,
        description: description.trim() || undefined,
        moduleKey: 'LAB',
      };

      if (recurrence !== 'ONE_TIME') {
        payload.endType = endType;
        if (endType === 'ON_DATE') {
          payload.endDate = endDate || undefined;
        } else if (endType === 'AFTER_OCCURRENCES') {
          payload.endOccurrences = Number(endOccurrences) || 10;
        }

        payload.recurrenceConfig = {
          repeatEvery: Number(repeatEvery) || 1,
        };

        if (recurrence === 'WEEKLY') {
          payload.recurrenceConfig.repeatOnDays = repeatOnDays;
        } else if (recurrence === 'MONTHLY') {
          payload.recurrenceConfig.monthlyType = monthlyType;
          if (monthlyType === 'ON_DAY') {
            payload.recurrenceConfig.monthlyDay = Number(monthlyDay) || 1;
          } else {
            payload.recurrenceConfig.monthlyRank = monthlyRank;
            payload.recurrenceConfig.monthlyWeekday = monthlyWeekday;
          }
        }
      }

      if (isEditing && reminderToEdit) {
        await api.patch(`/reminders/${reminderToEdit.id}`, payload);
        toast.success(t('reminders.notifications.updateSuccess', 'Reminder updated successfully.'));
      } else {
        await api.post('/reminders', payload);
        toast.success(t('reminders.notifications.createSuccess', 'Reminder created successfully.'));
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || t('reminders.notifications.actionFailed', 'Operation failed.');
      toast.error(msg);
    } finally {
      setSubmitting(false);
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
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
              {isEditing
                ? t('reminders.editReminderTitle', 'Edit Reminder')
                : t('reminders.createReminderTitle', 'Create Reminder')}
            </h2>
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '20px 24px' }}>
          {/* Row 1: Title and Priority */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                {t('reminders.title', 'Title')} <span style={{ color: 'var(--rose-500, #ef4444)' }}>*</span>
              </label>
              <input
                type="text"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('reminders.titlePlaceholder', 'Enter reminder title')}
                required
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                {t('reminders.priority', 'Priority')}
              </label>
              <SearchableSelect
                options={priorityOptions}
                value={priority}
                onChange={(val) => setPriority(val as any)}
              />
            </div>
          </div>

          {/* Row 2: Category */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
              {t('reminders.category', 'Category')}
            </label>
            <input
              type="text"
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t('reminders.categoryPlaceholder', 'e.g. Cleaning, Inventory, Follow-up')}
              style={{ width: '100%' }}
            />
          </div>

          {/* Row 3: Assigned To and Recurrence */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                {t('reminders.assignedTo', 'Assigned To')} <span style={{ color: 'var(--rose-500, #ef4444)' }}>*</span>
              </label>
              <MultiSearchableSelect
                options={assigneeOptions}
                values={assignedValues}
                onChange={setAssignedValues}
                placeholder={t('reminders.selectUsersPlaceholder', 'Select users to assign')}
                disabled={loadingAssignees}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                {t('reminders.recurrence', 'Recurrence')}
              </label>
              <SearchableSelect
                options={recurrenceOptions}
                value={recurrence}
                onChange={(val) => setRecurrence(val as any)}
              />
            </div>
          </div>

          {/* Row 4: Date & Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                {recurrence === 'ONE_TIME'
                  ? t('reminders.reminderDate', 'Reminder Date')
                  : t('reminders.startDate', 'Start Date')}{' '}
                <span style={{ color: 'var(--rose-500, #ef4444)' }}>*</span>
              </label>
              <input
                type="date"
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                style={{ width: '100%' }}
              />
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {t('reminders.dateHelper', 'Choose a date within the next 3 years.')}
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                {t('reminders.reminderTime', 'Reminder Time')}{' '}
                <span style={{ color: 'var(--rose-500, #ef4444)' }}>*</span>
              </label>
              <input
                type="time"
                className="input"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                required
                style={{ width: '100%' }}
              />
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {t('reminders.timeHelper', 'You will be notified 2 hours before the scheduled time.')}
              </span>
            </div>
          </div>

          {/* Recurrence Sub-Box (Screenshots 2 - 5) */}
          {recurrence !== 'ONE_TIME' && (
            <div
              style={{
                borderRadius: '12px',
                border: '1px solid var(--border-subtle, rgba(14, 165, 233, 0.25))',
                backgroundColor: 'var(--bg-surface, rgba(240, 249, 255, 0.45))',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              {/* Repeat Every Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary-700, #0284c7)' }}>
                  {t('reminders.repeatEvery', 'Repeat every')}
                </span>
                <input
                  type="number"
                  className="input"
                  min="1"
                  max="365"
                  value={repeatEvery}
                  onChange={(e) => setRepeatEvery(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  style={{ width: '60px', textAlign: 'center', padding: '4px 8px', height: '32px' }}
                />
                <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                  {recurrence === 'DAILY'
                    ? t('reminders.days', 'day(s)')
                    : recurrence === 'WEEKLY'
                    ? t('reminders.weeks', 'week(s)')
                    : recurrence === 'MONTHLY'
                    ? t('reminders.months', 'month(s)')
                    : t('reminders.years', 'year(s)')}
                </span>
              </div>

              {/* Weekly: Day Selection Buttons (Screenshot 3) */}
              {recurrence === 'WEEKLY' && (
                <div style={{ marginBottom: '14px' }}>
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--primary-700, #0284c7)', marginBottom: '8px' }}>
                    {t('reminders.repeatOn', 'Repeat on')}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {daysOfWeek.map((d) => {
                      const isSelected = repeatOnDays.includes(d.day);
                      return (
                        <button
                          key={d.day}
                          type="button"
                          onClick={() => toggleDayOfWeek(d.day)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: isSelected ? 700 : 500,
                            border: isSelected ? '1px solid var(--primary-600, #0284c7)' : '1px solid var(--border-color)',
                            backgroundColor: isSelected ? 'var(--primary-600, #0284c7)' : 'var(--bg-card)',
                            color: isSelected ? '#ffffff' : 'var(--text-main)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Monthly: Recurrence Pattern (Screenshot 4) */}
              {recurrence === 'MONTHLY' && (
                <div style={{ marginBottom: '14px' }}>
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--primary-700, #0284c7)', marginBottom: '8px' }}>
                    {t('reminders.recurrence', 'Recurrence')}
                  </span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Option 1: On day X of the month */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        backgroundColor: monthlyType === 'ON_DAY' ? 'var(--bg-card)' : 'transparent',
                        border: monthlyType === 'ON_DAY' ? '1px solid var(--border-color)' : 'none',
                      }}
                    >
                      <input
                        type="radio"
                        id="monthly_on_day"
                        name="monthlyType"
                        checked={monthlyType === 'ON_DAY'}
                        onChange={() => setMonthlyType('ON_DAY')}
                      />
                      <label htmlFor="monthly_on_day" style={{ fontSize: '13px', color: 'var(--text-main)', cursor: 'pointer' }}>
                        {t('reminders.onDayOfMonth', 'On day')}
                      </label>
                      <input
                        type="number"
                        className="input"
                        min="1"
                        max="31"
                        value={monthlyDay}
                        onChange={(e) => setMonthlyDay(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                        style={{ width: '56px', textAlign: 'center', padding: '2px 6px', height: '28px' }}
                      />
                      <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                        {t('reminders.ofTheMonth', 'of the month')}
                      </span>
                    </div>

                    {/* Option 2: On the [Rank] [Weekday] */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        backgroundColor: monthlyType === 'ON_THE' ? 'var(--bg-card)' : 'transparent',
                        border: monthlyType === 'ON_THE' ? '1px solid var(--border-color)' : 'none',
                      }}
                    >
                      <input
                        type="radio"
                        id="monthly_on_the"
                        name="monthlyType"
                        checked={monthlyType === 'ON_THE'}
                        onChange={() => setMonthlyType('ON_THE')}
                      />
                      <label htmlFor="monthly_on_the" style={{ fontSize: '13px', color: 'var(--text-main)', cursor: 'pointer' }}>
                        {t('reminders.onThe', 'On the')}
                      </label>
                      <div style={{ width: '90px' }}>
                        <SearchableSelect
                          options={monthlyRankOptions}
                          value={monthlyRank}
                          onChange={(val) => setMonthlyRank(val as any)}
                        />
                      </div>
                      <div style={{ width: '120px' }}>
                        <SearchableSelect
                          options={monthlyWeekdayOptions}
                          value={monthlyWeekday}
                          onChange={(val) => setMonthlyWeekday(val)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Ends Section (Screenshots 2 - 5) */}
              <div style={{ marginTop: '10px' }}>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--primary-700, #0284c7)', marginBottom: '8px' }}>
                  {t('reminders.ends', 'Ends')}
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Ends 1: On date */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      backgroundColor: endType === 'ON_DATE' ? 'var(--bg-card)' : 'transparent',
                      border: endType === 'ON_DATE' ? '1px solid var(--border-color)' : 'none',
                    }}
                  >
                    <input
                      type="radio"
                      id="end_on_date"
                      name="endType"
                      checked={endType === 'ON_DATE'}
                      onChange={() => setEndType('ON_DATE')}
                    />
                    <label htmlFor="end_on_date" style={{ fontSize: '13px', color: 'var(--text-main)', cursor: 'pointer', minWidth: '60px' }}>
                      {t('reminders.onDate', 'On date')}
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={endType !== 'ON_DATE'}
                      style={{ padding: '3px 8px', height: '30px', fontSize: '12px' }}
                    />
                  </div>

                  {/* Ends 2: After X occurrences */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      backgroundColor: endType === 'AFTER_OCCURRENCES' ? 'var(--bg-card)' : 'transparent',
                      border: endType === 'AFTER_OCCURRENCES' ? '1px solid var(--border-color)' : 'none',
                    }}
                  >
                    <input
                      type="radio"
                      id="end_after"
                      name="endType"
                      checked={endType === 'AFTER_OCCURRENCES'}
                      onChange={() => setEndType('AFTER_OCCURRENCES')}
                    />
                    <label htmlFor="end_after" style={{ fontSize: '13px', color: 'var(--text-main)', cursor: 'pointer', minWidth: '60px' }}>
                      {t('reminders.after', 'After')}
                    </label>
                    <input
                      type="number"
                      className="input"
                      min="1"
                      max="365"
                      value={endOccurrences}
                      onChange={(e) => setEndOccurrences(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      disabled={endType !== 'AFTER_OCCURRENCES'}
                      style={{ width: '56px', textAlign: 'center', padding: '3px 8px', height: '30px', fontSize: '12px' }}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {t('reminders.occurrences', 'occurrences')}
                    </span>
                  </div>

                  {/* Ends 3: Never */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      backgroundColor: endType === 'NEVER' ? 'var(--bg-card)' : 'transparent',
                      border: endType === 'NEVER' ? '1px solid var(--border-color)' : 'none',
                    }}
                  >
                    <input
                      type="radio"
                      id="end_never"
                      name="endType"
                      checked={endType === 'NEVER'}
                      onChange={() => setEndType('NEVER')}
                    />
                    <label htmlFor="end_never" style={{ fontSize: '13px', color: 'var(--text-main)', cursor: 'pointer' }}>
                      {t('reminders.never', 'Never')}
                    </label>
                  </div>
                </div>
              </div>

              {/* Dashed Helper note at bottom of recurrence box */}
              <div
                style={{
                  marginTop: '14px',
                  paddingTop: '10px',
                  borderTop: '1px dashed var(--border-subtle, rgba(14, 165, 233, 0.25))',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  lineHeight: 1.45,
                }}
              >
                {t('reminders.recurrenceBoxHelper', 'Choose how often this reminder repeats, which days it uses, and when the series should stop. Limited to 365 upcoming occurrences, and never beyond 3 years from today.')}
              </div>
            </div>
          )}

          {/* Description */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
              {t('reminders.description', 'Description')}
            </label>
            <textarea
              className="input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('reminders.descriptionPlaceholder', 'Optional details about this reminder')}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          {/* Action Row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              {t('reminders.actions.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting
                ? t('common.saving', 'Saving...')
                : isEditing
                ? t('reminders.actions.save', 'Save Changes')
                : t('reminders.actions.create', 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
