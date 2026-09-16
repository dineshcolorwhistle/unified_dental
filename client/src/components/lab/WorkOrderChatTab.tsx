import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Users,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../core/context/AuthContext';
import { useNotifications } from '../../core/context/NotificationContext';
import { formatTime, formatDate } from '../../core/utils/dateUtils';
import {
  workOrderService,
  WorkOrderChatData,
  WorkOrderChatParticipant,
  WorkOrderChatMessageItem,
  WorkOrderListItem,
} from '../../services/workOrderService';

interface WorkOrderChatTabProps {
  workOrderId: string;
  workOrder?: WorkOrderListItem | null;
  onMessageSent?: () => void;
}

// Deterministic color palette for avatar pills
const AVATAR_COLORS = [
  { bg: '#3b82f6', text: '#ffffff' }, // Blue
  { bg: '#0284c7', text: '#ffffff' }, // Sky
  { bg: '#10b981', text: '#ffffff' }, // Emerald
  { bg: '#f59e0b', text: '#ffffff' }, // Amber
  { bg: '#8b5cf6', text: '#ffffff' }, // Violet
  { bg: '#06b6d4', text: '#ffffff' }, // Cyan
  { bg: '#ec4899', text: '#ffffff' }, // Pink
  { bg: '#14b8a6', text: '#ffffff' }, // Teal
];

function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(idOrName: string) {
  let hash = 0;
  for (let i = 0; i < idOrName.length; i++) {
    hash = (hash << 5) - hash + idOrName.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export const WorkOrderChatTab: React.FC<WorkOrderChatTabProps> = ({
  workOrderId,
  workOrder,
  onMessageSent,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { socket } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<WorkOrderChatParticipant[]>([]);
  const [messages, setMessages] = useState<WorkOrderChatMessageItem[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Fetch chat data
  const loadChat = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const data: WorkOrderChatData = await workOrderService.getChat(workOrderId);
      setParticipants(data.participants || []);
      setMessages(data.messages || []);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load chat:', err);
      setError(t('workOrders.viewModal.chatTab.loadError', 'Failed to load chat conversation.'));
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    loadChat(true);
  }, [workOrderId]);

  // Auto-scroll on initial load or messages change
  useEffect(() => {
    if (!loading) {
      scrollToBottom('auto');
    }
  }, [loading, messages.length]);

  // Real-time socket listener for incoming messages
  useEffect(() => {
    if (!socket) return;

    const handleIncomingMessage = (payload: {
      workOrderId: string;
      message: WorkOrderChatMessageItem;
    }) => {
      if (payload?.workOrderId === workOrderId && payload.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.message.id)) return prev;
          return [...prev, payload.message];
        });
        // Mark as read immediately since user is actively in this chat
        workOrderService.markChatRead(workOrderId).catch(() => {});
      }
    };

    socket.on('work_order:chat_message', handleIncomingMessage);

    return () => {
      socket.off('work_order:chat_message', handleIncomingMessage);
    };
  }, [socket, workOrderId]);

  // Send message handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text || sending) return;

    try {
      setSending(true);
      const sentMsg = await workOrderService.sendChatMessage(workOrderId, text);
      setMessages((prev) => {
        if (prev.some((m) => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });
      setInputMessage('');
      if (onMessageSent) onMessageSent();
      setTimeout(() => scrollToBottom(), 50);
    } catch (err: any) {
      console.error('Failed to send chat message:', err);
      alert(t('workOrders.viewModal.chatTab.sendError', 'Failed to send message.'));
    } finally {
      setSending(false);
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'Administrator':
        return { color: 'var(--primary-600, #0284c7)', fontWeight: 700 };
      case 'Technician':
        return { color: 'var(--emerald-600, #10b981)', fontWeight: 700 };
      case 'Doctor':
        return { color: 'var(--amber-600, #d97706)', fontWeight: 700 };
      default:
        return { color: 'var(--text-muted)', fontWeight: 600 };
    }
  };

  const getLocalizedRole = (role: string) => {
    if (role === 'Administrator') return t('workOrders.viewModal.chatTab.roleAdmin', 'Administrator');
    if (role === 'Technician') return t('workOrders.viewModal.chatTab.roleTechnician', 'Technician');
    if (role === 'Doctor') return t('workOrders.viewModal.chatTab.roleDoctor', 'Doctor');
    return role;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        <Loader2 size={32} className="spinner" style={{ margin: '0 auto 12px' }} />
        <div>{t('common.loading', 'Loading...')}</div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '480px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}
    >
      {/* ─── 1. CHAT HEADER CARD (Matching Screenshot 1) ─── */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: 'rgba(2, 132, 199, 0.12)',
            color: 'var(--primary-600, #0284c7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <MessageSquare size={22} />
        </div>
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 800,
              color: 'var(--text-heading)',
              fontFamily: 'var(--font-heading)',
            }}
          >
            {t('workOrders.viewModal.chatTab.title', 'Work Order Chat')}
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            {t('workOrders.viewModal.chatTab.participantsCount', {
              count: participants.length,
              defaultValue: `${participants.length} participants in this chat`,
            })}
          </p>
        </div>
      </div>

      {/* ─── 2. PARTICIPANTS AVATAR BAR & TOGGLE (Screenshot 1) ─── */}
      <div
        style={{
          padding: '10px 20px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        {/* Avatar Pills Stack */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {participants.map((p) => {
            const colors = getAvatarColor(p.id || p.name);
            const initials = getInitials(p.name);
            return (
              <div
                key={p.id}
                title={`${p.name} (${getLocalizedRole(p.role)})`}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: colors.bg,
                  color: colors.text,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 800,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                {initials}
              </div>
            );
          })}
        </div>

        {/* Hide / Show Members Button */}
        <button
          type="button"
          onClick={() => setShowMembers(!showMembers)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-main)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Users size={14} style={{ color: 'var(--text-muted)' }} />
          <span>
            {showMembers
              ? t('workOrders.viewModal.chatTab.hideMembers', 'Hide members')
              : t('workOrders.viewModal.chatTab.showMembers', 'Show members')}
          </span>
        </button>
      </div>

      {/* ─── 3. EXPANDABLE MEMBERS DIRECTORY (Screenshot 1) ─── */}
      {showMembers && (
        <div
          style={{
            maxHeight: '160px',
            overflowY: 'auto',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
            padding: '8px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {participants.map((p) => {
            const isMe = p.id === user?.id;
            const colors = getAvatarColor(p.id || p.name);
            const initials = getInitials(p.name);
            const roleStyle = getRoleBadgeStyle(p.role);

            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: colors.bg,
                      color: colors.text,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--text-heading)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span>{p.name}</span>
                      {isMe && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                          {t('workOrders.viewModal.chatTab.youTag', '(You)')}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span style={roleStyle}>{getLocalizedRole(p.role)}</span>
                      {p.branchName && <span> • {p.branchName}</span>}
                    </div>
                  </div>
                </div>

                <div style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                  {isMe ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 4. CHAT MESSAGES STREAM AREA ─── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          backgroundColor: 'var(--bg-card)',
        }}
      >
        {messages.length === 0 ? (
          /* Empty State (Matching Screenshot 1) */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              padding: '50px 20px',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
                border: '1px dashed var(--border-color)',
              }}
            >
              <MessageSquare size={28} style={{ opacity: 0.4, color: 'var(--text-muted)' }} />
            </div>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
              {t('workOrders.viewModal.chatTab.noMessages', 'No messages yet. Start the conversation!')}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.id;
            const senderParticipant = participants.find((p) => p.id === msg.senderId);
            const senderName = msg.sender?.name || senderParticipant?.name || 'User';
            const role = senderParticipant?.role || msg.sender?.role || 'User';
            const colors = getAvatarColor(msg.senderId || senderName);

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: isMe ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  gap: '10px',
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                }}
              >
                {!isMe && (
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: colors.bg,
                      color: colors.text,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 800,
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    {getInitials(senderName)}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  {/* Sender Info Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      padding: '0 4px',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: 'var(--text-heading)' }}>
                      {isMe ? t('workOrders.chat.you', 'You') : senderName}
                    </span>
                    {!isMe && (
                      <span style={{ fontSize: '10px', ...getRoleBadgeStyle(role) }}>
                        ({getLocalizedRole(role)})
                      </span>
                    )}
                    <span>•</span>
                    <span>{formatTime(msg.createdAt)}</span>
                  </div>

                  {/* Message Bubble */}
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      backgroundColor: isMe ? 'var(--primary-600, #0284c7)' : 'var(--bg-surface)',
                      color: isMe ? '#ffffff' : 'var(--text-main)',
                      border: isMe ? 'none' : '1px solid var(--border-color)',
                      fontSize: '13px',
                      lineHeight: 1.5,
                      wordBreak: 'break-word',
                      boxShadow: isMe ? '0 1px 3px rgba(2, 132, 199, 0.25)' : '0 1px 2px rgba(0,0,0,0.02)',
                    }}
                  >
                    {msg.message}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ─── 5. CHAT INPUT FORM (Screenshot 1 Bottom) ─── */}
      <form
        onSubmit={handleSendMessage}
        style={{
          padding: '14px 18px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <input
          type="text"
          className="form-input"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder={t('workOrders.viewModal.chatTab.typeMessagePlaceholder', 'Type a message...')}
          disabled={sending}
          style={{
            flex: 1,
            height: '42px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            fontSize: '13px',
            padding: '0 14px',
          }}
        />

        <button
          type="submit"
          disabled={sending || !inputMessage.trim()}
          className="btn btn-primary"
          style={{
            height: '42px',
            padding: '0 18px',
            borderRadius: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 700,
            fontSize: '13px',
            cursor: sending || !inputMessage.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {sending ? (
            <Loader2 size={16} className="spinner" />
          ) : (
            <Send size={16} />
          )}
          <span>{t('workOrders.viewModal.chatTab.sendBtn', 'Send')}</span>
        </button>
      </form>
    </div>
  );
};
