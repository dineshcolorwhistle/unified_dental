import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Users,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  X,
  HardDrive,
  ZoomIn,
  ZoomOut,
  Download,
  AlertCircle,
  Maximize2,
  UploadCloud,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../core/context/AuthContext';
import { useNotifications } from '../../core/context/NotificationContext';
import { formatTime } from '../../core/utils/dateUtils';
import {
  workOrderService,
  WorkOrderChatData,
  WorkOrderChatParticipant,
  WorkOrderChatMessageItem,
  WorkOrderChatAttachment,
  TenantStorageUsage,
  WorkOrderListItem,
} from '../../services/workOrderService';

interface WorkOrderChatTabProps {
  workOrderId: string;
  workOrder?: WorkOrderListItem | null;
  onMessageSent?: () => void;
}

interface QueuedImage {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  sizeBytes: number;
  sizeFormatted: string;
  error?: string;
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

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

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

  // Storage usage state
  const [storageUsage, setStorageUsage] = useState<TenantStorageUsage | null>(null);

  // Image queue state for pre-upload
  const [queuedImages, setQueuedImages] = useState<QueuedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox modal state
  const [activeLightboxImage, setActiveLightboxImage] = useState<WorkOrderChatAttachment | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Fetch chat data and storage usage
  const loadChat = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const [data, storage] = await Promise.all([
        workOrderService.getChat(workOrderId),
        workOrderService.getChatStorageUsage(workOrderId).catch(() => null),
      ]);
      setParticipants(data.participants || []);
      setMessages(data.messages || []);
      if (storage) {
        setStorageUsage(storage);
      }
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

  // Clean up object URLs on unmount or when queued images change
  useEffect(() => {
    return () => {
      queuedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

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

  // Lightbox keyboard listener (Esc to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveLightboxImage(null);
        setLightboxZoom(1);
      }
    };
    if (activeLightboxImage) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeLightboxImage]);

  // Add files to queue with validation
  const addFilesToQueue = (fileList: FileList | File[]) => {
    const newItems: QueuedImage[] = [];
    let validationErrorMessage = '';

    const filesArray = Array.from(fileList);

    // Limit to max 10 images at once
    if (queuedImages.length + filesArray.length > 10) {
      setError(t('workOrders.viewModal.chatTab.maxFilesExceeded', 'A maximum of 10 images can be attached at once.'));
      return;
    }

    filesArray.forEach((file) => {
      // Validate MIME type
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        validationErrorMessage = t('workOrders.viewModal.chatTab.invalidType', {
          name: file.name,
          defaultValue: `Unsupported file type: ${file.name}. Allowed: JPG, PNG, WEBP, GIF`,
        });
        return;
      }

      // Validate single file size (<= 5 MB)
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        validationErrorMessage = t('workOrders.viewModal.chatTab.maxSizeExceeded', {
          name: file.name,
          defaultValue: `Image exceeds the 5 MB limit: ${file.name}`,
        });
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      newItems.push({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        previewUrl,
        name: file.name,
        sizeBytes: file.size,
        sizeFormatted: formatBytes(file.size),
      });
    });

    if (validationErrorMessage) {
      setError(validationErrorMessage);
    } else {
      setError(null);
    }

    if (newItems.length > 0) {
      setQueuedImages((prev) => [...prev, ...newItems]);
    }
  };

  // Remove a single image from pre-upload preview
  const handleRemoveQueuedImage = (idToRemove: string) => {
    setQueuedImages((prev) => {
      const target = prev.find((img) => img.id === idToRemove);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((img) => img.id !== idToRemove);
    });
  };

  // Clear all queued preview images
  const handleClearAllQueuedImages = () => {
    queuedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setQueuedImages([]);
    setError(null);
  };

  // Drag and drop events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDragging(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files);
      // Reset input value so selecting the same file again triggers change
      e.target.value = '';
    }
  };

  // Send message or upload images handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputMessage.trim();
    const hasImages = queuedImages.length > 0;

    if ((!text && !hasImages) || sending) return;

    // Check if total queue exceeds remaining storage if known
    if (hasImages && storageUsage) {
      const totalBatchBytes = queuedImages.reduce((sum, img) => sum + img.sizeBytes, 0);
      if (totalBatchBytes > storageUsage.remainingBytes) {
        setError(
          t('workOrders.viewModal.chatTab.storageQuotaExceeded', {
            available: storageUsage.remainingMb,
            defaultValue: `Tenant storage limit reached. Available: ${storageUsage.remainingMb} MB`,
          }),
        );
        return;
      }
    }

    try {
      setSending(true);
      setError(null);

      let sentMsg: WorkOrderChatMessageItem;

      if (hasImages) {
        const filesToUpload = queuedImages.map((q) => q.file);
        const result = await workOrderService.uploadChatImages(
          workOrderId,
          filesToUpload,
          text || undefined,
        );
        sentMsg = result.message;
        if (result.storageUsage) {
          setStorageUsage(result.storageUsage);
        }
        // Clean up object URLs
        queuedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
        setQueuedImages([]);
      } else {
        sentMsg = await workOrderService.sendChatMessage(workOrderId, text);
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });

      setInputMessage('');
      if (onMessageSent) onMessageSent();
      setTimeout(() => scrollToBottom(), 60);
    } catch (err: any) {
      console.error('Failed to send chat message:', err);
      const errorMsg =
        err?.response?.data?.message ||
        t('workOrders.viewModal.chatTab.sendError', 'Failed to send message.');
      setError(errorMsg);
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

  // Total size of queued preview files
  const queuedTotalBytes = useMemo(() => {
    return queuedImages.reduce((sum, img) => sum + img.sizeBytes, 0);
  }, [queuedImages]);

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
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '480px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* ─── DRAG & DROP OVERLAY ─── */}
      {isDragging && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            backgroundColor: 'rgba(2, 132, 199, 0.12)',
            backdropFilter: 'blur(3px)',
            border: '2px dashed var(--primary-600, #0284c7)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            color: 'var(--primary-600, #0284c7)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(2, 132, 199, 0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <UploadCloud size={32} />
          </div>
          <div style={{ fontSize: '16px', fontWeight: 800 }}>
            {t('workOrders.viewModal.chatTab.dropzoneText', 'Drop images here to attach (Max 5 MB per image)')}
          </div>
        </div>
      )}

      {/* ─── 1. CHAT HEADER CARD ─── */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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

        {/* Storage Quota Usage Badge */}
        {storageUsage && (
          <div
            title={`${storageUsage.usedMb} MB used of ${storageUsage.limitMb} MB (${storageUsage.percentageUsed}%)`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '10px',
              backgroundColor:
                storageUsage.percentageUsed >= 95
                  ? 'rgba(239, 68, 68, 0.1)'
                  : storageUsage.percentageUsed >= 80
                  ? 'rgba(245, 158, 11, 0.1)'
                  : 'var(--bg-card)',
              border: `1px solid ${
                storageUsage.percentageUsed >= 95
                  ? '#ef4444'
                  : storageUsage.percentageUsed >= 80
                  ? '#f59e0b'
                  : 'var(--border-color)'
              }`,
              fontSize: '12px',
              fontWeight: 600,
              color:
                storageUsage.percentageUsed >= 95
                  ? '#ef4444'
                  : storageUsage.percentageUsed >= 80
                  ? '#d97706'
                  : 'var(--text-muted)',
            }}
          >
            <HardDrive size={14} />
            <span>
              {storageUsage.usedMb} MB / {storageUsage.limitMb} MB
            </span>
            <div
              style={{
                width: '40px',
                height: '6px',
                borderRadius: '3px',
                backgroundColor: 'var(--border-color)',
                overflow: 'hidden',
                marginLeft: '2px',
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, storageUsage.percentageUsed)}%`,
                  height: '100%',
                  backgroundColor:
                    storageUsage.percentageUsed >= 95
                      ? '#ef4444'
                      : storageUsage.percentageUsed >= 80
                      ? '#f59e0b'
                      : 'var(--primary-600, #0284c7)',
                  borderRadius: '3px',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ─── 2. PARTICIPANTS AVATAR BAR & TOGGLE ─── */}
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

      {/* ─── 3. EXPANDABLE MEMBERS DIRECTORY ─── */}
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
          gap: '14px',
          backgroundColor: 'var(--bg-card)',
        }}
      >
        {messages.length === 0 ? (
          /* Empty State */
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
            const hasAttachments = Array.isArray(msg.attachments) && msg.attachments.length > 0;

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: isMe ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  gap: '10px',
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
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
                    {/* Render Image Gallery if attachments exist */}
                    {hasAttachments && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            msg.attachments!.length === 1
                              ? '1fr'
                              : 'repeat(auto-fit, minmax(140px, 1fr))',
                          gap: '8px',
                          marginBottom: msg.message ? '10px' : '0',
                          maxWidth: msg.attachments!.length === 1 ? '320px' : '420px',
                        }}
                      >
                        {msg.attachments!.map((att) => (
                          <div
                            key={att.id}
                            style={{
                              position: 'relative',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              backgroundColor: 'rgba(0,0,0,0.05)',
                              cursor: 'pointer',
                              border: isMe ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border-color)',
                              aspectRatio: msg.attachments!.length === 1 ? '16/10' : '1/1',
                              maxHeight: '220px',
                            }}
                            onClick={() => {
                              setActiveLightboxImage(att);
                              setLightboxZoom(1);
                            }}
                          >
                            <img
                              src={att.url}
                              alt={att.originalName}
                              loading="lazy"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block',
                                transition: 'transform 0.2s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.04)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                            />
                            {/* Hover Overlay Icon */}
                            <div
                              style={{
                                position: 'absolute',
                                top: '6px',
                                right: '6px',
                                width: '26px',
                                height: '26px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(0,0,0,0.5)',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backdropFilter: 'blur(2px)',
                              }}
                            >
                              <Maximize2 size={13} />
                            </div>
                            {/* Attachment size label */}
                            <div
                              style={{
                                position: 'absolute',
                                bottom: '4px',
                                left: '6px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(0,0,0,0.55)',
                                color: '#ffffff',
                                fontSize: '10px',
                                fontWeight: 700,
                              }}
                            >
                              {formatBytes(att.size)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Text content if present */}
                    {msg.message && <div>{msg.message}</div>}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ─── ERROR ALERT BANNER ─── */}
      {error && (
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderTop: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            fontSize: '12px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              padding: '2px',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ─── 5. PRE-UPLOAD IMAGE PREVIEW CARD SHELF ─── */}
      {queuedImages.length > 0 && (
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: 'var(--text-muted)',
              fontWeight: 700,
            }}
          >
            <span>
              {queuedImages.length === 1
                ? t('workOrders.viewModal.chatTab.selectedImagesSummary', {
                    count: 1,
                    size: (queuedTotalBytes / (1024 * 1024)).toFixed(2),
                    defaultValue: `1 image selected (${(queuedTotalBytes / (1024 * 1024)).toFixed(2)} MB total)`,
                  })
                : t('workOrders.viewModal.chatTab.selectedImagesSummary_plural', {
                    count: queuedImages.length,
                    size: (queuedTotalBytes / (1024 * 1024)).toFixed(2),
                    defaultValue: `${queuedImages.length} images selected (${(queuedTotalBytes / (1024 * 1024)).toFixed(2)} MB total)`,
                  })}
            </span>
            <button
              type="button"
              onClick={handleClearAllQueuedImages}
              disabled={sending}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              {t('workOrders.viewModal.chatTab.clearAll', 'Clear all')}
            </button>
          </div>

          {/* Horizontal scrollable preview list */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              overflowX: 'auto',
              paddingBottom: '4px',
            }}
          >
            {queuedImages.map((img) => (
              <div
                key={img.id}
                style={{
                  position: 'relative',
                  width: '90px',
                  height: '90px',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  flexShrink: 0,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                }}
              >
                <img
                  src={img.previewUrl}
                  alt={img.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />

                {/* Remove button badge */}
                <button
                  type="button"
                  onClick={() => handleRemoveQueuedImage(img.id)}
                  disabled={sending}
                  title={t('workOrders.viewModal.chatTab.removeImage', 'Remove image')}
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: '#ffffff',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <X size={12} />
                </button>

                {/* Size badge */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '4px',
                    left: '4px',
                    right: '4px',
                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                    color: '#ffffff',
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '2px 4px',
                    borderRadius: '4px',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {img.sizeFormatted}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 6. CHAT INPUT FORM ─── */}
      <form
        onSubmit={handleSendMessage}
        style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
          disabled={sending}
        />

        {/* Attachment Image Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          title={t('workOrders.viewModal.chatTab.attachImages', 'Attach images (max 5 MB each)')}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            backgroundColor: queuedImages.length > 0 ? 'rgba(2, 132, 199, 0.12)' : 'var(--bg-card)',
            color: queuedImages.length > 0 ? 'var(--primary-600, #0284c7)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: sending ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
        >
          <ImageIcon size={19} />
        </button>

        {/* Message Input */}
        <input
          type="text"
          className="form-input"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder={
            queuedImages.length > 0
              ? t('workOrders.viewModal.chatTab.captionPlaceholder', 'Add an optional caption...')
              : t('workOrders.viewModal.chatTab.typeMessagePlaceholder', 'Type a message...')
          }
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

        {/* Send Button */}
        <button
          type="submit"
          disabled={sending || (!inputMessage.trim() && queuedImages.length === 0)}
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
            cursor:
              sending || (!inputMessage.trim() && queuedImages.length === 0)
                ? 'not-allowed'
                : 'pointer',
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

      {/* ─── 7. FULLSCREEN LIGHTBOX MODAL ─── */}
      {activeLightboxImage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={() => {
            setActiveLightboxImage(null);
            setLightboxZoom(1);
          }}
        >
          {/* Lightbox Toolbar */}
          <div
            style={{
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#ffffff',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>
                {activeLightboxImage.originalName}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>
                {formatBytes(activeLightboxImage.size)}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Zoom Out */}
              <button
                type="button"
                onClick={() => setLightboxZoom((prev) => Math.max(0.5, prev - 0.25))}
                title={t('workOrders.viewModal.chatTab.zoomOut', 'Zoom out')}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#ffffff',
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <ZoomOut size={18} />
              </button>

              <span style={{ fontSize: '12px', fontWeight: 700, minWidth: '45px', textAlign: 'center' }}>
                {Math.round(lightboxZoom * 100)}%
              </span>

              {/* Zoom In */}
              <button
                type="button"
                onClick={() => setLightboxZoom((prev) => Math.min(3, prev + 0.25))}
                title={t('workOrders.viewModal.chatTab.zoomIn', 'Zoom in')}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#ffffff',
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <ZoomIn size={18} />
              </button>

              {/* Download */}
              <a
                href={activeLightboxImage.url}
                download={activeLightboxImage.originalName}
                target="_blank"
                rel="noreferrer"
                title={t('workOrders.viewModal.chatTab.downloadImage', 'Download')}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#ffffff',
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  textDecoration: 'none',
                }}
              >
                <Download size={18} />
              </a>

              {/* Close */}
              <button
                type="button"
                onClick={() => {
                  setActiveLightboxImage(null);
                  setLightboxZoom(1);
                }}
                title={t('workOrders.viewModal.chatTab.close', 'Close')}
                style={{
                  background: 'rgba(239, 68, 68, 0.8)',
                  border: 'none',
                  color: '#ffffff',
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  marginLeft: '8px',
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Lightbox Content Area */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'auto',
              padding: '20px',
            }}
          >
            <img
              src={activeLightboxImage.url}
              alt={activeLightboxImage.originalName}
              style={{
                maxWidth: '90vw',
                maxHeight: '85vh',
                objectFit: 'contain',
                transform: `scale(${lightboxZoom})`,
                transition: 'transform 0.15s ease',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
                borderRadius: '8px',
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};
