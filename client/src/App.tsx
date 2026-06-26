import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import SessionPrefBanner from "./components/SessionPrefBanner";
import { getSessionPref } from "./lib/authSession";
import { ToastProvider } from "./components/Toast";

// Public pages
import Landing from "./pages/Landing";
import FAQ from "./pages/FAQ";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import EmailVerificationRequired from "./pages/EmailVerificationRequired";
import ParentProgress from "./pages/ParentProgress";

// Invitation / onboarding flows (public, no auth required)
import JoinCohort from "./pages/student/JoinCohort";
import JoinBeneficiary from "./pages/beneficiary/JoinBeneficiary";
import SchoolRegister from "./pages/school/Register";
import SchoolVerifyRegistration from "./pages/school/VerifyRegistration";
import SchoolConfirmTransfer from "./pages/school/ConfirmTransfer";

// Student pages
import StudentDashboard from "./pages/student/Dashboard";
import StudentBrowse from "./pages/student/Browse";
import OpportunityDetail from "./pages/student/OpportunityDetail";
import SlotDetail from "./pages/student/SlotDetail";
import StudentMessages from "./pages/student/Messages";
import StudentSettings from "./pages/student/Settings";
import StudentSelfSubmit from "./pages/student/SelfSubmit";

// School pages
import SchoolDashboard from "./pages/school/Dashboard";
import StudentList from "./pages/school/StudentList";
import SchoolCohorts from "./pages/school/Cohorts";
import CohortDetail from "./pages/school/CohortDetail";
import SchoolBeneficiaries from "./pages/school/Beneficiaries";
import BeneficiaryDiscover from "./pages/school/Discover";
import SchoolSelfSubmissions from "./pages/school/SelfSubmissions";
import SchoolMessages from "./pages/school/Messages";
import SchoolSettings from "./pages/school/Settings";
import SchoolOnboarding from "./pages/school/Onboarding";
import LaunchCenter from "./pages/school/LaunchCenter";

// Admin pages
import ImpersonatePage from "./pages/admin/Impersonate";

// Beneficiary pages
import BeneficiaryDashboard from "./pages/beneficiary/Dashboard";
import BeneficiaryOpportunities from "./pages/beneficiary/Opportunities";
import BeneficiarySettings from "./pages/beneficiary/Settings";
import OrgMessages from "./pages/organization/Messages";

const SCHOOL_ROLES = ["SCHOOL_ADMIN", "TEACHER"];

function AppRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [showPrefBanner, setShowPrefBanner] = useState(() => getSessionPref() === null);
  const isSchoolAdminLike = user?.role === "SCHOOL_ADMIN";
  const needsSchoolOnboarding =
    isSchoolAdminLike && user.school?.onboardingComplete === false;
  const suppressPrefBanner = location.pathname === "/settings";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-sec)] text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className={user && showPrefBanner && !suppressPrefBanner ? "pb-40 sm:pb-32" : undefined}>
    <Routes>
      {/* Public routes — always accessible */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/school/register" element={<SchoolRegister />} />
      <Route path="/school/verify-registration" element={<SchoolVerifyRegistration />} />
      <Route path="/school/confirm-transfer" element={<SchoolConfirmTransfer />} />
      <Route path="/join/student" element={<JoinCohort />} />
      <Route path="/join/beneficiary" element={<JoinBeneficiary />} />
      <Route path="/parent-progress" element={<ParentProgress />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />

      {user ? (
        <>
        {/* Email verification gate — accessible when logged in but unverified */}
        <Route path="/email-verification-required" element={<EmailVerificationRequired />} />

        {/* Authenticated: routes wrapped in Layout (uses <Outlet />) */}
        <Route element={<Layout />}>
          {/* Student routes */}
          {user.role === "STUDENT" && (
            <>
              <Route path="/dashboard" element={<StudentDashboard />} />
              <Route path="/browse" element={<StudentBrowse />} />
              <Route path="/opportunity/:id" element={<OpportunityDetail />} />
              <Route path="/slot/:id" element={<SlotDetail />} />
              <Route path="/submit" element={<StudentSelfSubmit />} />
              <Route path="/messages" element={<StudentMessages />} />
              <Route path="/settings" element={<StudentSettings />} />
            </>
          )}

              {/* School routes */}
          {SCHOOL_ROLES.includes(user.role) && (
            <>
              <Route path="/dashboard" element={needsSchoolOnboarding ? <Navigate to="/onboarding" replace /> : <SchoolDashboard />} />
              <Route path="/onboarding" element={isSchoolAdminLike ? <SchoolOnboarding /> : <Navigate to="/dashboard" replace />} />
              <Route path="/students" element={<StudentList />} />
              <Route path="/students/on-track" element={<StudentList />} />
              <Route path="/students/off-track" element={<StudentList />} />
              <Route path="/cohorts" element={<SchoolCohorts />} />
              <Route path="/cohorts/:id" element={<CohortDetail />} />
              <Route path="/cohorts/:id/on-track" element={<StudentList />} />
              <Route path="/cohorts/:id/off-track" element={<StudentList />} />
              {isSchoolAdminLike && (
                <>
                  <Route path="/beneficiaries" element={<SchoolBeneficiaries />} />
                  <Route path="/partners" element={<SchoolBeneficiaries />} />
                  <Route path="/discover" element={<BeneficiaryDiscover />} />
                </>
              )}
              <Route path="/submissions" element={<SchoolSelfSubmissions />} />
              {isSchoolAdminLike && <Route path="/launch" element={<LaunchCenter />} />}
              <Route path="/messages" element={<SchoolMessages />} />
              <Route path="/settings" element={<SchoolSettings />} />
              {isSchoolAdminLike && <Route path="/admin/impersonate" element={<ImpersonatePage />} />}
            </>
          )}

          {/* Beneficiary admin routes */}
          {user.role === "BENEFICIARY_ADMIN" && (
            <>
              <Route path="/dashboard" element={<BeneficiaryDashboard />} />
              <Route path="/opportunities" element={<BeneficiaryOpportunities />} />
              <Route path="/messages" element={<OrgMessages />} />
              <Route path="/settings" element={<BeneficiarySettings />} />
            </>
          )}

          {/* Legacy ORG_ADMIN — redirect to a graceful message */}
          {user.role === "ORG_ADMIN" && (
            <Route path="*" element={
              <div className="text-center py-16">
                <h2 className="text-xl font-semibold text-[var(--text)] mb-2">Account Upgrade Required</h2>
                <p className="text-[var(--text-sec)] text-sm max-w-sm mx-auto">
                  Your account type has been updated. Please contact support or sign up again as a Beneficiary Admin.
                </p>
              </div>
            } />
          )}

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
        </>
      ) : (
        /* Not authenticated: redirect unknown paths to home */
        <Route path="*" element={<Navigate to="/" replace />} />
      )}
    </Routes>
    {user && showPrefBanner && !suppressPrefBanner && (
      <SessionPrefBanner onDismiss={() => setShowPrefBanner(false)} />
    )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
