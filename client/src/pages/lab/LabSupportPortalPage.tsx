import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LifeBuoy,
  Plus,
  Search,
  Clock,
  Loader2,
  CheckCircle2,
  Trash2,
  Edit2,
  MessageSquare,
  Building2,
  Filter,
  RefreshCw,
  AlertCircle,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import {
  supportService,
  SupportTicket,
  SupportTicketStatus,
} from '../../services/supportService';
import { CreateTicketModal } from '../../components/support/CreateTicketModal';
import { EditTicketModal } from '../../components/support/EditTicketModal';
import { DeleteTicketConfirmModal } from '../../components/support/DeleteTicketConfirmModal';
import { TicketDetailModal } from '../../components/support/TicketDetailModal';

export const LabSupportPortalPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { user, isTenantAdmin, isLabAdmin } = useAuth();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<SupportTicket | null>(null);
  const [deletingTicket, setDeletingTicket] = useState<SupportTicket | null>(null);
  const [activeDetailTicketId, setActiveDetailTicketId] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const canCreateAndEdit = Boolean(isLabAdmin || user?.isSuperAdmin);
  const canDelete = Boolean(isTenantAdmin || user?.isSuperAdmin);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supportService.getTickets({
        status: selectedStatus !== 'ALL' ? (selectedStatus as SupportTicketStatus) : undefined,
        search: search.trim() || undefined,
        page,
        limit: 15,
      });
      setTickets(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      console.error('Failed to load tickets:', err);
      toast.error(err?.response?.data?.message || t('support.loadError', 'Failed to load tickets.'));
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, search, page, t, toast]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleTicketCreated = () => {
    setPage(1);
    fetchTickets();
  };

  const handleTicketUpdated = (updated: SupportTicket) => {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
    if (editingTicket?.id === updated.id) {
      setEditingTicket(null);
    }
  };

  const handleTicketDeleted = (deletedId: string) => {
    setTickets((prev) => prev.filter((t) => t.id !== deletedId));
    setTotal((prev) => Math.max(0, prev - 1));
  };

  const statusCounts = useMemo(() => {
    return {
      all: total,
      created: tickets.filter((t) => t.status === 'CREATED').length,
      inProgress: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
      completed: tickets.filter((t) => t.status === 'COMPLETED').length,
    };
  }, [tickets, total]);

  const renderStatusBadge = (status: SupportTicketStatus) => {
    switch (status) {
      case 'CREATED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'rgba(245, 158, 11, 0.12)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.25)',
            }}
          >
            <Clock size={12} />
            {t('support.statusCreated', 'Created')}
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'rgba(56, 189, 248, 0.12)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.25)',
            }}
          >
            <RefreshCw size={11} className="spin" />
            {t('support.statusInProgress', 'In Progress')}
          </span>
        );
      case 'COMPLETED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            <CheckCircle2 size={12} />
            {t('support.statusCompleted', 'Completed')}
          </span>
        );
    }
  };

  return (
    <div className="lab-support-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)',
              }}
            >
              <LifeBuoy size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {t('support.labPortalTitle', 'Dental Lab Support Portal')}
              </h1>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                {t(
                  'support.labPortalSubtitle',
                  'Raise technical tickets, track resolution progress, and communicate directly with Platform Admins.',
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => fetchTickets()}
            className="btn btn-secondary"
            title={t('common.refresh', 'Refresh')}
            style={{
              padding: '9px 12px',
              borderRadius: '9px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>

          {canCreateAndEdit ? (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="btn btn-primary"
              style={{
                padding: '9px 18px',
                borderRadius: '9px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                color: '#ffffff',
                border: 'none',
                boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)',
              }}
            >
              <Plus size={16} />
              <span>{t('support.createNewTicket', 'Create Ticket')}</span>
            </button>
          ) : (
            <div
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                fontSize: '12px',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Shield size={14} style={{ color: '#f59e0b' }} />
              <span>{t('support.tenantAdminNote', 'Tenant Admin (View & Delete mode)')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
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
        {/* Status Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: t('common.all', 'All Tickets') },
            { id: 'CREATED', label: t('support.statusCreated', 'Created') },
            { id: 'IN_PROGRESS', label: t('support.statusInProgress', 'In Progress') },
            { id: 'COMPLETED', label: t('support.statusCompleted', 'Completed') },
          ].map((statusTab) => (
            <button
              key={statusTab.id}
              type="button"
              onClick={() => {
                setSelectedStatus(statusTab.id);
                setPage(1);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background:
                  selectedStatus === statusTab.id
                    ? 'linear-gradient(135deg, #0d9488, #0f766e)'
                    : 'var(--bg-app)',
                color: selectedStatus === statusTab.id ? '#ffffff' : 'var(--text-muted)',
              }}
            >
              {statusTab.label}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-app)',
            border: '1px solid var(--border-color)',
            borderRadius: '9px',
            padding: '6px 12px',
            width: '260px',
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
            placeholder={t('support.searchPlaceholder', 'Search ticket # or title...')}
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

      {/* Tickets List / Data Table */}
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
            <Loader2 size={30} className="spin" style={{ color: 'var(--primary-600)' }} />
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
                background: 'rgba(13, 148, 136, 0.1)',
                color: '#0d9488',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LifeBuoy size={24} />
            </div>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {t('support.noTicketsFound', 'No support tickets found')}
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', maxWidth: '420px' }}>
              {search || selectedStatus !== 'ALL'
                ? t('support.noFilteredTickets', 'No tickets match your filter criteria.')
                : t('support.noTicketsIntro', 'Need help with work orders, integrations, or billing? Create a support ticket to get assistance.')}
            </p>
            {canCreateAndEdit && !search && selectedStatus === 'ALL' && (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="btn btn-primary"
                style={{
                  marginTop: '8px',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                {t('support.createFirstTicket', 'Create First Ticket')}
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
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
                  <th style={{ padding: '14px 20px', width: '130px' }}>{t('support.ticketNumber', 'Ticket #')}</th>
                  <th style={{ padding: '14px 20px' }}>{t('support.ticketName', 'Ticket Name')}</th>
                  <th style={{ padding: '14px 20px', width: '140px' }}>{t('common.status', 'Status')}</th>
                  <th style={{ padding: '14px 20px', width: '140px' }}>{t('support.branch', 'Branch')}</th>
                  <th style={{ padding: '14px 20px', width: '160px' }}>{t('support.createdBy', 'Created By')}</th>
                  <th style={{ padding: '14px 20px', width: '150px' }}>{t('support.creationDate', 'Date & Time')}</th>
                  <th style={{ padding: '14px 20px', width: '90px', textAlign: 'center' }}>
                    {t('support.replies', 'Replies')}
                  </th>
                  <th style={{ padding: '14px 20px', width: '130px', textAlign: 'right' }}>
                    {t('common.actions', 'Actions')}
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
                    onClick={() => setActiveDetailTicketId(tItem.id)}
                    className="table-row-hover"
                  >
                    {/* Ticket # */}
                    <td style={{ padding: '14px 20px' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '12px',
                          color: '#0d9488',
                          padding: '3px 7px',
                          borderRadius: '6px',
                          background: 'rgba(13, 148, 136, 0.1)',
                        }}
                      >
                        #{tItem.ticketNumber}
                      </span>
                    </td>

                    {/* Ticket Name / Title */}
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
                          maxWidth: '340px',
                        }}
                      >
                        {tItem.description}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 20px' }}>{renderStatusBadge(tItem.status)}</td>

                    {/* Branch */}
                    <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>
                      {tItem.branch?.name || (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          {t('support.allBranches', 'Main')}
                        </span>
                      )}
                    </td>

                    {/* Created by */}
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {tItem.createdBy?.name || 'User'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {tItem.createdBy?.email}
                      </div>
                    </td>

                    {/* Creation Date & Time */}
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

                    {/* Replies count */}
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        {/* View / Open Thread */}
                        <button
                          type="button"
                          onClick={() => setActiveDetailTicketId(tItem.id)}
                          title={t('support.viewConversation', 'View Conversation')}
                          className="btn-icon"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--primary-600)',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '6px',
                          }}
                        >
                          <MessageSquare size={16} />
                        </button>

                        {/* Lab Admin: Edit */}
                        {canCreateAndEdit && (
                          <button
                            type="button"
                            onClick={() => setEditingTicket(tItem)}
                            title={t('common.edit', 'Edit Ticket')}
                            className="btn-icon"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '6px',
                              borderRadius: '6px',
                            }}
                          >
                            <Edit2 size={16} />
                          </button>
                        )}

                        {/* Tenant Admin: Delete */}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeletingTicket(tItem)}
                            title={t('common.delete', 'Delete Ticket')}
                            className="btn-icon"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '6px',
                              borderRadius: '6px',
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
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

      {/* Modals */}
      <CreateTicketModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleTicketCreated}
      />

      <EditTicketModal
        isOpen={Boolean(editingTicket)}
        ticket={editingTicket}
        onClose={() => setEditingTicket(null)}
        onSuccess={handleTicketUpdated}
      />

      <DeleteTicketConfirmModal
        isOpen={Boolean(deletingTicket)}
        ticket={deletingTicket}
        onClose={() => setDeletingTicket(null)}
        onSuccess={handleTicketDeleted}
      />

      <TicketDetailModal
        isOpen={Boolean(activeDetailTicketId)}
        ticketId={activeDetailTicketId}
        onClose={() => setActiveDetailTicketId(null)}
        onTicketUpdated={handleTicketUpdated}
      />
    </div>
  );
};
