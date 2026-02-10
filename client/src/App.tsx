import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import StudentDashboard from "./pages/student/Dashboard";
import StudentBrowse from "./pages/student/Browse";
import OpportunityDetail from "./pages/student/OpportunityDetail";
import StudentMessages from "./pages/student/Messages";
import StudentSettings from "./pages/student/Settings";
import OrgDashboard from "./pages/organization/Dashboard";
import OrgOpportunities from "./pages/organization/Opportunities";
import CreateOpportunity from "./pages/organization/CreateOpportunity";
import OrgMessages from "./pages/organization/Messages";
import OrgSettings from "./pages/organization/Settings";
import SchoolDashboard from "./pages/school/Dashboard";
import SchoolGroups from "./pages/school/Groups";
import SchoolMessages from "./pages/school/Messages";
import SchoolSettings from "./pages/school/Settings";

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        {/* Student routes */}
        {user.role === "STUDENT" && (
          <>
            <Route path="/dashboard" element={<StudentDashboard />} />
            <Route path="/browse" element={<StudentBrowse />} />
            <Route path="/opportunity/:id" element={<OpportunityDetail />} />
            <Route path="/messages" element={<StudentMessages />} />
            <Route path="/settings" element={<StudentSettings />} />
          </>
        )}

        {/* Organization routes */}
        {user.role === "ORGANIZATION" && (
          <>
            <Route path="/dashboard" element={<OrgDashboard />} />
            <Route path="/opportunities" element={<OrgOpportunities />} />
            <Route path="/opportunities/new" element={<CreateOpportunity />} />
            <Route path="/messages" element={<OrgMessages />} />
            <Route path="/settings" element={<OrgSettings />} />
          </>
        )}

        {/* School routes */}
        {user.role === "SCHOOL" && (
          <>
            <Route path="/dashboard" element={<SchoolDashboard />} />
            <Route path="/groups" element={<SchoolGroups />} />
            <Route path="/messages" element={<SchoolMessages />} />
            <Route path="/settings" element={<SchoolSettings />} />
          </>
        )}

        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Layout>
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
