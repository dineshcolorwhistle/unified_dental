import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Plus,
  Search,
  RotateCcw,
  Eye,
  Edit2,
  Trash2,
  Clock,
  Calendar,
  AlertTriangle,
  X,
  XCircle,
  Send,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../core/context/AuthContext';
import { useModule } from '../core/context/ModuleContext';
import { useToast } from '../core/context/ToastContext';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { Tooltip } from '../components/common/Tooltip';
import { Pagination } from '../components/common/Pagination';
import { CalendarView, CalendarEvent } from '../components/common/CalendarView';
import { formatDate } from '../core/utils/dateUtils';
import {
  CreateReminderModal,
  ReminderItem,
} from '../components/reminders/CreateReminderModal';
import { ViewReminderModal } from '../components/reminders/ViewReminderModal';

export const RemindersPage: React.FC = () => {
  const { t } = useTranslation();
  const { isTenantAdmin, isLabAdmin, isClinicAdmin, user } = useAuth();
  const { activeModuleMode, enabledModules } = useModule();
  const toast = useToast();

  const currentModuleKey = useMemo(() => {
    if (activeModuleMode && activeModuleMode !== 'PLATFORM') {
      return activeModuleMode;
    }
    if (!isTenantAdmin && user?.allowedModules && user.allowedModules.length > 0) {
      return user.allowedModules[0];
    }
    const saved = localStorage.getItem('ud_active_module_mode');
    if (saved && (saved === 'LAB' || saved === 'CLINIC')) {
      return saved;
    }
    return enabledModules[0] || 'CLINIC';
  }, [activeModuleMode, isTenantAdmin, user?.allowedModules, enabledModules]);

  const canCreate = currentModuleKey === 'CLINIC'
    ? (isTenantAdmin || isClinicAdmin)
    : isLabAdmin;

  const canEdit = currentModuleKey === 'CLINIC'
    ? (isTenantAdmin || isClinicAdmin)
    : isLabAdmin;

  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [recurrenceFilter, setRecurrenceFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [reminderToEdit, setReminderToEdit] = useState<ReminderItem | null>(null);
  const [reminderToView, setReminderToView] = useState<ReminderItem | null>(null);
  const [reminderToDelete, setReminderToDelete] = useState<ReminderItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reminderToCancel, setReminderToCancel] = useState<ReminderItem | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // View mode: list or calendar
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit,
        moduleKey: currentModuleKey,
      };

      if (search.trim()) {
        params.search = search.trim();
      }
      if (priorityFilter !== 'ALL') {
        params.priority = priorityFilter;
      }
      if (recurrenceFilter !== 'ALL') {
        params.recurrence = recurrenceFilter;
      }
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }

      const res = await api.get('/reminders', { params });
      const items: ReminderItem[] = Array.isArray(res.data)
        ? res.data
        : (res.data as any)?.data || [];
      const meta = (res as any).meta || (res.data as any)?.meta || {};

      setReminders(items);
      setTotal(meta.total !== undefined ? meta.total : items.length);
    } catch (err: any) {
      toast.error(t('reminders.notifications.loadFailed', 'Failed to load reminders.'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, priorityFilter, recurrenceFilter, statusFilter, currentModuleKey]);

  useEffect(() => {
    setPage(1);
    setSearch('');
    setPriorityFilter('ALL');
    setRecurrenceFilter('ALL');
    setStatusFilter('ALL');
  }, [currentModuleKey]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const handleResetFilters = () => {
    setSearch('');
    setPriorityFilter('ALL');
    setRecurrenceFilter('ALL');
    setStatusFilter('ALL');
    setPage(1);
  };

  const handleCancelConfirm = async () => {
    if (!reminderToCancel) return;
    setCancelling(true);
    try {
      await api.patch(`/reminders/${reminderToCancel.id}/cancel`);
      toast.success(t('reminders.cancelSuccess', 'Reminder cancelled successfully.'));
      setReminderToCancel(null);
      if (reminderToView && reminderToView.id === reminderToCancel.id) {
        setReminderToView(null);
      }
      fetchReminders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('reminders.notifications.actionFailed', 'Failed to cancel reminder.'));
    } finally {
      setCancelling(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!reminderToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/reminders/${reminderToDelete.id}`);
      toast.success(t('reminders.notifications.deleteSuccess', 'Reminder deleted successfully.'));
      setReminderToDelete(null);
      fetchReminders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('reminders.notifications.actionFailed', 'Failed to delete reminder.'));
    } finally {
      setDeleting(false);
    }
  };

  const priorityOptions = [
    { value: 'ALL', label: t('reminders.filters.allPriorities', 'All Priorities') },
    { value: 'LOW', label: t('reminders.priorities.low', 'Low') },
    { value: 'MEDIUM', label: t('reminders.priorities.medium', 'Medium') },
    { value: 'HIGH', label: t('reminders.priorities.high', 'High') },
    { value: 'URGENT', label: t('reminders.priorities.urgent', 'Urgent') },
  ];

  const recurrenceOptions = [
    { value: 'ALL', label: t('reminders.filters.allRecurrences', 'All Recurrences') },
    { value: 'ONE_TIME', label: t('reminders.oneTime', 'One time') },
    { value: 'DAILY', label: t('reminders.daily', 'Daily') },
    { value: 'WEEKLY', label: t('reminders.weekly', 'Weekly') },
    { value: 'MONTHLY', label: t('reminders.monthly', 'Monthly') },
    { value: 'YEARLY', label: t('reminders.yearly', 'Yearly') },
  ];

  const statusOptions = [
    { value: 'ALL', label: t('reminders.filters.allStatuses', 'All Statuses') },
    { value: 'ACTIVE', label: t('reminders.status.active', 'Active') },
    { value: 'COMPLETED', label: t('reminders.status.completed', 'Completed') },
    { value: 'CANCELLED', label: t('reminders.status.cancelled', 'Cancelled') },
  ];

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

  const formatDispatchesSummary = (r: ReminderItem) => {
    const sent = r.sentCount ?? 0;
    if (r.recurrence === 'ONE_TIME') {
      if (r.computedStatus === 'COMPLETED' || sent > 0) {
        return `${t('reminders.sent', 'Sent')} (1/1)`;
      }
      return `${t('reminders.pending', 'Pending')} (0/1)`;
    }
    if (r.endType === 'AFTER_OCCURRENCES' && r.endOccurrences) {
      return `${sent} / ${r.endOccurrences} ${t('reminders.sent', 'sent')}`;
    }
    return `${sent} ${t('reminders.sent', 'sent')}`;
  };

  const formatRecurrenceSummary = (r: ReminderItem) => {
    switch (r.recurrence) {
      case 'ONE_TIME':
        return t('reminders.oneTime', 'One time');
      case 'DAILY':
        return `${t('reminders.daily', 'Daily')} (${r.recurrenceConfig?.repeatEvery || 1}d)`;
      case 'WEEKLY': {
        const daysMap: Record<number, string> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
        const days = (r.recurrenceConfig?.repeatOnDays || []).map((d) => daysMap[d]).join(', ');
        return `${t('reminders.weekly', 'Weekly')}${days ? ` (${days})` : ''}`;
      }
      case 'MONTHLY':
        return `${t('reminders.monthly', 'Monthly')} (${r.recurrenceConfig?.repeatEvery || 1}m)`;
      case 'YEARLY':
        return `${t('reminders.yearly', 'Yearly')} (${r.recurrenceConfig?.repeatEvery || 1}y)`;
      default:
        return r.recurrence;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
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
              <Bell size={20} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {t('modulePage.remindersTitle', 'Reminder & Follow-ups')}
            </h1>
          </div>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0 }}>
            {t('modulePage.remindersDesc', 'Track and manage production reminders, doctor follow-ups, and calendar alerts.')}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Calendar View Toggle */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '13px' }}
          >
            <Calendar size={15} />
            <span>{viewMode === 'list' ? t('calendar.calendarView', 'Calendar View') : t('calendar.listView', 'List View')}</span>
          </button>

          {/* Create Reminder Button */}
          {canCreate && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setReminderToEdit(null);
                setIsCreateOpen(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={17} />
              <span>{t('reminders.createBtn', 'Create Reminder')}</span>
            </button>
          )}
        </div>
      </div>

      {viewMode === 'list' ? (
      <>
      {/* Filter Row */}
      <div
        className="card reminders-filter-bar"
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          marginBottom: '20px',
        }}
      >
        {/* Search */}
        <div className="reminders-filter-search" style={{ position: 'relative', flex: 1, minWidth: '240px', maxWidth: '380px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            className="input"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('reminders.filters.searchPlaceholder', 'Search by title, category, description, or assignee...')}
            style={{ paddingLeft: '36px', width: '100%', height: '38px' }}
          />
        </div>

        {/* Priority, Recurrence & Status Dropdowns Row */}
        <div className="reminders-filter-dropdowns" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ width: '150px', minWidth: '130px' }}>
            <SearchableSelect
              options={statusOptions}
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
            />
          </div>

          <div style={{ width: '150px', minWidth: '130px' }}>
            <SearchableSelect
              options={priorityOptions}
              value={priorityFilter}
              onChange={(val) => {
                setPriorityFilter(val);
                setPage(1);
              }}
            />
          </div>

          <div style={{ width: '160px', minWidth: '130px' }}>
            <SearchableSelect
              options={recurrenceOptions}
              value={recurrenceFilter}
              onChange={(val) => {
                setRecurrenceFilter(val);
                setPage(1);
              }}
            />
          </div>
        </div>

        {/* Reset Filter Button */}
        {(search || priorityFilter !== 'ALL' || recurrenceFilter !== 'ALL' || statusFilter !== 'ALL') && (
          <button
            type="button"
            className="btn btn-secondary reminders-filter-reset-btn"
            onClick={handleResetFilters}
            style={{ height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap' }}
          >
            <RotateCcw size={14} />
            <span>{t('reminders.filters.reset', 'Reset Filters')}</span>
          </button>
        )}
      </div>

      {/* Reminders Data Table Card (Rule 13 Standard) */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '12px' }}>
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--table-th-bg)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {t('reminders.table.titleAndCategory', 'Title & Category')}
                </th>
                <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {t('reminders.table.status', 'Status')}
                </th>
                <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {t('reminders.table.priority', 'Priority')}
                </th>
                <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {t('reminders.table.recurrence', 'Recurrence & Dispatches')}
                </th>
                <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {t('reminders.table.scheduledTime', 'Scheduled / Start Date & Time')}
                </th>
                <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {t('reminders.table.assignedTo', 'Assigned To')}
                </th>
                <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right' }}>
                  {t('reminders.table.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t('common.loading', 'Loading reminders...')}
                  </td>
                </tr>
              ) : reminders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '50px 20px', textAlign: 'center' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--badge-primary-bg)',
                        color: 'var(--primary-600)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 12px',
                      }}
                    >
                      <Bell size={24} />
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)', margin: '0 0 6px 0' }}>
                      {t('reminders.table.noReminders', 'No reminders found')}
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px 0', maxWidth: '360px', marginLeft: 'auto', marginRight: 'auto' }}>
                      {t('reminders.table.noRemindersDesc', 'There are no reminders matching your current search or filter criteria.')}
                    </p>
                    {canCreate && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          setReminderToEdit(null);
                          setIsCreateOpen(true);
                        }}
                      >
                        {t('reminders.table.createFirstReminder', 'Create First Reminder')}
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                reminders.map((item) => {
                  const badge = getPriorityBadge(item.priority);
                  const statusBadge = getStatusBadge(item.computedStatus);
                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* Title & Category */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: '13.5px' }}>
                          {item.title}
                        </div>
                        {item.category && (
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {item.category}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            backgroundColor: statusBadge.bg,
                            color: statusBadge.text,
                            border: `1px solid ${statusBadge.border}`,
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            whiteSpace: 'nowrap',
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
                      </td>

                      {/* Priority */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            backgroundColor: badge.bg,
                            color: badge.text,
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                          }}
                        >
                          {t(`reminders.priorities.${item.priority.toLowerCase()}`, item.priority)}
                        </span>
                      </td>

                      {/* Recurrence & Dispatches */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontSize: '13px', color: 'var(--text-main)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'var(--bg-surface, #f8fafc)',
                              border: '1px solid var(--border-color)',
                              fontSize: '12px',
                              fontWeight: 500,
                              width: 'fit-content',
                            }}
                          >
                            <Clock size={12} style={{ color: 'var(--primary-600)' }} />
                            {formatRecurrenceSummary(item)}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            <Send size={11} style={{ flexShrink: 0 }} />
                            <span>{formatDispatchesSummary(item)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Scheduled Time */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontSize: '13px', color: 'var(--text-main)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                          <span>{formatDate(item.startDate)}</span>
                          <span style={{ fontWeight: 600, color: 'var(--primary-600)' }}>
                            {item.reminderTime}
                          </span>
                        </div>
                      </td>

                      {/* Assigned To */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '280px' }}>
                          {item.assignees && item.assignees.length > 0 ? (
                            item.assignees.slice(0, 3).map((a) => (
                              <Tooltip key={a.id} content={`${a.name} (${a.profession})`}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    backgroundColor:
                                      a.profession === 'Doctor'
                                        ? 'var(--badge-primary-bg)'
                                        : a.profession === 'Tenant Admin'
                                        ? 'var(--badge-warning-bg)'
                                        : 'var(--badge-gray-bg, #f1f5f9)',
                                    color:
                                      a.profession === 'Doctor'
                                        ? 'var(--primary-700)'
                                        : a.profession === 'Tenant Admin'
                                        ? 'var(--amber-700)'
                                        : 'var(--text-main)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {a.name}
                                </span>
                              </Tooltip>
                            ))
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                          )}
                          {item.assignees && item.assignees.length > 3 && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                              +{item.assignees.length - 3}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          {/* View Details: Both Tenant Admin & Lab Admin */}
                          <Tooltip content={t('reminders.actions.view', 'View Details')}>
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() => setReminderToView(item)}
                              style={{ width: '32px', height: '32px' }}
                            >
                              <Eye size={15} />
                            </button>
                          </Tooltip>

                          {/* Edit: Lab Admin (in LAB) / Clinic Admin or Tenant Admin (in CLINIC) - Active only */}
                          {canEdit && item.computedStatus === 'ACTIVE' && (
                            <Tooltip content={t('reminders.actions.edit', 'Edit Reminder')}>
                              <button
                                type="button"
                                className="btn-icon"
                                onClick={() => {
                                  setReminderToEdit(item);
                                  setIsCreateOpen(true);
                                }}
                                style={{ width: '32px', height: '32px' }}
                              >
                                <Edit2 size={15} />
                              </button>
                            </Tooltip>
                          )}

                          {/* Cancel: Strictly conditional on lifecycle (hidden when completed or already cancelled) */}
                          {canEdit && item.canCancel && (
                            <Tooltip content={t('reminders.cancelReminder', 'Cancel Reminder')}>
                              <button
                                type="button"
                                className="btn-icon"
                                onClick={() => setReminderToCancel(item)}
                                style={{ width: '32px', height: '32px', color: 'var(--amber-600, #d97706)' }}
                              >
                                <XCircle size={15} />
                              </button>
                            </Tooltip>
                          )}

                          {/* Delete: Tenant Admin ONLY (Hidden for Lab Admin per prompt instructions) */}
                          {isTenantAdmin && (
                            <Tooltip content={t('reminders.actions.delete', 'Delete Reminder')}>
                              <button
                                type="button"
                                className="btn-icon"
                                onClick={() => setReminderToDelete(item)}
                                style={{ width: '32px', height: '32px', color: 'var(--rose-600, #e11d48)' }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(total / limit) || 1}
          pageSize={limit}
          totalItems={total}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setLimit(newSize);
            setPage(1);
          }}
        />
      </div>
      </>
      ) : (
        /* ─── CALENDAR VIEW ───────────────────────────────────── */
        <CalendarView
          title={t('calendar.remindersTitle', 'Reminders Calendar')}
          subtitle={t('calendar.remindersSubtitle', 'Overview of reminders scheduled by date')}
          events={reminders.map((r): CalendarEvent => {
            const priColors: Record<string, string> = {
              URGENT: '#ef4444',
              HIGH: '#f59e0b',
              MEDIUM: '#0d9488',
              LOW: '#94a3b8',
            };
            return {
              id: r.id,
              date: r.startDate,
              title: r.title,
              subtitle: r.category ? `${r.category} • ${r.reminderTime}` : r.reminderTime,
              priorityColor: priColors[r.priority] || '#94a3b8',
              badgeLabel: t(`reminders.priorities.${r.priority.toLowerCase()}`, r.priority),
              badgeBg: r.priority === 'URGENT' ? 'var(--badge-danger-bg)' : r.priority === 'HIGH' ? 'var(--badge-warning-bg)' : 'var(--badge-primary-bg)',
              badgeColor: r.priority === 'URGENT' ? 'var(--rose-700, #b91c1c)' : r.priority === 'HIGH' ? 'var(--amber-700, #b45309)' : 'var(--primary-700)',
              meta: r,
            };
          })}
          onEventClick={(ev) => {
            const reminder = reminders.find((r) => r.id === ev.id);
            if (reminder) setReminderToView(reminder);
          }}
          onListViewClick={() => setViewMode('list')}
          searchValue={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          searchPlaceholder={t('calendar.searchReminders', 'Search reminders...')}
          filterControls={
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ width: '150px' }}>
                <SearchableSelect
                  options={priorityOptions}
                  value={priorityFilter}
                  onChange={(val) => {
                    setPriorityFilter(val);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          }
          icon={<Bell size={20} />}
          loading={loading}
        />
      )}

      {/* Create / Edit Modal */}
      <CreateReminderModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setReminderToEdit(null);
        }}
        onSuccess={fetchReminders}
        reminderToEdit={reminderToEdit}
        moduleKey={currentModuleKey}
      />

      {/* View Details Modal */}
      <ViewReminderModal
        isOpen={Boolean(reminderToView)}
        onClose={() => setReminderToView(null)}
        reminder={reminderToView}
        onCancelReminder={(r) => {
          setReminderToCancel(r);
        }}
        canCancel={canEdit}
      />

      {/* Delete Confirmation Modal (Tenant Admin ONLY) */}
      {reminderToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: 0,
              overflow: 'hidden',
              borderRadius: '16px',
              backgroundColor: 'var(--bg-modal, var(--bg-card))',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ padding: '24px', display: 'flex', gap: '16px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--badge-danger-bg, #fee2e2)',
                  color: 'var(--rose-600, #e11d48)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={22} />
              </div>

              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-heading)', margin: '0 0 6px 0' }}>
                  {t('reminders.actions.deleteConfirmTitle', 'Delete Reminder')}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  {t(
                    'reminders.actions.deleteConfirmDesc',
                    'Are you sure you want to permanently delete this reminder? This action cannot be undone and will cancel all future notifications.',
                  )}
                </p>
                <div
                  style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-surface, #f8fafc)',
                    border: '1px solid var(--border-color)',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                  }}
                >
                  {reminderToDelete.title}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                padding: '16px 24px',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface, #f8fafc)',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReminderToDelete(null)}
                disabled={deleting}
              >
                {t('reminders.actions.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? t('common.deleting', 'Deleting...') : t('reminders.actions.confirmDelete', 'Yes, Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {reminderToCancel && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: 0,
              overflow: 'hidden',
              borderRadius: '16px',
              backgroundColor: 'var(--bg-card)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ padding: '24px', display: 'flex', gap: '16px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--badge-warning-bg, #fef3c7)',
                  color: 'var(--amber-700, #b45309)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <XCircle size={22} />
              </div>

              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-heading)', margin: '0 0 6px 0' }}>
                  {t('reminders.cancelConfirmTitle', 'Cancel Reminder')}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  {t(
                    'reminders.cancelConfirmDesc',
                    'Are you sure you want to cancel this reminder? This will stop upcoming notifications from being dispatched.',
                  )}
                </p>
                <div
                  style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-surface, #f8fafc)',
                    border: '1px solid var(--border-color)',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                  }}
                >
                  {reminderToCancel.title}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                padding: '16px 24px',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface, #f8fafc)',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReminderToCancel(null)}
                disabled={cancelling}
              >
                {t('reminders.actions.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="btn btn-warning"
                onClick={handleCancelConfirm}
                disabled={cancelling}
                style={{
                  backgroundColor: 'var(--amber-600, #d97706)',
                  color: '#ffffff',
                  borderColor: 'var(--amber-600, #d97706)',
                }}
              >
                {cancelling ? t('common.loading', 'Processing...') : t('reminders.confirmCancel', 'Yes, Cancel Reminder')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
