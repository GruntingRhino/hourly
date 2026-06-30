import { lazy, Suspense, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import SessionPrefBanner from "./components/SessionPrefBanner";
import { getSessionPref } from "./lib/authSession";
import { ToastProvider } from "./components/Toast";

const Landing = lazy(() => import("./pages/Landing"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const EmailVerificationRequired = lazy(() => import("./pages/EmailVerificationRequired"));
const ParentProgress = lazy(() => import("./pages/ParentProgress"));
const JoinCohort = lazy(() => import("./pages/student/JoinCohort"));
const JoinBeneficiary = lazy(() => import("./pages/beneficiary/JoinBeneficiary"));
const SchoolRegister = lazy(() => import("./pages/school/Register"));
const SchoolVerifyRegistration = lazy(() => import("./pages/school/VerifyRegistration"));
const SchoolConfirmTransfer = lazy(() => import("./pages/school/ConfirmTransfer"));
const StudentDashboard = lazy(() => import("./pages/student/Dashboard"));
const StudentBrowse = lazy(() => import("./pages/student/Browse"));
const OpportunityDetail = lazy(() => import("./pages/student/OpportunityDetail"));
const SlotDetail = lazy(() => import("./pages/student/SlotDetail"));
const StudentMessages = lazy(() => import("./pages/student/Messages"));
const StudentSettings = lazy(() => import("./pages/student/Settings"));
const StudentSelfSubmit = lazy(() => import("./pages/student/SelfSubmit"));
const SchoolDashboard = lazy(() => import("./pages/school/Dashboard"));
const StudentList = lazy(() => import("./pages/school/StudentList"));
const SchoolGroups = lazy(() => import("./pages/school/Groups"));
const SchoolCohorts = lazy(() => import("./pages/school/Cohorts"));
const CohortDetail = lazy(() => import("./pages/school/CohortDetail"));
const SchoolBeneficiaries = lazy(() => import("./pages/school/Beneficiaries"));
const BeneficiaryDiscover = lazy(() => import("./pages/school/Discover"));
const SchoolOpportunities = lazy(() => import("./pages/school/SchoolOpportunities"));
const SchoolSelfSubmissions = lazy(() => import("./pages/school/SelfSubmissions"));
const SchoolMessages = lazy(() => import("./pages/school/Messages"));
const SchoolSettings = lazy(() => import("./pages/school/Settings"));
const SchoolOnboarding = lazy(() => import("./pages/school/Onboarding"));
const LaunchCenter = lazy(() => import("./pages/school/LaunchCenter"));
const ImpersonatePage = lazy(() => import("./pages/admin/Impersonate"));
const BeneficiaryDashboard = lazy(() => import("./pages/beneficiary/Dashboard"));
const BeneficiaryOpportunities = lazy(() => import("./pages/beneficiary/Opportunities"));
const BeneficiarySettings = lazy(() => import("./pages/beneficiary/Settings"));
const OrgMessages = lazy(() => import("./pages/organization/Messages"));

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
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-[var(--text-sec)] text-lg">Loading...</div>
        </div>
      }
    >
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
              <Route path="/groups" element={<SchoolGroups />} />
              <Route path="/cohorts" element={<SchoolCohorts />} />
              <Route path="/cohorts/:id" element={<CohortDetail />} />
              <Route path="/cohorts/:id/on-track" element={<StudentList />} />
              <Route path="/cohorts/:id/off-track" element={<StudentList />} />
              {isSchoolAdminLike && (
                <>
                  <Route path="/beneficiaries" element={<SchoolBeneficiaries />} />
                  <Route path="/partners" element={<SchoolBeneficiaries />} />
                  <Route path="/discover" element={<BeneficiaryDiscover />} />
                  <Route path="/opportunities" element={<SchoolOpportunities />} />
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
    </Suspense>
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
