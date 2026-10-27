import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './core/context/AuthContext';
import { ModuleProvider, useModule } from './core/context/ModuleContext';
import { NotificationProvider } from './core/context/NotificationContext';
import { ThemeProvider } from './core/context/ThemeContext';
import { ToastProvider } from './core/context/ToastContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { PortalCallbackPage } from './pages/PortalCallbackPage';
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
import { PublicQrTrackingPage } from './pages/PublicQrTrackingPage';
import { QrInquiriesPage } from './pages/QrInquiriesPage';
// Lab Module Pages
import { LabStaffPage } from './pages/lab/LabStaffPage';
import { LabUsersAdminPage } from './pages/lab/LabUsersAdminPage';
import { LabUsersTechniciansPage } from './pages/lab/LabUsersTechniciansPage';
import { LabUsersDoctorsPage } from './pages/lab/LabUsersDoctorsPage';
import { LabWorkOrdersPage } from './pages/lab/LabWorkOrdersPage';
import { TechnicianWorkOrdersPage } from './pages/lab/TechnicianWorkOrdersPage';
import { TechnicianRequestedOrdersPage } from './pages/lab/TechnicianRequestedOrdersPage';
import { LabProcessesPage } from './pages/lab/LabProcessesPage';
import { LabProcessAreasPage } from './pages/lab/LabProcessAreasPage';
import { LabWhatsappTemplatesPage } from './pages/lab/LabWhatsappTemplatesPage';
import { LabDeliveriesPage } from './pages/lab/LabDeliveriesPage';
import { LabProsthesisPage } from './pages/lab/LabProsthesisPage';
import { LabDoctorsPage } from './pages/lab/LabDoctorsPage';
import { LabPaymentMethodsPage } from './pages/lab/LabPaymentMethodsPage';
import { LabSupportPortalPage } from './pages/lab/LabSupportPortalPage';
import { LabBulkUploadPage } from './pages/lab/LabBulkUploadPage';
import { PlatformSupportPortalPage } from './pages/PlatformSupportPortalPage';
import { OnboardingInstructionsPage } from './pages/OnboardingInstructionsPage';
// Clinic Module Pages
import { ClinicStaffPage } from './pages/clinic/ClinicStaffPage';
import { ClinicUsersAdminPage } from './pages/clinic/ClinicUsersAdminPage';
import { ClinicUsersStaffPage } from './pages/clinic/ClinicUsersStaffPage';
import { ClinicUsersDoctorsPage } from './pages/clinic/ClinicUsersDoctorsPage';
import { ClinicPatientsPage } from './pages/clinic/ClinicPatientsPage';
import { ClinicAppointmentsPage } from './pages/clinic/ClinicAppointmentsPage';
import { ClinicWorkingHoursPage } from './pages/clinic/ClinicWorkingHoursPage';
import { ClinicIncomePage } from './pages/clinic/ClinicIncomePage';
import { ClinicTreatmentsPage } from './pages/clinic/ClinicTreatmentsPage';
import { ClinicPrescriptionsPage } from './pages/clinic/ClinicPrescriptionsPage';
import { ClinicBillingPage } from './pages/clinic/ClinicBillingPage';
import { ClinicDoctorsPage } from './pages/clinic/ClinicDoctorsPage';
import { ClinicPaymentMethodsPage } from './pages/clinic/ClinicPaymentMethodsPage';
import './i18n';

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  superAdminOnly?: boolean;
  tenantAdminOnly?: boolean;
  blockClinicDoctor?: boolean;
}> = ({
  children,
  superAdminOnly = false,
  tenantAdminOnly = false,
  blockClinicDoctor = false,
}) => {
  const { user, isTenantAdmin, isClinicDoctor, loading } = useAuth();

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

  if (blockClinicDoctor && isClinicDoctor) {
    return <Navigate to="/clinic/appointments" replace />;
  }

  return <>{children}</>;
};

const FeatureProtectedRoute: React.FC<{
  feature: string;
  children: React.ReactNode;
}> = ({ feature, children }) => {
  const { isClinicDoctor } = useAuth();
  const { activeModuleMode, hasClinicFeature } = useModule();

  // Once logged in, the doctor should have access only to Dashboard (core) and Appointments (clinic)
  if (isClinicDoctor && feature !== 'appointments') {
    return <Navigate to="/clinic/appointments" replace />;
  }

  // If in Clinic mode and feature is not permitted by clinic type, redirect to dashboard
  if (activeModuleMode === 'CLINIC' && !hasClinicFeature(feature)) {
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
                  <Route path="/auth/portal-callback" element={<PortalCallbackPage />} />
                  <Route path="/qr/:qrToken" element={<PublicQrTrackingPage />} />

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
                          <FeatureProtectedRoute feature="finance">
                            <FinancePage />
                          </FeatureProtectedRoute>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="reminders"
                      element={
                        <ProtectedRoute>
                          <FeatureProtectedRoute feature="reminders">
                            <RemindersPage />
                          </FeatureProtectedRoute>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="inventory"
                      element={
                        <ProtectedRoute>
                          <FeatureProtectedRoute feature="inventory">
                            <InventoryPage />
                          </FeatureProtectedRoute>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="expenses"
                      element={
                        <ProtectedRoute>
                          <FeatureProtectedRoute feature="expenses">
                            <ExpensesPage />
                          </FeatureProtectedRoute>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="onboarding"
                      element={
                        <ProtectedRoute blockClinicDoctor>
                          <OnboardingInstructionsPage />
                        </ProtectedRoute>
                      }
                    />

                    {/* Lab Module Routes */}
                    <Route path="lab/onboarding" element={<ProtectedRoute blockClinicDoctor><OnboardingInstructionsPage /></ProtectedRoute>} />
                    <Route path="lab/staff" element={<ProtectedRoute blockClinicDoctor><LabStaffPage /></ProtectedRoute>} />
                    <Route path="lab/users/admin" element={<ProtectedRoute blockClinicDoctor><LabUsersAdminPage /></ProtectedRoute>} />
                    <Route path="lab/users/technicians" element={<ProtectedRoute blockClinicDoctor><LabUsersTechniciansPage /></ProtectedRoute>} />
                    <Route path="lab/users/doctors" element={<ProtectedRoute blockClinicDoctor><LabUsersDoctorsPage /></ProtectedRoute>} />
                    <Route path="lab/work-orders" element={<ProtectedRoute blockClinicDoctor><LabWorkOrdersPage /></ProtectedRoute>} />
                    <Route path="lab/work-orders/my" element={<ProtectedRoute blockClinicDoctor><TechnicianWorkOrdersPage /></ProtectedRoute>} />
                    <Route path="lab/work-orders/requested" element={<ProtectedRoute blockClinicDoctor><TechnicianRequestedOrdersPage /></ProtectedRoute>} />
                    <Route path="lab/processes" element={<ProtectedRoute blockClinicDoctor><LabProcessesPage /></ProtectedRoute>} />
                    <Route path="lab/process-areas" element={<ProtectedRoute blockClinicDoctor><LabProcessAreasPage /></ProtectedRoute>} />
                    <Route path="lab/prosthesis-types" element={<ProtectedRoute blockClinicDoctor><LabProsthesisPage /></ProtectedRoute>} />
                    <Route path="lab/payment-methods" element={<ProtectedRoute blockClinicDoctor><LabPaymentMethodsPage /></ProtectedRoute>} />
                    <Route path="lab/whatsapp-templates" element={<ProtectedRoute blockClinicDoctor><LabWhatsappTemplatesPage /></ProtectedRoute>} />
                    <Route path="lab/deliveries" element={<ProtectedRoute blockClinicDoctor><LabDeliveriesPage /></ProtectedRoute>} />
                    <Route path="lab/doctors" element={<ProtectedRoute blockClinicDoctor><LabDoctorsPage /></ProtectedRoute>} />
                    <Route path="lab/bulk-upload" element={<ProtectedRoute blockClinicDoctor><LabBulkUploadPage /></ProtectedRoute>} />
                    <Route path="lab/support" element={<ProtectedRoute blockClinicDoctor><LabSupportPortalPage /></ProtectedRoute>} />

                    {/* Clinic Module Routes */}
                    <Route path="clinic/staff" element={<ProtectedRoute><FeatureProtectedRoute feature="clinic_users"><ClinicStaffPage /></FeatureProtectedRoute></ProtectedRoute>} />
                    <Route path="clinic/users/admin" element={<ProtectedRoute><FeatureProtectedRoute feature="clinic_users"><ClinicUsersAdminPage /></FeatureProtectedRoute></ProtectedRoute>} />
                    <Route path="clinic/users/staff" element={<ProtectedRoute><FeatureProtectedRoute feature="clinic_users"><ClinicUsersStaffPage /></FeatureProtectedRoute></ProtectedRoute>} />
                    <Route path="clinic/users/doctors" element={<ProtectedRoute><FeatureProtectedRoute feature="clinic_users"><ClinicUsersDoctorsPage /></FeatureProtectedRoute></ProtectedRoute>} />
                    <Route path="clinic/patients" element={<ProtectedRoute><FeatureProtectedRoute feature="patients"><ClinicPatientsPage /></FeatureProtectedRoute></ProtectedRoute>} />
                    <Route path="clinic/appointments" element={<ProtectedRoute><FeatureProtectedRoute feature="appointments"><ClinicAppointmentsPage /></FeatureProtectedRoute></ProtectedRoute>} />
                    <Route path="clinic/appointments/working-hours" element={<ProtectedRoute><FeatureProtectedRoute feature="appointments"><ClinicWorkingHoursPage /></FeatureProtectedRoute></ProtectedRoute>} />
                    <Route path="clinic/income" element={<ProtectedRoute><FeatureProtectedRoute feature="income"><ClinicIncomePage /></FeatureProtectedRoute></ProtectedRoute>} />
                    <Route path="clinic/treatments" element={<ProtectedRoute><FeatureProtectedRoute feature="treatments"><ClinicTreatmentsPage /></FeatureProtectedRoute></ProtectedRoute>} />
                    <Route path="clinic/prescriptions" element={<ProtectedRoute><FeatureProtectedRoute feature="prescriptions"><ClinicPrescriptionsPage /></FeatureProtectedRoute></ProtectedRoute>} />
                    <Route path="clinic/billing" element={<ProtectedRoute><FeatureProtectedRoute feature="billing"><ClinicBillingPage /></FeatureProtectedRoute></ProtectedRoute>} />
                    <Route path="clinic/doctors" element={<ProtectedRoute><FeatureProtectedRoute feature="clinic_users"><ClinicUsersDoctorsPage /></FeatureProtectedRoute></ProtectedRoute>} />
                    <Route path="clinic/payment-methods" element={<ProtectedRoute blockClinicDoctor><ClinicPaymentMethodsPage /></ProtectedRoute>} />

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
                    <Route
                      path="qr-inquiries"
                      element={
                        <ProtectedRoute superAdminOnly>
                          <QrInquiriesPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="support-portal"
                      element={
                        <ProtectedRoute superAdminOnly>
                          <PlatformSupportPortalPage />
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
