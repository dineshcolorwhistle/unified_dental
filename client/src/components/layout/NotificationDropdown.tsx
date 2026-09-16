import React, { useState, useRef, useEffect } from 'react';
import { useNotifications, NotificationItem } from '../../core/context/NotificationContext';
import { useAuth } from '../../core/context/AuthContext';
import { Bell, CheckCheck, Clock, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatTime } from '../../core/utils/dateUtils';
import { Tooltip } from '../common/Tooltip';
import { ViewWorkOrderModal } from '../lab/ViewWorkOrderModal';
import { TechnicianWorkOrderDetailModal } from '../lab/TechnicianWorkOrderDetailModal';
import api from '../../services/api';

export const NotificationDropdown: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
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
          style={{
            position: 'absolute',
            top: '110%',
            right: 0,
            width: '340px',
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
                    borderLeft: n.readAt ? '3px solid transparent' : '3px solid #0284c7',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-heading)', marginBottom: '2px' }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '4px', wordBreak: 'break-word' }}>
                      {n.body}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-subtle)' }}>
                      {formatNotificationTimestamp(n.createdAt)}
                    </div>
                  </div>

                  {/* View Work Order Icon Button (Screenshot Match) */}
                  {isWorkOrderNotification(n) && (
                    <div style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <Tooltip content={t('common.viewWorkOrder', { defaultValue: 'View Work Order' })}>
                        <button
                          type="button"
                          onClick={() => handleViewWorkOrder(n)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--primary-600)',
                            padding: '6px',
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
                          <Eye size={16} />
                        </button>
                      </Tooltip>
                    </div>
                  )}
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
