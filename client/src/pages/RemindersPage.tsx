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
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../core/context/AuthContext';
import { useModule } from '../core/context/ModuleContext';
import { useToast } from '../core/context/ToastContext';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { Tooltip } from '../components/common/Tooltip';
import { Pagination } from '../components/common/Pagination';
import { formatDate } from '../core/utils/dateUtils';
import {
  CreateReminderModal,
  ReminderItem,
} from '../components/reminders/CreateReminderModal';
import { ViewReminderModal } from '../components/reminders/ViewReminderModal';

export const RemindersPage: React.FC = () => {
  const { t } = useTranslation();
  const { isTenantAdmin, isLabAdmin } = useAuth();
  const { activeModuleMode } = useModule();
  const toast = useToast();

  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [recurrenceFilter, setRecurrenceFilter] = useState('ALL');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [reminderToEdit, setReminderToEdit] = useState<ReminderItem | null>(null);
  const [reminderToView, setReminderToView] = useState<ReminderItem | null>(null);
  const [reminderToDelete, setReminderToDelete] = useState<ReminderItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit,
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
  }, [page, limit, search, priorityFilter, recurrenceFilter, activeModuleMode]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const handleResetFilters = () => {
    setSearch('');
    setPriorityFilter('ALL');
    setRecurrenceFilter('ALL');
    setPage(1);
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

        {/* Action Button: Lab Admin can create; Tenant Admin CANNOT create */}
        {isLabAdmin && (
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

      {/* Filter Row */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
        }}
      >
        {/* Search */}
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
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

        {/* Priority Filter */}
        <div style={{ width: '160px' }}>
          <SearchableSelect
            options={priorityOptions}
            value={priorityFilter}
            onChange={(val) => {
              setPriorityFilter(val);
              setPage(1);
            }}
          />
        </div>

        {/* Recurrence Filter */}
        <div style={{ width: '170px' }}>
          <SearchableSelect
            options={recurrenceOptions}
            value={recurrenceFilter}
            onChange={(val) => {
              setRecurrenceFilter(val);
              setPage(1);
            }}
          />
        </div>

        {/* Reset Filter Button */}
        {(search || priorityFilter !== 'ALL' || recurrenceFilter !== 'ALL') && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleResetFilters}
            style={{ height: '38px', display: 'flex', alignItems: 'center', gap: '6px' }}
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
                  {t('reminders.table.priority', 'Priority')}
                </th>
                <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {t('reminders.table.recurrence', 'Recurrence')}
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
                  <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t('common.loading', 'Loading reminders...')}
                  </td>
                </tr>
              ) : reminders.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '50px 20px', textAlign: 'center' }}>
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
                    {isLabAdmin && (
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

                      {/* Recurrence */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontSize: '13px', color: 'var(--text-main)' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--bg-surface, #f8fafc)',
                            border: '1px solid var(--border-color)',
                            fontSize: '12px',
                            fontWeight: 500,
                          }}
                        >
                          <Clock size={13} style={{ color: 'var(--primary-600)' }} />
                          {formatRecurrenceSummary(item)}
                        </span>
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

                          {/* Edit: Lab Admin ONLY (Hidden for Tenant Admin) */}
                          {isLabAdmin && (
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

      {/* Create / Edit Modal */}
      <CreateReminderModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setReminderToEdit(null);
        }}
        onSuccess={fetchReminders}
        reminderToEdit={reminderToEdit}
      />

      {/* View Details Modal */}
      <ViewReminderModal
        isOpen={Boolean(reminderToView)}
        onClose={() => setReminderToView(null)}
        reminder={reminderToView}
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
    </div>
  );
};
