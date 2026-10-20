import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { Sidebar } from './Sidebar';
import { useModule } from '../../core/context/ModuleContext';

export const AppLayout: React.FC = () => {
  const { activeModuleMode, setActiveModuleMode } = useModule();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState<boolean>(() => {
    return typeof window !== 'undefined'
      ? localStorage.getItem('ud_sidebar_collapsed') === 'true'
      : false;
  });

  const handleCloseMobile = React.useCallback(() => {
    setMobileSidebarOpen(false);
  }, []);

  const handleToggleSidebar = React.useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
      setMobileSidebarOpen((prev) => !prev);
    } else {
      setIsDesktopCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem('ud_sidebar_collapsed', String(next));
        return next;
      });
    }
  }, []);

  const handleToggleCollapse = React.useCallback(() => {
    setIsDesktopCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('ud_sidebar_collapsed', String(next));
      return next;
    });
  }, []);

  return (
    <div className="app-container">
      <Sidebar
        activeModuleMode={activeModuleMode}
        isMobileOpen={mobileSidebarOpen}
        onCloseMobile={handleCloseMobile}
        isCollapsedProp={isDesktopCollapsed}
        onToggleCollapseProp={handleToggleCollapse}
      />
      <div className="main-content-wrapper">
        <AppHeader
          activeModuleMode={activeModuleMode}
          onModuleModeChange={setActiveModuleMode}
          onToggleSidebar={handleToggleSidebar}
          onToggleMobileSidebar={handleToggleSidebar}
          isSidebarCollapsed={isDesktopCollapsed}
        />
        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

