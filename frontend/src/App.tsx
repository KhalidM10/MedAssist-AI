import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { WebSocketProvider } from './contexts/WebSocketContext'
import { NotificationToast } from './components/ui/NotificationToast'
import { InstallPrompt } from './components/pwa/InstallPrompt'
import { AppLayout } from './components/layout/AppLayout'
import { ClinicLayout } from './components/clinic/ClinicLayout'
import { AdminLayout } from './components/admin/AdminLayout'
import { useAuthStore } from './store/auth'
import { CLINIC_ROLES } from './types'

// ── Lazy page imports ──────────────────────────────────────────────────────────
const LandingPage              = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })))
const DashboardPage            = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const LoginPage                = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })))
const RegisterPage             = lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })))
const ClinicRegisterPage       = lazy(() => import('./pages/ClinicRegisterPage').then(m => ({ default: m.ClinicRegisterPage })))
const TriagePage               = lazy(() => import('./pages/TriagePage').then(m => ({ default: m.TriagePage })))
const ClinicsPage              = lazy(() => import('./pages/ClinicsPage').then(m => ({ default: m.ClinicsPage })))
const ClinicProfilePage        = lazy(() => import('./pages/ClinicProfilePage').then(m => ({ default: m.ClinicProfilePage })))
const BookingFlow              = lazy(() => import('./pages/BookingFlow').then(m => ({ default: m.BookingFlow })))
const AppointmentsPage         = lazy(() => import('./pages/AppointmentsPage').then(m => ({ default: m.AppointmentsPage })))
const MedicineOrderPage        = lazy(() => import('./pages/MedicineOrderPage').then(m => ({ default: m.MedicineOrderPage })))
const HealthProfilePage        = lazy(() => import('./pages/HealthProfilePage').then(m => ({ default: m.HealthProfilePage })))
const NotificationsPage        = lazy(() => import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })))
const SessionsPage             = lazy(() => import('./pages/SessionsPage').then(m => ({ default: m.SessionsPage })))
const ForgotPasswordPage       = lazy(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })))
const ClinicLoginPage          = lazy(() => import('./pages/ClinicLoginPage').then(m => ({ default: m.ClinicLoginPage })))

// Admin pages
const AdminOverviewPage        = lazy(() => import('./pages/admin/AdminOverviewPage').then(m => ({ default: m.AdminOverviewPage })))
const AdminClinicsPage         = lazy(() => import('./pages/admin/AdminClinicsPage').then(m => ({ default: m.AdminClinicsPage })))
const AdminClinicReviewPage    = lazy(() => import('./pages/admin/AdminClinicReviewPage').then(m => ({ default: m.AdminClinicReviewPage })))
const AdminUsersPage           = lazy(() => import('./pages/admin/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })))
const AdminAuditPage           = lazy(() => import('./pages/admin/AdminAuditPage').then(m => ({ default: m.AdminAuditPage })))
const AdminTriagePage          = lazy(() => import('./pages/admin/AdminTriagePage').then(m => ({ default: m.AdminTriagePage })))
const AdminSystemPage          = lazy(() => import('./pages/admin/AdminSystemPage').then(m => ({ default: m.AdminSystemPage })))
const AdminFinancialPage       = lazy(() => import('./pages/admin/AdminFinancialPage').then(m => ({ default: m.AdminFinancialPage })))
const AdminSettingsPage        = lazy(() => import('./pages/admin/AdminSettingsPage').then(m => ({ default: m.AdminSettingsPage })))
const AdminChangeRequestsPage  = lazy(() => import('./pages/admin/AdminChangeRequestsPage').then(m => ({ default: m.AdminChangeRequestsPage })))

// Clinic portal pages
const ClinicOverviewPage       = lazy(() => import('./pages/clinic/ClinicOverviewPage').then(m => ({ default: m.ClinicOverviewPage })))
const ClinicAppointmentsPage   = lazy(() => import('./pages/clinic/ClinicAppointmentsPage').then(m => ({ default: m.ClinicAppointmentsPage })))
const ClinicAnalyticsPage      = lazy(() => import('./pages/clinic/ClinicAnalyticsPage').then(m => ({ default: m.ClinicAnalyticsPage })))
const ClinicSubscriptionPage   = lazy(() => import('./pages/clinic/ClinicSubscriptionPage').then(m => ({ default: m.ClinicSubscriptionPage })))
const ClinicAuditPage          = lazy(() => import('./pages/clinic/ClinicAuditPage').then(m => ({ default: m.ClinicAuditPage })))
const ClinicDoctorsPage        = lazy(() => import('./pages/clinic/ClinicDoctorsPage').then(m => ({ default: m.ClinicDoctorsPage })))
const ClinicPatientsPage       = lazy(() => import('./pages/clinic/ClinicPatientsPage').then(m => ({ default: m.ClinicPatientsPage })))
const ClinicOrdersPage         = lazy(() => import('./pages/clinic/ClinicOrdersPage').then(m => ({ default: m.ClinicOrdersPage })))
const ClinicProductsPage       = lazy(() => import('./pages/clinic/ClinicProductsPage').then(m => ({ default: m.ClinicProductsPage })))
const ClinicReviewsPage        = lazy(() => import('./pages/clinic/ClinicReviewsPage').then(m => ({ default: m.ClinicReviewsPage })))
const ClinicSettingsPage       = lazy(() => import('./pages/clinic/ClinicSettingsPage').then(m => ({ default: m.ClinicSettingsPage })))

// ── Skeleton fallback ──────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded-xl" />
      <div className="h-4 w-64 bg-gray-100 rounded-lg" />
      <div className="grid grid-cols-2 gap-4 mt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-gray-100 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

// ── Route guards ───────────────────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <>{children}</>
  if (user?.role === 'super_admin') return <Navigate to="/admin" replace />
  if (user && CLINIC_ROLES.includes(user.role)) return <Navigate to="/clinic-dashboard" replace />
  return <Navigate to="/dashboard" replace />
}

function ClinicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user || !CLINIC_ROLES.includes(user.role)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user || user.role !== 'super_admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function PatientOrClinicRedirect() {
  const { user } = useAuthStore()
  if (user?.role === 'super_admin') return <Navigate to="/admin" replace />
  if (user && CLINIC_ROLES.includes(user.role)) return <Navigate to="/clinic-dashboard" replace />
  return <DashboardPage />
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <WebSocketProvider>
      <NotificationToast />
      <InstallPrompt />
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          {/* Public */}
          <Route path="/"                  element={<LandingPage />} />
          <Route path="/login"             element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/clinic-login"      element={<GuestRoute><ClinicLoginPage /></GuestRoute>} />
          <Route path="/register"          element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route path="/register/clinic"   element={<ClinicRegisterPage />} />
          <Route path="/forgot-password"   element={<ForgotPasswordPage />} />

          {/* Super admin console — super_admin only */}
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index                          element={<AdminOverviewPage />} />
            <Route path="clinics"                 element={<AdminClinicsPage />} />
            <Route path="clinics/:id/review"      element={<AdminClinicReviewPage />} />
            <Route path="change-requests"         element={<AdminChangeRequestsPage />} />
            <Route path="users"                   element={<AdminUsersPage />} />
            <Route path="audit"                   element={<AdminAuditPage />} />
            <Route path="triage"                  element={<AdminTriagePage />} />
            <Route path="system"                  element={<AdminSystemPage />} />
            <Route path="financial"               element={<AdminFinancialPage />} />
            <Route path="settings"                element={<AdminSettingsPage />} />
          </Route>

          {/* Clinic portal — all clinic staff roles */}
          <Route path="/clinic-dashboard" element={<ClinicRoute><ClinicLayout /></ClinicRoute>}>
            <Route index               element={<ClinicOverviewPage />} />
            <Route path="appointments" element={<ClinicAppointmentsPage />} />
            <Route path="patients"     element={<ClinicPatientsPage />} />
            <Route path="doctors"      element={<ClinicDoctorsPage />} />
            <Route path="orders"       element={<ClinicOrdersPage />} />
            <Route path="products"     element={<ClinicProductsPage />} />
            <Route path="analytics"    element={<ClinicAnalyticsPage />} />
            <Route path="reviews"      element={<ClinicReviewsPage />} />
            <Route path="audit"        element={<ClinicAuditPage />} />
            <Route path="subscription" element={<ClinicSubscriptionPage />} />
            <Route path="settings"     element={<ClinicSettingsPage />} />
          </Route>

          {/* Protected patient app shell */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Routes>
                    <Route path="/dashboard"        element={<PatientOrClinicRedirect />} />
                    <Route path="/triage"           element={<TriagePage />} />
                    <Route path="/clinics"          element={<ClinicsPage />} />
                    <Route path="/clinics/:id"      element={<ClinicProfilePage />} />
                    <Route path="/book/:clinicId"   element={<BookingFlow />} />
                    <Route path="/appointments"     element={<AppointmentsPage />} />
                    <Route path="/appointments/new" element={<Navigate to="/clinics" replace />} />
                    <Route path="/medicines"        element={<MedicineOrderPage />} />
                    <Route path="/profile"          element={<HealthProfilePage />} />
                    <Route path="/notifications"    element={<NotificationsPage />} />
                    <Route path="/sessions"         element={<SessionsPage />} />
                    <Route path="*"                 element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </AppLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </WebSocketProvider>
  )
}
