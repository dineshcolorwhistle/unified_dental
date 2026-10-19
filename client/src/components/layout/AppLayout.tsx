import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { Sidebar } from './Sidebar';
import { useModule } from '../../core/context/ModuleContext';

export const AppLayout: React.FC = () => {
  const { activeModuleMode, setActiveModuleMode } = useModule();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="app-container">
      <Sidebar
        activeModuleMode={activeModuleMode}
        isMobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />
      <div className="main-content-wrapper">
        <AppHeader
          activeModuleMode={activeModuleMode}
          onModuleModeChange={setActiveModuleMode}
          onToggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)}
        />
        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

