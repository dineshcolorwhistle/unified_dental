import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

export type ModuleMode = 'PLATFORM' | 'CLINIC' | 'LAB';

interface ModuleContextType {
  activeModuleMode: ModuleMode;
  setActiveModuleMode: (mode: ModuleMode) => void;
  enabledModules: string[];
  isClinicEnabled: boolean;
  isLabEnabled: boolean;
  isSingleModule: boolean;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export const ModuleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const tenant = user?.activeTenant;
  const enabledModules = tenant?.enabledModules || [];
  const isClinicEnabled = enabledModules.includes('CLINIC');
  const isLabEnabled = enabledModules.includes('LAB');
  const isSingleModule = enabledModules.length === 1;

  const resolveInitialMode = (): ModuleMode => {
    if (user?.isSuperAdmin && !tenant) return 'PLATFORM';
    
    // If tenant only has 1 module, force that module
    if (isSingleModule) {
      if (isClinicEnabled) return 'CLINIC';
      if (isLabEnabled) return 'LAB';
    }

    // If multiple modules enabled, check localStorage
    const saved = localStorage.getItem('ud_active_module_mode') as ModuleMode | null;
    if (saved === 'CLINIC' && isClinicEnabled) return 'CLINIC';
    if (saved === 'LAB' && isLabEnabled) return 'LAB';
    if (saved === 'PLATFORM' && user?.isSuperAdmin) return 'PLATFORM';

    if (isClinicEnabled) return 'CLINIC';
    if (isLabEnabled) return 'LAB';
    return 'PLATFORM';
  };

  const [activeModuleMode, setActiveModuleModeState] = useState<ModuleMode>(resolveInitialMode);

  useEffect(() => {
    const nextMode = resolveInitialMode();
    setActiveModuleModeState(nextMode);
  }, [user?.activeTenant?.id, user?.activeTenant?.enabledModules?.join(',')]);

  const setActiveModuleMode = (mode: ModuleMode) => {
    setActiveModuleModeState(mode);
    localStorage.setItem('ud_active_module_mode', mode);
  };

  return (
    <ModuleContext.Provider
      value={{
        activeModuleMode,
        setActiveModuleMode,
        enabledModules,
        isClinicEnabled,
        isLabEnabled,
        isSingleModule,
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
