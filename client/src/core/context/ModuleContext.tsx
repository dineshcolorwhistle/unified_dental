import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

export type ModuleMode = 'PLATFORM' | 'CLINIC' | 'LAB';

interface ModuleContextType {
  activeModuleMode: ModuleMode;
  setActiveModuleMode: (mode: ModuleMode) => void;
  enabledModules: string[];
  allowedModules: string[];
  isClinicEnabled: boolean;
  isLabEnabled: boolean;
  isSingleModule: boolean;
  canSwitchModules: boolean;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export const ModuleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isTenantAdmin, loading: authLoading } = useAuth();
  const tenant = user?.activeTenant;
  const enabledModules = tenant?.enabledModules || [];
  const isClinicEnabled = enabledModules.includes('CLINIC');
  const isLabEnabled = enabledModules.includes('LAB');
  const isSingleModule = enabledModules.length === 1;

  // Allowed modules for this specific user (from backend)
  const allowedModules = user?.allowedModules || enabledModules;

  // Only Tenant Admin (or Super Admin with tenant context) can switch between modules
  const canSwitchModules = isTenantAdmin && allowedModules.length > 1;

  const resolveInitialMode = (): ModuleMode => {
    if (user?.isSuperAdmin && !tenant) return 'PLATFORM';

    // Non-tenant admin: force their allowed module dynamically
    if (!isTenantAdmin && allowedModules.length > 0) {
      if (allowedModules.includes('LAB')) return 'LAB';
      if (allowedModules.includes('CLINIC')) return 'CLINIC';
      return (allowedModules[0] as ModuleMode) || 'LAB';
    }

    // Check localStorage preference
    const saved = localStorage.getItem('ud_active_module_mode') as ModuleMode | null;
    if (saved && (saved === 'CLINIC' || saved === 'LAB' || saved === 'PLATFORM')) {
      if (canSwitchModules) {
        if (saved === 'CLINIC' && isClinicEnabled) return 'CLINIC';
        if (saved === 'LAB' && isLabEnabled) return 'LAB';
        if (saved === 'PLATFORM' && user?.isSuperAdmin) return 'PLATFORM';
      } else if (!isTenantAdmin && allowedModules.length > 0 && allowedModules.includes(saved)) {
        return saved;
      }
    }

    // If tenant only has 1 module, force that module
    if (isSingleModule) {
      if (isClinicEnabled) return 'CLINIC';
      if (isLabEnabled) return 'LAB';
      return (enabledModules[0] as ModuleMode) || 'PLATFORM';
    }

    // If user has allowed modules, prioritize the first allowed module
    if (allowedModules.length > 0) {
      if (allowedModules.includes('LAB') && !allowedModules.includes('CLINIC')) return 'LAB';
      if (allowedModules.includes('CLINIC')) return 'CLINIC';
      return (allowedModules[0] as ModuleMode) || 'PLATFORM';
    }

    // Default fallbacks
    if (saved === 'LAB' || saved === 'CLINIC') return saved;
    if (isClinicEnabled) return 'CLINIC';
    if (isLabEnabled) return 'LAB';
    return 'PLATFORM';
  };

  const [activeModuleMode, setActiveModuleModeState] = useState<ModuleMode>(resolveInitialMode);
  const [prevUserKey, setPrevUserKey] = useState<string>('');

  // Synchronously adjust state during render when user auth or allowed modules settle
  const currentUserKey = `${user?.id || ''}_${user?.activeTenant?.id || ''}_${allowedModules.join(',')}_${isTenantAdmin}`;
  if (currentUserKey !== prevUserKey) {
    setPrevUserKey(currentUserKey);
    const targetMode = resolveInitialMode();
    if (targetMode !== activeModuleMode) {
      setActiveModuleModeState(targetMode);
    }
  }

  useEffect(() => {
    const nextMode = resolveInitialMode();
    setActiveModuleModeState(nextMode);
  }, [user?.activeTenant?.id, user?.activeTenant?.enabledModules?.join(','), user?.allowedModules?.join(','), isTenantAdmin]);

  const setActiveModuleMode = (mode: ModuleMode) => {
    // Only allow switching if user has permission
    if (!canSwitchModules && mode !== activeModuleMode) {
      return; // Silently prevent unauthorized module switching
    }
    setActiveModuleModeState(mode);
    localStorage.setItem('ud_active_module_mode', mode);
  };

  return (
    <ModuleContext.Provider
      value={{
        activeModuleMode,
        setActiveModuleMode,
        enabledModules,
        allowedModules,
        isClinicEnabled,
        isLabEnabled,
        isSingleModule,
        canSwitchModules,
      }}
    >
      {children}
    </ModuleContext.Provider>
  );
};

export const useModule = () => {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error('useModule must be used within a ModuleProvider');
  }
  return context;
};
