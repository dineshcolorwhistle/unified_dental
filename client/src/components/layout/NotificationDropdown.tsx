import React, { useState, useRef, useEffect } from 'react';
import { useNotifications, NotificationItem } from '../../core/context/NotificationContext';
import { useAuth } from '../../core/context/AuthContext';
import { Bell, CheckCheck, Clock, Eye, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatTime } from '../../core/utils/dateUtils';
import { Tooltip } from '../common/Tooltip';
import { ViewWorkOrderModal } from '../lab/ViewWorkOrderModal';
import { TechnicianWorkOrderDetailModal } from '../lab/TechnicianWorkOrderDetailModal';
import api from '../../services/api';

export const NotificationDropdown: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, removeAllRead } = useNotifications();
  const { t, i18n } = useTranslation();
  const { user, isTenantAdmin, isLabAdmin } = useAuth();
  const tenantTz = user?.activeTenant?.settings?.timezone;
  const [open, setOpen] = useState(false);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isTechnician = Boolean(
    user?.roles?.some((r: string) => r.toLowerCase().includes('technician')) ||
    (!isLabAdmin && !isTenantAdmin && !user?.isSuperAdmin)
  );

  const readCount = notifications.filter((n) => n.readAt).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatNotificationTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat(i18n.language === 'es' ? 'es-MX' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: tenantTz || undefined,
      }).format(d);
    } catch {
      return formatTime(dateStr, { locale: i18n.language, timeZone: tenantTz });
    }
  };

  const isWorkOrderNotification = (n: NotificationItem) => {
    return Boolean(
      n.data?.workOrderId ||
      n.data?.work_order_id ||
      n.data?.folioNumber ||
      n.type === 'WORK_ORDER' ||
      n.title?.toLowerCase().includes('work order') ||
      n.title?.toLowerCase().includes('wo ') ||
      n.title?.toLowerCase().includes('rework') ||
      n.title?.toLowerCase().includes('process') ||
      n.title?.toLowerCase().includes('verification') ||
      n.body?.toLowerCase().includes('work order') ||
      n.body?.toLowerCase().includes('wo "')
    );
  };

  const handleViewWorkOrder = async (notification: NotificationItem) => {
    if (!notification.readAt) {
      markAsRead(notification.id);
    }
    setOpen(false);

    let woId = notification.data?.workOrderId || notification.data?.work_order_id;

    if (!woId) {
      const folio =
        notification.data?.folioNumber ||
        notification.body?.match(/["']([A-Za-z0-9_-]+)["']/)?.[1];
      if (folio) {
        try {
          const res = await api.get('/lab/work-orders', { params: { search: folio, limit: 1 } });
          const items = res.data?.data || res.data || [];
          if (items.length > 0) {
            woId = items[0].id;
          }
        } catch (e) {
          console.error('Failed to lookup work order by folio:', e);
        }
      }
    }

    if (woId) {
      setSelectedWorkOrderId(woId);
    }
  };

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeNotification(id);
  };

  const formatLocalizedNotification = (n: NotificationItem) => {
    const templateKey = n.data?.templateKey;
    if (templateKey) {
      switch (templateKey) {
        case 'WORK_ORDER_ASSIGNED':
          return {
            displayTitle: t('notifications.titles.workOrderAssigned', 'Work Order Assigned'),
            displayBody: t('notifications.messages.workOrderAssigned', {
              processName: n.data?.processName || '',
              folioNumber: n.data?.folioNumber || '',
              defaultValue: n.body,
            }),
          };
        case 'PROCESS_READY':
          return {
            displayTitle: t('notifications.titles.processReady', 'Process Ready to Start'),
            displayBody: t('notifications.messages.processReady', {
              prevProcess: n.data?.prevProcess || '',
              nextProcess: n.data?.nextProcess || '',
              folioNumber: n.data?.folioNumber || '',
              defaultValue: n.body,
            }),
          };
        case 'VERIFICATION_READY':
          return {
            displayTitle: t('notifications.titles.verificationReady', 'Verification Ready'),
            displayBody: t('notifications.messages.verificationReady', {
              actorName: n.data?.actorName || 'Staff',
              processName: n.data?.processName || '',
              nextProcess: n.data?.nextProcessName || n.data?.nextProcess || '',
              folioNumber: n.data?.folioNumber || '',
              defaultValue: n.body,
            }),
          };
        case 'REWORK_REQUIRED':
          return {
            displayTitle: t('notifications.titles.reworkRequired', 'Rework Required'),
            displayBody: t('notifications.messages.reworkRequired', {
              processName: n.data?.processName || '',
              folioNumber: n.data?.folioNumber || '',
              actorName: n.data?.actorName || 'Admin',
              defaultValue: n.body,
            }),
          };
        case 'WORK_ORDER_COMPLETED':
          return {
            displayTitle: t('notifications.titles.workOrderCompleted', 'Work Order Completed'),
            displayBody: t('notifications.messages.workOrderCompleted', {
              folioNumber: n.data?.folioNumber || '',
              actorName: n.data?.actorName || 'Staff',
              defaultValue: n.body,
            }),
          };
        case 'REPETITION_INITIATED':
          return {
            displayTitle: t('notifications.titles.repetition', 'Work Order Restarted (Repetition)'),
            displayBody: t('notifications.messages.repetition', {
              folioNumber: n.data?.folioNumber || '',
              actorName: n.data?.actorName || 'Admin',
              step1: n.data?.step1 || '',
              defaultValue: n.body,
            }),
          };
        case 'EXT_VERIF_AUTO_STARTED':
          return {
            displayTitle: t('notifications.titles.extVerifAuto', 'External Verification Auto-Started'),
            displayBody: t('notifications.messages.extVerifAuto', {
              folioNumber: n.data?.folioNumber || '',
              doctorName: n.data?.doctorName || 'Doctor',
              defaultValue: n.body,
            }),
          };
        case 'NEW_WORK_ORDER_REQUEST':
          return {
            displayTitle: t('notifications.titles.newRequest', 'New Work Order Request'),
            displayBody: t('notifications.messages.newRequest', {
              folioNumber: n.data?.folioNumber || '',
              actorName: n.data?.actorName || 'Staff',
              defaultValue: n.body,
            }),
          };
        case 'NEW_CHAT_MESSAGE':
          return {
            displayTitle: t('notifications.titles.newChatMessage', 'New Message'),
            displayBody: t('notifications.messages.newChatMessage', {
              folioNumber: n.data?.folioNumber || '',
              senderName: n.data?.senderName || 'Staff',
              defaultValue: n.body,
            }),
          };
        default:
          break;
      }
    }

    // Pattern matching fallback for existing database notifications
    const title = n.title || '';
    const body = n.body || '';

    if (/Work Order Assigned/i.test(title)) {
      const match = body.match(/process "(.*?)" on Work Order "(.*?)"/i);
      return {
        displayTitle: t('notifications.titles.workOrderAssigned', 'Work Order Assigned'),
        displayBody: match
          ? t('notifications.messages.workOrderAssigned', { processName: match[1], folioNumber: match[2], defaultValue: body })
          : body,
      };
    }

    if (/Process Ready to Start/i.test(title)) {
      const match = body.match(/Previous process "(.*?)" has completed on Work Order "(.*?)". Step "(.*?)" is now ready/i) ||
                    body.match(/Previous step "(.*?)" completed. You can now start "(.*?)" on Work Order "(.*?)"/i);
      if (match) {
        return {
          displayTitle: t('notifications.titles.processReady', 'Process Ready to Start'),
          displayBody: t('notifications.messages.processReady', {
            prevProcess: match[1],
            folioNumber: match[2] || match[3],
            nextProcess: match[3] || match[2],
            defaultValue: body,
          }),
        };
      }
      return {
        displayTitle: t('notifications.titles.processReady', 'Process Ready to Start'),
        displayBody: body,
      };
    }

    if (/Verification Ready/i.test(title)) {
      const match = body.match(/completed step "(.*?)". Verification step "(.*?)" on Work Order "(.*?)"/i) ||
                    body.match(/Previous step "(.*?)" completed. Verification "(.*?)" is now ready on Work Order "(.*?)"/i);
      if (match) {
        return {
          displayTitle: t('notifications.titles.verificationReady', 'Verification Ready'),
          displayBody: t('notifications.messages.verificationReady', {
            processName: match[1],
            nextProcess: match[2],
            folioNumber: match[3],
            actorName: 'Staff',
            defaultValue: body,
          }),
        };
      }
      return {
        displayTitle: t('notifications.titles.verificationReady', 'Verification Ready'),
        displayBody: body,
      };
    }

    if (/Rework Required/i.test(title)) {
      const match = body.match(/Step "(.*?)" on Work Order "(.*?)" has been flagged for rework by (.*?)\.?$/i);
      return {
        displayTitle: t('notifications.titles.reworkRequired', 'Rework Required'),
        displayBody: match
          ? t('notifications.messages.reworkRequired', { processName: match[1], folioNumber: match[2], actorName: match[3], defaultValue: body })
          : body,
      };
    }

    if (/Work Order Restarted|Repetition/i.test(title)) {
      const match = body.match(/Work Order "(.*?)" has been flagged for full repetition by (.*?)\. Please restart from Step 1: "(.*?)"/i);
      return {
        displayTitle: t('notifications.titles.repetition', 'Work Order Restarted (Repetition)'),
        displayBody: match
          ? t('notifications.messages.repetition', { folioNumber: match[1], actorName: match[2], step1: match[3], defaultValue: body })
          : body,
      };
    }

    if (/External Verification Auto-Started/i.test(title)) {
      const match = body.match(/Work Order "(.*?)" has automatically started external verification for local Dr\. "(.*?)"/i);
      return {
        displayTitle: t('notifications.titles.extVerifAuto', 'External Verification Auto-Started'),
        displayBody: match
          ? t('notifications.messages.extVerifAuto', { folioNumber: match[1], doctorName: match[2], defaultValue: body })
          : body,
      };
    }

    if (/New Work Order Request/i.test(title)) {
      const match = body.match(/Technician (.*?) submitted a new Work Order request "(.*?)"/i);
      return {
        displayTitle: t('notifications.titles.newRequest', 'New Work Order Request'),
        displayBody: match
          ? t('notifications.messages.newRequest', { actorName: match[1], folioNumber: match[2], defaultValue: body })
          : body,
      };
    }

    if (/New Message/i.test(title)) {
      return {
        displayTitle: t('notifications.titles.newChatMessage', 'New Message'),
        displayBody: body,
      };
    }

    return { displayTitle: title, displayBody: body };
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="btn btn-secondary btn-sm"
        style={{
          position: 'relative',
          padding: '7px 10px',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-main)',
          transition: 'all 0.15s ease',
        }}
        title={t('header.notifications')}
      >
        <Bell size={17} style={{ color: 'var(--text-muted)' }} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: 'var(--rose-500)',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: 700,
              borderRadius: '9999px',
              minWidth: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="notification-dropdown-menu"
          style={{
            position: 'absolute',
            top: '110%',
            right: 0,
            width: '360px',
            maxWidth: 'calc(100vw - 24px)',
            backgroundColor: 'var(--bg-dropdown)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--border-color)',
            padding: '12px',
            zIndex: 60,
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '10px',
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: '8px',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>
              {t('header.notifications')} ({unreadCount})
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {readCount > 0 && (
                <button
                  onClick={removeAllRead}
                  style={{
                    fontSize: '11px',
                    color: 'var(--rose-500, #ef4444)',
                    fontWeight: 600,
                    background: 'none',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    transition: 'opacity 0.15s ease',
                  }}
                  title={t('header.removeAllRead')}
                >
                  <Trash2 size={12} /> {t('header.removeAllRead')}
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  style={{
                    fontSize: '11px',
                    color: 'var(--primary-600)',
                    fontWeight: 600,
                    background: 'none',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <CheckCheck size={13} /> {t('header.markAllRead')}
                </button>
              )}
            </div>
          </div>

          <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: '13px' }}>
                {t('header.noNotifications')}
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.readAt && markAsRead(n.id)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '8px',
                    backgroundColor: n.readAt ? 'var(--bg-surface)' : 'var(--badge-primary-bg)',
                    border: '1px solid',
                    borderColor: n.readAt ? 'var(--border-subtle)' : 'var(--primary-200)',
                    borderLeft: n.readAt ? '3px solid transparent' : '3px solid var(--primary-600)',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {(() => {
                      const { displayTitle, displayBody } = formatLocalizedNotification(n);
                      return (
                        <>
                          <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-heading)', marginBottom: '2px' }}>
                            {displayTitle}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '4px', wordBreak: 'break-word' }}>
                            {displayBody}
                          </div>
                        </>
                      );
                    })()}
                    <div style={{ fontSize: '10px', color: 'var(--text-subtle)' }}>
                      {formatNotificationTimestamp(n.createdAt)}
                    </div>
                  </div>

                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                    {/* View Work Order Icon Button */}
                    {isWorkOrderNotification(n) && (
                      <Tooltip content={t('common.viewWorkOrder', { defaultValue: 'View Work Order' })}>
                        <button
                          type="button"
                          onClick={() => handleViewWorkOrder(n)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--primary-600)',
                            padding: '5px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <Eye size={15} />
                        </button>
                      </Tooltip>
                    )}

                    {/* Remove Notification Button */}
                    <Tooltip content={t('header.removeNotification')}>
                      <button
                        type="button"
                        onClick={(e) => handleRemove(e, n.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-subtle)',
                          padding: '5px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                          e.currentTarget.style.color = 'var(--rose-500, #ef4444)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--text-subtle)';
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Respective Work Order Modal based on User Role */}
      {selectedWorkOrderId && (
        isTechnician ? (
          <TechnicianWorkOrderDetailModal
            workOrderId={selectedWorkOrderId}
            onClose={() => setSelectedWorkOrderId(null)}
          />
        ) : (
          <ViewWorkOrderModal
            workOrderId={selectedWorkOrderId}
            isOpen={Boolean(selectedWorkOrderId)}
            onClose={() => setSelectedWorkOrderId(null)}
          />
        )
      )}
    </div>
  );
};
