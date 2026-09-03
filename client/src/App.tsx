import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './core/context/AuthContext';
import { ModuleProvider } from './core/context/ModuleContext';
import { NotificationProvider } from './core/context/NotificationContext';
import { ThemeProvider } from './core/context/ThemeContext';
import { ToastProvider } from './core/context/ToastContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { BranchesPage } from './pages/BranchesPage';
import { UsersPage } from './pages/UsersPage';
import { TenantsPage } from './pages/TenantsPage';
import { ModulesPage } from './pages/ModulesPage';
import { PlansPage } from './pages/PlansPage';
import { TenantSettingsPage } from './pages/TenantSettingsPage';
import { FinancePage } from './pages/FinancePage';
import { RemindersPage } from './pages/RemindersPage';
import { InventoryPage } from './pages/InventoryPage';
import { ExpensesPage } from './pages/ExpensesPage';
// Lab Module Pages
import { LabStaffPage } from './pages/lab/LabStaffPage';
import { LabUsersAdminPage } from './pages/lab/LabUsersAdminPage';
import { LabUsersTechniciansPage } from './pages/lab/LabUsersTechniciansPage';
import { LabUsersDoctorsPage } from './pages/lab/LabUsersDoctorsPage';
import { LabWorkOrdersPage } from './pages/lab/LabWorkOrdersPage';
import { LabProcessesPage } from './pages/lab/LabProcessesPage';
import { LabProcessAreasPage } from './pages/lab/LabProcessAreasPage';
import { LabWhatsappTemplatesPage } from './pages/lab/LabWhatsappTemplatesPage';
import { LabDeliveriesPage } from './pages/lab/LabDeliveriesPage';
import { LabProsthesisPage } from './pages/lab/LabProsthesisPage';
import { LabDoctorsPage } from './pages/lab/LabDoctorsPage';
// Clinic Module Pages
import { ClinicStaffPage } from './pages/clinic/ClinicStaffPage';
import { ClinicUsersAdminPage } from './pages/clinic/ClinicUsersAdminPage';
import { ClinicUsersStaffPage } from './pages/clinic/ClinicUsersStaffPage';
import { ClinicUsersDoctorsPage } from './pages/clinic/ClinicUsersDoctorsPage';
import { ClinicPatientsPage } from './pages/clinic/ClinicPatientsPage';
import { ClinicAppointmentsPage } from './pages/clinic/ClinicAppointmentsPage';
import { ClinicIncomePage } from './pages/clinic/ClinicIncomePage';
import { ClinicTreatmentsPage } from './pages/clinic/ClinicTreatmentsPage';
import { ClinicPrescriptionsPage } from './pages/clinic/ClinicPrescriptionsPage';
import { ClinicBillingPage } from './pages/clinic/ClinicBillingPage';
import { ClinicDoctorsPage } from './pages/clinic/ClinicDoctorsPage';
import './i18n';

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  superAdminOnly?: boolean;
  tenantAdminOnly?: boolean;
}> = ({
  children,
  superAdminOnly = false,
  tenantAdminOnly = false,
}) => {
  const { user, isTenantAdmin, loading } = useAuth();

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

  if (tenantAdminOnly && !isTenantAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <ModuleProvider>
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
                      path="branches"
                      element={
                        <ProtectedRoute tenantAdminOnly>
                          <BranchesPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="settings"
                      element={
                        <ProtectedRoute>
                          <TenantSettingsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="finance"
                      element={
                        <ProtectedRoute>
                          <FinancePage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="reminders"
                      element={
                        <ProtectedRoute>
                          <RemindersPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="inventory"
                      element={
                        <ProtectedRoute>
                          <InventoryPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="expenses"
                      element={
                        <ProtectedRoute>
                          <ExpensesPage />
                        </ProtectedRoute>
                      }
                    />

                    {/* Lab Module Routes */}
                    <Route path="lab/staff" element={<ProtectedRoute><LabStaffPage /></ProtectedRoute>} />
                    <Route path="lab/users/admin" element={<ProtectedRoute><LabUsersAdminPage /></ProtectedRoute>} />
                    <Route path="lab/users/technicians" element={<ProtectedRoute><LabUsersTechniciansPage /></ProtectedRoute>} />
                    <Route path="lab/users/doctors" element={<ProtectedRoute><LabUsersDoctorsPage /></ProtectedRoute>} />
                    <Route path="lab/work-orders" element={<ProtectedRoute><LabWorkOrdersPage /></ProtectedRoute>} />
                    <Route path="lab/processes" element={<ProtectedRoute><LabProcessesPage /></ProtectedRoute>} />
                    <Route path="lab/process-areas" element={<ProtectedRoute><LabProcessAreasPage /></ProtectedRoute>} />
                    <Route path="lab/prosthesis-types" element={<ProtectedRoute><LabProsthesisPage /></ProtectedRoute>} />
                    <Route path="lab/whatsapp-templates" element={<ProtectedRoute><LabWhatsappTemplatesPage /></ProtectedRoute>} />
                    <Route path="lab/deliveries" element={<ProtectedRoute><LabDeliveriesPage /></ProtectedRoute>} />
                    <Route path="lab/doctors" element={<ProtectedRoute><LabDoctorsPage /></ProtectedRoute>} />

                    {/* Clinic Module Routes */}
                    <Route path="clinic/staff" element={<ProtectedRoute><ClinicStaffPage /></ProtectedRoute>} />
                    <Route path="clinic/users/admin" element={<ProtectedRoute><ClinicUsersAdminPage /></ProtectedRoute>} />
                    <Route path="clinic/users/staff" element={<ProtectedRoute><ClinicUsersStaffPage /></ProtectedRoute>} />
                    <Route path="clinic/users/doctors" element={<ProtectedRoute><ClinicUsersDoctorsPage /></ProtectedRoute>} />
                    <Route path="clinic/patients" element={<ProtectedRoute><ClinicPatientsPage /></ProtectedRoute>} />
                    <Route path="clinic/appointments" element={<ProtectedRoute><ClinicAppointmentsPage /></ProtectedRoute>} />
                    <Route path="clinic/income" element={<ProtectedRoute><ClinicIncomePage /></ProtectedRoute>} />
                    <Route path="clinic/treatments" element={<ProtectedRoute><ClinicTreatmentsPage /></ProtectedRoute>} />
                    <Route path="clinic/prescriptions" element={<ProtectedRoute><ClinicPrescriptionsPage /></ProtectedRoute>} />
                    <Route path="clinic/billing" element={<ProtectedRoute><ClinicBillingPage /></ProtectedRoute>} />
                    <Route path="clinic/doctors" element={<ProtectedRoute><ClinicDoctorsPage /></ProtectedRoute>} />

                    {/* Platform Super Admin Routes */}
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
          </ModuleProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};
