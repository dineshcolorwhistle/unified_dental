import React, { useState, useEffect, useCallback } from 'react';
import {
  LifeBuoy,
  Search,
  Clock,
  Loader2,
  CheckCircle2,
  MessageSquare,
  Building2,
  RefreshCw,
  AlertCircle,
  Inbox,
  Filter,
  ArrowUpRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../core/context/ToastContext';
import api from '../services/api';
import {
  supportService,
  SupportTicket,
  SupportTicketStatus,
  SupportMetrics,
} from '../services/supportService';
import { TicketDetailModal } from '../components/support/TicketDetailModal';

export const PlatformSupportPortalPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [metrics, setMetrics] = useState<SupportMetrics>({
    total: 0,
    createdCount: 0,
    inProgressCount: 0,
    completedCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Array<{ id: string; name: string; slug: string }>>([]);

  // Filters
  const [selectedTenantId, setSelectedTenantId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Active ticket for conversation
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Fetch list of tenants for filter dropdown
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const res = await api.get('/tenants');
        setTenants(res.data?.items || res.data || []);
      } catch (e) {
        console.error('Failed to load tenants list:', e);
      }
    };
    fetchTenants();
  }, []);

  // Fetch metrics & tickets
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [ticketsRes, metricsRes] = await Promise.all([
        supportService.getTickets({
          tenantId: selectedTenantId !== 'ALL' ? selectedTenantId : undefined,
          status: selectedStatus !== 'ALL' ? (selectedStatus as SupportTicketStatus) : undefined,
          search: search.trim() || undefined,
          page,
          limit: 15,
        }),
        supportService.getMetrics(selectedTenantId !== 'ALL' ? selectedTenantId : undefined),
      ]);

      setTickets(ticketsRes.items || []);
      setTotal(ticketsRes.total || 0);
      setTotalPages(ticketsRes.totalPages || 1);
      setMetrics(metricsRes);
    } catch (err: any) {
      console.error('Failed to load platform support tickets:', err);
      toast.error(err?.response?.data?.message || t('support.loadError', 'Failed to load tickets.'));
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId, selectedStatus, search, page, t, toast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleStatusChange = async (ticketId: string, newStatus: SupportTicketStatus) => {
    setUpdatingStatusId(ticketId);
    try {
      const updated = await supportService.updateStatus(ticketId, newStatus);
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: updated.status } : t)));
      toast.success(
        t('support.statusUpdated', 'Ticket status updated to {{status}}', {
          status: newStatus.replace(/_/g, ' '),
        }),
      );
      // Refresh metrics
      const newMetrics = await supportService.getMetrics(
        selectedTenantId !== 'ALL' ? selectedTenantId : undefined,
      );
      setMetrics(newMetrics);
    } catch (err: any) {
      console.error('Failed to update status:', err);
      toast.error(err?.response?.data?.message || t('support.statusUpdateError', 'Failed to update ticket status.'));
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleTicketUpdated = (updated: SupportTicket) => {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
  };

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
            }}
          >
            <LifeBuoy size={22} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {t('support.platformPortalTitle', 'Platform Support Portal')}
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              {t(
                'support.platformPortalSubtitle',
                'Manage, respond to, and resolve technical support tickets raised by Lab Admins across all tenants.',
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchDashboardData()}
          className="btn btn-secondary"
          title={t('common.refresh', 'Refresh')}
          style={{
            padding: '9px 14px',
            borderRadius: '9px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>{t('common.refresh', 'Refresh')}</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Total Tickets */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('support.metricTotal', 'Total Tickets')}
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
              {metrics.total}
            </div>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(148, 163, 184, 0.12)',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Inbox size={20} />
          </div>
        </div>

        {/* Awaiting Action (Created) */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase' }}>
              {t('support.statusCreated', 'Awaiting Action')}
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>
              {metrics.createdCount}
            </div>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.12)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clock size={20} />
          </div>
        </div>

        {/* In Progress */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8', textTransform: 'uppercase' }}>
              {t('support.statusInProgress', 'In Progress')}
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
              {metrics.inProgressCount}
            </div>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(56, 189, 248, 0.12)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RefreshCw size={20} />
          </div>
        </div>

        {/* Completed */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#10b981', textTransform: 'uppercase' }}>
              {t('support.statusCompleted', 'Completed')}
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
              {metrics.completedCount}
            </div>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '12px 18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* Tenant Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building2 size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              value={selectedTenantId}
              onChange={(e) => {
                setSelectedTenantId(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-app)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="ALL">{t('support.allTenants', 'All Tenants')}</option>
              {tenants.map((ten) => (
                <option key={ten.id} value={ten.id}>
                  {ten.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Pills */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: t('common.all', 'All') },
              { id: 'CREATED', label: t('support.statusCreated', 'Created') },
              { id: 'IN_PROGRESS', label: t('support.statusInProgress', 'In Progress') },
              { id: 'COMPLETED', label: t('support.statusCompleted', 'Completed') },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  setSelectedStatus(st.id);
                  setPage(1);
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background:
                    selectedStatus === st.id
                      ? 'linear-gradient(135deg, #0284c7, #0369a1)'
                      : 'var(--bg-app)',
                  color: selectedStatus === st.id ? '#ffffff' : 'var(--text-muted)',
                }}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-app)',
            border: '1px solid var(--border-color)',
            borderRadius: '9px',
            padding: '6px 12px',
            width: '280px',
          }}
        >
          <Search size={15} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('support.searchPlaceholderGlobal', 'Search by ticket #, title, tenant...')}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* Tickets Table */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
        }}
      >
        {loading ? (
          <div
            style={{
              padding: '60px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <Loader2 size={30} className="spin" style={{ color: '#0284c7' }} />
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              {t('support.loadingTickets', 'Loading support tickets...')}
            </span>
          </div>
        ) : tickets.length === 0 ? (
          <div
            style={{
              padding: '60px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'rgba(2, 132, 199, 0.1)',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LifeBuoy size={24} />
            </div>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {t('support.noTicketsPlatform', 'No support tickets found')}
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', maxWidth: '420px' }}>
              {t(
                'support.noTicketsPlatformDesc',
                'Tickets submitted by Dental Lab Admins across tenants will appear here for review and response.',
              )}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr
                  style={{
                    background: 'var(--bg-app)',
                    borderBottom: '1px solid var(--border-color)',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  <th style={{ padding: '14px 20px', width: '120px' }}>{t('support.ticketNumber', 'Ticket #')}</th>
                  <th style={{ padding: '14px 20px', width: '180px' }}>{t('support.tenant', 'Tenant')}</th>
                  <th style={{ padding: '14px 20px' }}>{t('support.ticketName', 'Issue Summary')}</th>
                  <th style={{ padding: '14px 20px', width: '160px' }}>{t('common.status', 'Status')}</th>
                  <th style={{ padding: '14px 20px', width: '160px' }}>{t('support.createdBy', 'Author')}</th>
                  <th style={{ padding: '14px 20px', width: '150px' }}>{t('support.date', 'Submitted')}</th>
                  <th style={{ padding: '14px 20px', width: '90px', textAlign: 'center' }}>
                    {t('support.replies', 'Replies')}
                  </th>
                  <th style={{ padding: '14px 20px', width: '120px', textAlign: 'right' }}>
                    {t('common.actions', 'Action')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((tItem) => (
                  <tr
                    key={tItem.id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'background 0.15s ease',
                      cursor: 'pointer',
                    }}
                    onClick={() => setActiveTicketId(tItem.id)}
                    className="table-row-hover"
                  >
                    {/* Ticket # */}
                    <td style={{ padding: '14px 20px' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '12px',
                          color: '#0284c7',
                          padding: '3px 7px',
                          borderRadius: '6px',
                          background: 'rgba(2, 132, 199, 0.1)',
                        }}
                      >
                        #{tItem.ticketNumber}
                      </span>
                    </td>

                    {/* Tenant & Branch */}
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {tItem.tenant?.name || 'Unknown'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {tItem.branch ? tItem.branch.name : t('support.mainBranch', 'Main')}
                      </div>
                    </td>

                    {/* Title & snippet */}
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                        {tItem.title}
                      </div>
                      <div
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: '12px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '300px',
                        }}
                      >
                        {tItem.description}
                      </div>
                    </td>

                    {/* Status Changer */}
                    <td
                      style={{ padding: '14px 20px' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <select
                        value={tItem.status}
                        disabled={updatingStatusId === tItem.id}
                        onChange={(e) =>
                          handleStatusChange(tItem.id, e.target.value as SupportTicketStatus)
                        }
                        style={{
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-app)',
                          color:
                            tItem.status === 'COMPLETED'
                              ? '#10b981'
                              : tItem.status === 'IN_PROGRESS'
                              ? '#38bdf8'
                              : '#f59e0b',
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        <option value="CREATED">{t('support.statusCreated', 'Created')}</option>
                        <option value="IN_PROGRESS">{t('support.statusInProgress', 'In Progress')}</option>
                        <option value="COMPLETED">{t('support.statusCompleted', 'Completed')}</option>
                      </select>
                    </td>

                    {/* Author */}
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {tItem.createdBy?.name || 'Lab Admin'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {tItem.createdBy?.email}
                      </div>
                    </td>

                    {/* Creation Date */}
                    <td style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {new Date(tItem.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}{' '}
                      <span style={{ color: 'var(--text-muted)' }}>
                        {new Date(tItem.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    {/* Message count */}
                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <MessageSquare size={13} />
                        {tItem._count?.messages || 0}
                      </span>
                    </td>

                    {/* Actions */}
                    <td
                      style={{ padding: '14px 20px', textAlign: 'right' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveTicketId(tItem.id)}
                        className="btn btn-secondary"
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>{t('support.openAndReply', 'Open')}</span>
                        <ArrowUpRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            {t('common.previous', 'Previous')}
          </button>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {t('common.pageOf', 'Page {{page}} of {{total}}', { page, total: totalPages })}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            {t('common.next', 'Next')}
          </button>
        </div>
      )}

      {/* Ticket Conversation & Details Modal */}
      <TicketDetailModal
        isOpen={Boolean(activeTicketId)}
        ticketId={activeTicketId}
        onClose={() => setActiveTicketId(null)}
        onTicketUpdated={handleTicketUpdated}
      />
    </div>
  );
};
