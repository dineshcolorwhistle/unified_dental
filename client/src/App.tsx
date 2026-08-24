import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './core/context/AuthContext';
import { NotificationProvider } from './core/context/NotificationContext';
import { ThemeProvider } from './core/context/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { TenantsPage } from './pages/TenantsPage';
import { ModulesPage } from './pages/ModulesPage';
import { PlansPage } from './pages/PlansPage';
import './i18n';

const ProtectedRoute: React.FC<{ children: React.ReactNode; superAdminOnly?: boolean }> = ({
  children,
  superAdminOnly = false,
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app)' }}>
        <div style={{ fontSize: '15px', color: 'var(--primary-600)', fontWeight: 600 }}>Loading workspace...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (superAdminOnly && !user.isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route
                path="tenants"
                element={
                  <ProtectedRoute superAdminOnly>
                    <TenantsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="modules"
                element={
                  <ProtectedRoute superAdminOnly>
                    <ModulesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="plans"
                element={
                  <ProtectedRoute superAdminOnly>
                    <PlansPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  </ThemeProvider>
);
};
