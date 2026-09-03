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
  const { user, isTenantAdmin } = useAuth();
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

    // Non-tenant admin: force their allowed module
    if (!isTenantAdmin && allowedModules.length > 0) {
      if (allowedModules.includes('LAB')) return 'LAB';
      if (allowedModules.includes('CLINIC')) return 'CLINIC';
    }

    // Tenant admin or fallback: check localStorage preference
    if (canSwitchModules) {
      const saved = localStorage.getItem('ud_active_module_mode') as ModuleMode | null;
      if (saved === 'CLINIC' && isClinicEnabled) return 'CLINIC';
      if (saved === 'LAB' && isLabEnabled) return 'LAB';
      if (saved === 'PLATFORM' && user?.isSuperAdmin) return 'PLATFORM';
    }

    // If tenant only has 1 module, force that module
    if (isSingleModule) {
      if (isClinicEnabled) return 'CLINIC';
      if (isLabEnabled) return 'LAB';
    }

    if (isClinicEnabled) return 'CLINIC';
    if (isLabEnabled) return 'LAB';
    return 'PLATFORM';
  };

  const [activeModuleMode, setActiveModuleModeState] = useState<ModuleMode>(resolveInitialMode);

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
