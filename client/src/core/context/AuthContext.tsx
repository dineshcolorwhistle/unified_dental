import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../../services/api';
import { getTenantSlug } from '../utils/tenantContext';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
  isSuperAdmin: boolean;
  isTenantAdmin?: boolean;
  locale: string;
  activeTenant?: {
    id: string;
    name: string;
    slug: string;
    settings?: Record<string, any>;
    enabledModules: string[];
  } | null;
  activeBranchId?: string;
  allowedModules?: string[];
  availableBranches: {
    id: string;
    name: string;
    code?: string;
    moduleKey?: string;
    isDefault: boolean;
  }[];
  tenants: {
    id: string;
    name: string;
    slug: string;
    isOwner: boolean;
    modules: string[];
  }[];
  roles: string[];
  permissions: string[];
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isTenantAdmin: boolean;
  isLabAdmin: boolean;
  isLabTechnician: boolean;
  login: (email: string, pass: string, tenantSlug?: string) => Promise<void>;
  logout: () => Promise<void>;
  switchBranch: (branchId: string) => Promise<void>;
  switchTenant: (tenantSlug: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (permissionKey: string) => boolean;
  isModuleEnabled: (moduleKey: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      const res = await api.get('/auth/me');
      const profile: UserProfile = res.data;
      setUser(profile);

      if (profile.activeTenant?.slug) {
        localStorage.setItem('active_tenant_slug', profile.activeTenant.slug);
      }
      if (profile.activeBranchId) {
        localStorage.setItem('active_branch_id', profile.activeBranchId);
      }
    } catch (e) {
      console.error('Failed to load user profile:', e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const login = async (email: string, pass: string, tenantSlug?: string) => {
    // Subdomain is the primary source of truth for tenant context
    const effectiveSlug = tenantSlug || getTenantSlug() || undefined;

    const res = await api.post('/auth/login', {
      email,
      password: pass,
      tenantSlug: effectiveSlug,
    });

    const { accessToken, refreshToken, user: profile } = res.data;
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);

    if (profile.activeTenant?.slug) {
      localStorage.setItem('active_tenant_slug', profile.activeTenant.slug);
    }
    if (profile.activeBranchId) {
      localStorage.setItem('active_branch_id', profile.activeBranchId);
    }

    localStorage.setItem('ud_last_activity', String(Date.now()));
    setUser(profile);
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      await api.post('/auth/logout', { refreshToken });
    } catch (e) {
      // Ignore
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('ud_last_activity');
      setUser(null);
      window.location.href = '/login';
    }
  };

  // Inactivity / Idle Session Tracker (Configurable via VITE_IDLE_TIMEOUT_MINUTES env, default 30 mins)
  useEffect(() => {
    if (!user) return;

    const envMinutes = Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES);
    const idleTimeoutMinutes = !isNaN(envMinutes) && envMinutes > 0 ? envMinutes : 30;
    const IDLE_TIMEOUT_MS = idleTimeoutMinutes * 60 * 1000;
    const ACTIVITY_STORAGE_KEY = 'ud_last_activity';
    let lastRecorded = Date.now();
    localStorage.setItem(ACTIVITY_STORAGE_KEY, String(lastRecorded));

    const recordActivity = () => {
      const now = Date.now();
      // Throttle localStorage updates to once every 5 seconds
      if (now - lastRecorded > 5000) {
        lastRecorded = now;
        localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
      }
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((evt) => window.addEventListener(evt, recordActivity, { passive: true }));

    const idleInterval = setInterval(() => {
      const storedLastActivity = Number(localStorage.getItem(ACTIVITY_STORAGE_KEY) || lastRecorded);
      const idleTime = Date.now() - storedLastActivity;

      if (idleTime >= IDLE_TIMEOUT_MS) {
        console.warn('User session timed out after 30 minutes of inactivity.');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem(ACTIVITY_STORAGE_KEY);
        setUser(null);
        window.location.href = '/login';
      }
    }, 15000); // Heartbeat check every 15 seconds

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, recordActivity));
      clearInterval(idleInterval);
    };
  }, [user]);

  const switchBranch = async (branchId: string) => {
    if (!user || !user.activeTenant) return;
    try {
      const res = await api.post('/auth/switch-branch', {
        tenantId: user.activeTenant.id,
        branchId,
      });

      const { accessToken, refreshToken, user: updatedUser } = res.data;
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('active_branch_id', branchId);
      setUser(updatedUser);
    } catch (e) {
      console.error('Failed to switch branch:', e);
    }
  };

  const switchTenant = async (tenantSlug: string) => {
    localStorage.setItem('active_tenant_slug', tenantSlug);
    localStorage.removeItem('active_branch_id');
    await refreshProfile();
  };

  const hasPermission = (permissionKey: string): boolean => {
    if (!user) return false;
    if (user.isSuperAdmin || user.permissions.includes('*')) return true;
    return user.permissions.includes(permissionKey);
  };

  const isModuleEnabled = (moduleKey: string): boolean => {
    if (!user || !user.activeTenant) return false;
    return user.activeTenant.enabledModules.includes(moduleKey);
  };

  const isTenantAdmin = Boolean(
    user?.isTenantAdmin ||
    (
      user?.activeTenant &&
      (
        user.tenants?.find((t) => t.id === user.activeTenant?.id)?.isOwner ||
        user.roles?.some((r) => {
          const lower = r.toLowerCase();
          return lower === 'tenant-admin' || lower.includes('tenant administrator') || lower.includes('tenant admin');
        }) ||
        (user.isSuperAdmin && Boolean(user.activeTenant))
      )
    )
  );

  const isLabAdmin = Boolean(
    !user?.isSuperAdmin &&
    user?.roles?.some((r) => {
      const lower = r.toLowerCase();
      return lower === 'lab admin' || lower === 'lab-admin' || lower.includes('lab administrator') || lower.includes('lab admin');
    })
  );

  const isLabTechnician = Boolean(
    !isTenantAdmin &&
    !isLabAdmin &&
    user?.roles?.some((r) => {
      const lower = r.toLowerCase();
      return (
        lower === 'lab technician' ||
        lower === 'technician' ||
        lower === 'lab-technician' ||
        lower.includes('technician')
      );
    })
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isTenantAdmin,
        isLabAdmin,
        isLabTechnician,
        login,
        logout,
        switchBranch,
        switchTenant,
        refreshProfile,
        hasPermission,
        isModuleEnabled,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
