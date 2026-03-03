import { Link } from "react-router-dom";

// Public student/beneficiary signup is disabled.
// Students enroll via cohort invitation link.
// Beneficiaries register via school invitation link.
// Schools register via /school/register (Google OAuth flow).
export default function Signup() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center">
        <Link to="/" className="block text-2xl font-bold italic mb-8">GoodHours</Link>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4">How to Join GoodHours</h2>
          <div className="space-y-4 text-sm text-left">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-md">
              <div className="font-semibold text-blue-800 mb-1">I'm a School Administrator</div>
              <div className="text-blue-700">Register your school using Google Sign-In. You'll need access to your school's official email to complete verification.</div>
              <Link to="/school/register" className="mt-2 inline-block text-blue-600 font-medium hover:underline">
                Register My School →
              </Link>
            </div>
            <div className="p-3 bg-green-50 border border-green-100 rounded-md">
              <div className="font-semibold text-green-800 mb-1">I'm a Student</div>
              <div className="text-green-700">Students join via invitation email from their school. Check your email for a GoodHours invitation link.</div>
            </div>
            <div className="p-3 bg-purple-50 border border-purple-100 rounded-md">
              <div className="font-semibold text-purple-800 mb-1">I'm a Community Organization</div>
              <div className="text-purple-700">Organizations (Beneficiaries) are invited by partnering schools. Contact a school administrator to request partnership.</div>
            </div>
          </div>
          <p className="mt-6 text-sm text-gray-500">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-600 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
