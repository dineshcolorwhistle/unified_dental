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
            width: '320px',
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

          <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: n.readAt ? 'transparent' : 'var(--badge-primary-bg)',
                    border: '1px solid',
                    borderColor: n.readAt ? 'var(--border-subtle)' : 'var(--primary-200)',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-main)' }}>{n.title}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={10} /> {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{n.body}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
