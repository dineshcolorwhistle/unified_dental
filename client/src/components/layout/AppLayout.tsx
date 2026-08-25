import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { Sidebar } from './Sidebar';
import { useModule } from '../../core/context/ModuleContext';

export const AppLayout: React.FC = () => {
  const { activeModuleMode, setActiveModuleMode } = useModule();

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
