import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
  };
  showToast: (item: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (item: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: ToastItem = { ...item, id };

      setToasts((prev) => [...prev, newToast]);

      const duration = item.duration || (item.type === 'error' ? 6000 : 4000);
      setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast],
  );

  const toast = {
    success: (message: string, title?: string) => showToast({ type: 'success', message, title }),
    error: (message: string, title?: string) => showToast({ type: 'error', message, title }),
    warning: (message: string, title?: string) => showToast({ type: 'warning', message, title }),
    info: (message: string, title?: string) => showToast({ type: 'info', message, title }),
  };

  return (
    <ToastContext.Provider value={{ toast, showToast, removeToast }}>
      {children}

      {/* Toast Notification Container */}
      <div
        style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxWidth: '420px',
          width: 'calc(100vw - 48px)',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => {
          let bgColor = 'var(--bg-card)';
          let borderColor = 'var(--border-color)';
          let iconColor = 'var(--primary-600)';
          let IconComponent = Info;

          if (t.type === 'success') {
            borderColor = 'var(--emerald-500)';
            iconColor = 'var(--emerald-500)';
            IconComponent = CheckCircle2;
          } else if (t.type === 'error') {
            borderColor = 'var(--rose-500)';
            iconColor = 'var(--rose-500)';
            IconComponent = AlertCircle;
          } else if (t.type === 'warning') {
            borderColor = 'var(--amber-500)';
            iconColor = 'var(--amber-500)';
            IconComponent = AlertTriangle;
          }

          return (
            <div
              key={t.id}
              style={{
                pointerEvents: 'auto',
                backgroundColor: bgColor,
                color: 'var(--text-main)',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: 'var(--shadow-lg)',
                border: `1px solid ${borderColor}`,
                borderLeft: `5px solid ${iconColor}`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                animation: 'slideInRight 0.25s ease-out forwards',
              }}
            >
              <div style={{ flexShrink: 0, marginTop: '2px', color: iconColor }}>
                <IconComponent size={20} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {t.title && (
                  <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '2px', color: 'var(--text-heading)' }}>
                    {t.title}
                  </div>
                )}
                <div style={{ fontSize: '13px', lineHeight: 1.45, color: 'var(--text-main)', wordBreak: 'break-word' }}>
                  {t.message}
                </div>
              </div>

              <button
                onClick={() => removeToast(t.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
