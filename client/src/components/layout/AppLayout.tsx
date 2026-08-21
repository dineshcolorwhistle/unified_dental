import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../core/context/AuthContext';

export const AppLayout: React.FC = () => {
  const { user } = useAuth();
  const [activeModuleMode, setActiveModuleMode] = useState<'PLATFORM' | 'CLINIC' | 'LAB'>(() => {
    if (user?.isSuperAdmin && !user.activeTenant) return 'PLATFORM';
    if (user?.activeTenant?.enabledModules.includes('LAB')) return 'LAB';
    if (user?.activeTenant?.enabledModules.includes('CLINIC')) return 'CLINIC';
    return 'PLATFORM';
  });

  return (
    <div className="app-container">
      <Sidebar activeModuleMode={activeModuleMode} />
      <div className="main-content-wrapper">
        <AppHeader
          activeModuleMode={activeModuleMode}
          onModuleModeChange={setActiveModuleMode}
        />
        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
