import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";

// Public pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

// Invitation / onboarding flows (public, no auth required)
import JoinCohort from "./pages/student/JoinCohort";
import JoinBeneficiary from "./pages/beneficiary/JoinBeneficiary";
import SchoolRegister from "./pages/school/Register";
import SchoolVerifyRegistration from "./pages/school/VerifyRegistration";

// Student pages
import StudentDashboard from "./pages/student/Dashboard";
import StudentBrowse from "./pages/student/Browse";
import OpportunityDetail from "./pages/student/OpportunityDetail";
import StudentMessages from "./pages/student/Messages";
import StudentSettings from "./pages/student/Settings";
import StudentSelfSubmit from "./pages/student/SelfSubmit";

// School pages
import SchoolDashboard from "./pages/school/Dashboard";
import SchoolCohorts from "./pages/school/Cohorts";
import CohortDetail from "./pages/school/CohortDetail";
import SchoolBeneficiaries from "./pages/school/Beneficiaries";
import SchoolSelfSubmissions from "./pages/school/SelfSubmissions";
import SchoolMessages from "./pages/school/Messages";
import SchoolSettings from "./pages/school/Settings";

// Beneficiary pages
import BeneficiaryDashboard from "./pages/beneficiary/Dashboard";
import BeneficiaryOpportunities from "./pages/beneficiary/Opportunities";

const SCHOOL_ROLES = ["SCHOOL_ADMIN", "TEACHER", "DISTRICT_ADMIN"];

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 text-lg">Loading...</div>
      </div>
    );
  }

  // Public routes — always accessible (invitation flows, school registration)
  const publicRoutes = (
    <>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/school/register" element={<SchoolRegister />} />
      <Route path="/school/verify-registration" element={<SchoolVerifyRegistration />} />
      <Route path="/join/student" element={<JoinCohort />} />
      <Route path="/join/beneficiary" element={<JoinBeneficiary />} />
    </>
  );

  if (!user) {
    return (
      <Routes>
        {publicRoutes}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Public routes remain accessible even when logged in */}
      <Route path="/school/register" element={<SchoolRegister />} />
      <Route path="/school/verify-registration" element={<SchoolVerifyRegistration />} />
      <Route path="/join/student" element={<JoinCohort />} />
      <Route path="/join/beneficiary" element={<JoinBeneficiary />} />

      {/* Authenticated app */}
      <Route path="*" element={
        <Layout>
          <Routes>
            {/* Student routes */}
            {user.role === "STUDENT" && (
              <>
                <Route path="/dashboard" element={<StudentDashboard />} />
                <Route path="/browse" element={<StudentBrowse />} />
                <Route path="/opportunity/:id" element={<OpportunityDetail />} />
                <Route path="/submit" element={<StudentSelfSubmit />} />
                <Route path="/messages" element={<StudentMessages />} />
                <Route path="/settings" element={<StudentSettings />} />
              </>
            )}

            {/* School routes (SCHOOL_ADMIN, TEACHER, DISTRICT_ADMIN) */}
            {SCHOOL_ROLES.includes(user.role) && (
              <>
                <Route path="/dashboard" element={<SchoolDashboard />} />
                <Route path="/cohorts" element={<SchoolCohorts />} />
                <Route path="/cohorts/:id" element={<CohortDetail />} />
                <Route path="/beneficiaries" element={<SchoolBeneficiaries />} />
                <Route path="/submissions" element={<SchoolSelfSubmissions />} />
                <Route path="/messages" element={<SchoolMessages />} />
                <Route path="/settings" element={<SchoolSettings />} />
              </>
            )}

            {/* Beneficiary admin routes */}
            {user.role === "BENEFICIARY_ADMIN" && (
              <>
                <Route path="/dashboard" element={<BeneficiaryDashboard />} />
                <Route path="/opportunities" element={<BeneficiaryOpportunities />} />
                <Route path="/settings" element={<StudentSettings />} />
              </>
            )}

            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Layout>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
