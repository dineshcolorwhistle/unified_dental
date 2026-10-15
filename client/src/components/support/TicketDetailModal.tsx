import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Loader2,
  Lock,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  User,
  Calendar,
  MessageSquare,
  ZoomIn,
  ChevronDown,
  Shield,
  LifeBuoy,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../core/context/ToastContext';
import { useAuth } from '../../core/context/AuthContext';
import {
  supportService,
  SupportTicket,
  SupportTicketMessage,
  SupportTicketStatus,
} from '../../services/supportService';

interface TicketDetailModalProps {
  isOpen: boolean;
  ticketId: string | null;
  onClose: () => void;
  onTicketUpdated?: (updated: SupportTicket) => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  isOpen,
  ticketId,
  onClose,
  onTicketUpdated,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { user, isTenantAdmin, isLabAdmin } = useAuth();

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedLightboxImage, setSelectedLightboxImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isPlatformAdmin = Boolean(user?.isSuperAdmin);
  const canUpdateStatus = Boolean(isPlatformAdmin || isLabAdmin);
  const canReply = Boolean((isPlatformAdmin || isLabAdmin) && ticket?.status !== 'COMPLETED');

  const fetchTicketDetails = async (id: string) => {
    setLoading(true);
    try {
      const data = await supportService.getTicketById(id);
      setTicket(data);
      setMessages(data.messages || []);
    } catch (err: any) {
      console.error('Failed to load ticket details:', err);
      toast.error(err?.response?.data?.message || t('support.loadError', 'Failed to load ticket details.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && ticketId) {
      fetchTicketDetails(ticketId);
    } else {
      setTicket(null);
      setMessages([]);
      setNewMessage('');
    }
  }, [isOpen, ticketId]);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (!isOpen || !ticketId) return null;

  const handleStatusChange = async (newStatus: SupportTicketStatus) => {
    if (!ticket || ticket.status === newStatus) return;

    setUpdatingStatus(true);
    try {
      const updated = await supportService.updateStatus(ticket.id, newStatus);
      setTicket((prev) => (prev ? { ...prev, status: updated.status } : null));
      toast.success(
        t('support.statusUpdated', 'Ticket status updated to {{status}}', {
          status: newStatus.replace(/_/g, ' '),
        }),
      );
      if (onTicketUpdated) onTicketUpdated(updated);
    } catch (err: any) {
      console.error('Failed to update status:', err);
      toast.error(err?.response?.data?.message || t('support.statusUpdateError', 'Failed to update ticket status.'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !ticket) return;

    if (ticket.status === 'COMPLETED') {
      toast.error(
        t('support.completedCannotReply', 'Cannot reply to a completed ticket. Conversation is closed.'),
      );
      return;
    }

    setSendingMessage(true);
    try {
      const sent = await supportService.addMessage(ticket.id, newMessage.trim());
      setMessages((prev) => [...prev, sent]);
      setNewMessage('');
      if (onTicketUpdated) {
        onTicketUpdated({
          ...ticket,
          _count: { messages: (ticket._count?.messages || messages.length) + 1 },
        });
      }
    } catch (err: any) {
      console.error('Failed to send message:', err);
      toast.error(err?.response?.data?.message || t('support.sendError', 'Failed to send message.'));
    } finally {
      setSendingMessage(false);
    }
  };

  const renderStatusBadge = (status: SupportTicketStatus) => {
    switch (status) {
      case 'CREATED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              background: 'rgba(245, 158, 11, 0.14)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            <Clock size={13} />
            {t('support.statusCreated', 'Created (Awaiting Action)')}
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              background: 'rgba(56, 189, 248, 0.14)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            <Loader2 size={13} className="spin" />
            {t('support.statusInProgress', 'In Progress')}
          </span>
        );
      case 'COMPLETED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              background: 'rgba(16, 185, 129, 0.14)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <CheckCircle2 size={13} />
            {t('support.statusCompleted', 'Completed')}
          </span>
        );
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '820px',
          width: '95%',
          height: '88vh',
          borderRadius: '16px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modal Top Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-app)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                background: 'rgba(15, 118, 110, 0.15)',
                color: '#2dd4bf',
                fontWeight: 700,
                fontSize: '13px',
                letterSpacing: '0.04em',
                flexShrink: 0,
              }}
            >
              #{ticket?.ticketNumber || '...'}
            </span>
            <h3
              style={{
                margin: 0,
                fontSize: '17px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={ticket?.title}
            >
              {ticket?.title || t('common.loading', 'Loading...')}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            {ticket && (
              <>
                {canUpdateStatus ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('common.status', 'Status')}:</span>
                    <select
                      value={ticket.status}
                      disabled={updatingStatus}
                      onChange={(e) => handleStatusChange(e.target.value as SupportTicketStatus)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-surface)',
                        color:
                          ticket.status === 'COMPLETED'
                            ? '#10b981'
                            : ticket.status === 'IN_PROGRESS'
                            ? '#38bdf8'
                            : '#f59e0b',
                        cursor: updatingStatus ? 'not-allowed' : 'pointer',
                        outline: 'none',
                      }}
                    >
                      <option value="CREATED">{t('support.statusCreated', 'Created')}</option>
                      <option value="IN_PROGRESS">{t('support.statusInProgress', 'In Progress')}</option>
                      <option value="COMPLETED">{t('support.statusCompleted', 'Completed')}</option>
                    </select>
                  </div>
                ) : (
                  renderStatusBadge(ticket.status)
                )}
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="btn-icon"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '6px',
                borderRadius: '8px',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {loading ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <Loader2 size={32} className="spin" style={{ color: 'var(--primary-600)' }} />
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              {t('support.loadingTicket', 'Loading ticket conversation...')}
            </span>
          </div>
        ) : !ticket ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            {t('support.notFound', 'Support ticket not found.')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Ticket Info Bar */}
            <div
              style={{
                padding: '12px 24px',
                background: 'var(--bg-app)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                fontSize: '12px',
                color: 'var(--text-muted)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={14} style={{ color: '#0d9488' }} />
                <span>
                  <strong>{t('support.tenant', 'Tenant')}:</strong> {ticket.tenant?.name || 'N/A'}
                </span>
              </div>

              {ticket.branch && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>
                    <strong>{t('support.branch', 'Branch')}:</strong> {ticket.branch.name}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={14} style={{ color: '#38bdf8' }} />
                <span>
                  <strong>{t('support.createdBy', 'Created By')}:</strong> {ticket.createdBy?.name || 'User'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} style={{ color: '#f59e0b' }} />
                <span>
                  <strong>{t('support.date', 'Created')}:</strong> {new Date(ticket.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Conversation Scroll Container */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                background: 'var(--bg-surface)',
              }}
            >
              {/* Original Issue Card */}
              <div
                style={{
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-app)',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '13px',
                      }}
                    >
                      {ticket.createdBy?.name ? ticket.createdBy.name.charAt(0).toUpperCase() : 'L'}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {ticket.createdBy?.name || 'Lab Admin'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {t('support.originalTicketDescription', 'Original Ticket Description')} •{' '}
                        {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: 'rgba(13, 148, 136, 0.12)',
                      color: '#2dd4bf',
                      fontWeight: 600,
                    }}
                  >
                    {t('support.roleLabAdmin', 'Lab Admin')}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {ticket.description}
                </div>

                {/* Attached Images */}
                {ticket.images && ticket.images.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: '8px',
                      }}
                    >
                      {t('support.attachedScreenshots', 'Attached Images ({{count}}):', {
                        count: ticket.images.length,
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {ticket.images.map((img, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedLightboxImage(img.url)}
                          style={{
                            width: '140px',
                            height: '90px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid var(--border-color)',
                            background: '#090d16',
                            position: 'relative',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title={t('support.clickToZoom', 'Click to view full image')}
                        >
                          <img
                            src={img.url}
                            alt={img.name}
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              bottom: '4px',
                              right: '4px',
                              background: 'rgba(0, 0, 0, 0.65)',
                              padding: '2px 4px',
                              borderRadius: '4px',
                              color: '#ffffff',
                              fontSize: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px',
                            }}
                          >
                            <ZoomIn size={11} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Conversation Messages */}
              {messages.length === 0 ? (
                <div
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '13px',
                    fontStyle: 'italic',
                  }}
                >
                  {t('support.noRepliesYet', 'No replies in this thread yet. Platform Support will respond shortly.')}
                </div>
              ) : (
                messages.map((msg) => {
                  const isPlatformSender = Boolean(msg.sender?.isSuperAdmin);
                  const isMe = msg.senderId === user?.id;

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '4px',
                          paddingLeft: isMe ? '0' : '8px',
                          paddingRight: isMe ? '8px' : '0',
                        }}
                      >
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {msg.sender?.name || 'User'}
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            background: isPlatformSender
                              ? 'rgba(56, 189, 248, 0.15)'
                              : 'rgba(13, 148, 136, 0.15)',
                            color: isPlatformSender ? '#38bdf8' : '#2dd4bf',
                          }}
                        >
                          {isPlatformSender
                            ? t('support.badgePlatform', 'Platform Support')
                            : t('support.badgeLabAdmin', 'Lab Admin')}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div
                        style={{
                          maxWidth: '75%',
                          padding: '12px 16px',
                          borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                          background: isPlatformSender
                            ? 'linear-gradient(135deg, #1e293b, #0f172a)'
                            : isMe
                            ? 'linear-gradient(135deg, #0d9488, #0f766e)'
                            : 'var(--bg-app)',
                          color: '#ffffff',
                          border: isPlatformSender
                            ? '1px solid rgba(56, 189, 248, 0.3)'
                            : isMe
                            ? 'none'
                            : '1px solid var(--border-color)',
                          fontSize: '14px',
                          lineHeight: '1.5',
                          wordBreak: 'break-word',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                        }}
                      >
                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.message}</div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Section: Reply composer or Completed Warning Banner */}
            {ticket.status === 'COMPLETED' ? (
              <div
                style={{
                  padding: '18px 24px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  borderTop: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: '#10b981',
                }}
              >
                <Lock size={20} style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
                  <strong>{t('support.ticketCompletedTitle', 'Ticket Marked as Completed')}</strong>
                  <div style={{ color: 'var(--text-muted)', marginTop: '2px', fontSize: '12px' }}>
                    {t(
                      'support.repliesDisabledNotice',
                      'This support ticket has been resolved. Further replies in this conversation are disabled.',
                    )}
                    {canUpdateStatus && (
                      <span style={{ marginLeft: '6px' }}>
                        {t('support.reopenHint', '(You can change the status above to reopen this ticket).')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : isTenantAdmin && !isLabAdmin && !isPlatformAdmin ? (
              <div
                style={{
                  padding: '16px 24px',
                  background: 'var(--bg-app)',
                  borderTop: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                  textAlign: 'center',
                }}
              >
                {t(
                  'support.tenantAdminReadOnly',
                  'Tenant Admins have view and delete access. Replies are managed by Lab Admins and Platform Admins.',
                )}
              </div>
            ) : (
              <form
                onSubmit={handleSendMessage}
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid var(--border-color)',
                  background: 'var(--bg-app)',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-end',
                }}
              >
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  placeholder={
                    isPlatformAdmin
                      ? t('support.replyPlaceholderAdmin', 'Type response to Lab Admin (Enter to send)...')
                      : t('support.replyPlaceholderUser', 'Type message to Platform Support (Enter to send)...')
                  }
                  rows={2}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    outline: 'none',
                    resize: 'none',
                    lineHeight: '1.4',
                  }}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sendingMessage}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: !newMessage.trim() || sendingMessage ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    height: '42px',
                  }}
                >
                  {sendingMessage ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                  <span>{t('common.send', 'Send')}</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Lightbox / Zoom Modal for Screenshots */}
      {selectedLightboxImage && (
        <div
          onClick={() => setSelectedLightboxImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              borderRadius: '12px',
              overflow: 'hidden',
              background: '#090d16',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
            }}
          >
            <button
              onClick={() => setSelectedLightboxImage(null)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(0, 0, 0, 0.65)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
            <img
              src={selectedLightboxImage}
              alt="Enlarged screenshot"
              style={{ maxWidth: '90vw', maxHeight: '88vh', objectFit: 'contain', display: 'block' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
