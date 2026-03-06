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
import StudentList from "./pages/school/StudentList";
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

  return (
    <Routes>
      {/* Public routes — always accessible */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/school/register" element={<SchoolRegister />} />
      <Route path="/school/verify-registration" element={<SchoolVerifyRegistration />} />
      <Route path="/join/student" element={<JoinCohort />} />
      <Route path="/join/beneficiary" element={<JoinBeneficiary />} />

      {user ? (
        /* Authenticated: routes wrapped in Layout (uses <Outlet />) */
        <Route element={<Layout />}>
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

          {/* School routes */}
          {SCHOOL_ROLES.includes(user.role) && (
            <>
              <Route path="/dashboard" element={<SchoolDashboard />} />
              <Route path="/students" element={<StudentList />} />
              <Route path="/students/on-track" element={<StudentList />} />
              <Route path="/students/off-track" element={<StudentList />} />
              <Route path="/cohorts" element={<SchoolCohorts />} />
              <Route path="/cohorts/:id" element={<CohortDetail />} />
              <Route path="/cohorts/:id/on-track" element={<StudentList />} />
              <Route path="/cohorts/:id/off-track" element={<StudentList />} />
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

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      ) : (
        /* Not authenticated: redirect unknown paths to home */
        <Route path="*" element={<Navigate to="/" replace />} />
      )}
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
