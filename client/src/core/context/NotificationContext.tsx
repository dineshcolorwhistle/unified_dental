import React, { createContext, useContext, useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import api from '../../services/api';
import { useAuth } from './AuthContext';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  readAt?: string | null;
  createdAt: string;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  socket: Socket | null;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (id: string) => Promise<void>;
  removeAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    }
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications();

    const token = localStorage.getItem('access_token');
    const newSocket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('notification:new', (notification: NotificationItem) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user?.id, user?.activeTenant?.id]);

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Failed to mark read:', e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() })),
      );
      setUnreadCount(0);
    } catch (e) {
      console.error('Failed to mark all read:', e);
    }
  };

  const removeNotification = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => {
        const target = prev.find((n) => n.id === id);
        if (target && !target.readAt) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.filter((n) => n.id !== id);
      });
    } catch (e) {
      console.error('Failed to remove notification:', e);
    }
  };

  const removeAllRead = async () => {
    try {
      await api.delete('/notifications/read');
      setNotifications((prev) => prev.filter((n) => !n.readAt));
    } catch (e) {
      console.error('Failed to remove read notifications:', e);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        socket,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        removeNotification,
        removeAllRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
