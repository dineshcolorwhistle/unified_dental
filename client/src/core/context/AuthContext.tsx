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
  locale: string;
  activeTenant?: {
    id: string;
    name: string;
    slug: string;
    enabledModules: string[];
  } | null;
  activeBranchId?: string;
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
      setUser(null);
      window.location.href = '/login';
    }
  };

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

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
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
