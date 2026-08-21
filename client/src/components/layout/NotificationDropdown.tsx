import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../../core/context/NotificationContext';
import { Bell, CheckCheck, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const NotificationDropdown: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="btn btn-secondary btn-sm"
        style={{
          position: 'relative',
          padding: '7px 10px',
          borderRadius: '8px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
        }}
        title={t('header.notifications')}
      >
        <Bell size={17} style={{ color: '#475569' }} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: '#f43f5e',
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
            width: '320px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
            border: '1px solid #e2e8f0',
            padding: '12px',
            zIndex: 60,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '10px',
              borderBottom: '1px solid #f1f5f9',
              marginBottom: '8px',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
              {t('header.notifications')} ({unreadCount})
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  fontSize: '11px',
                  color: '#0f766e',
                  fontWeight: 600,
                  background: 'none',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <CheckCheck size={13} /> {t('header.markAllRead')}
              </button>
            )}
          </div>

          <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                {t('header.noNotifications')}
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.readAt && markAsRead(n.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: n.readAt ? '#ffffff' : '#f0fdfa',
                    border: '1px solid',
                    borderColor: n.readAt ? '#f1f5f9' : '#ccfbf1',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 600, fontSize: '12px', color: '#0f172a' }}>{n.title}</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={10} /> {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>{n.body}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
