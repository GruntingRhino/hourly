import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold italic">GoodHours</h1>
          <div className="flex gap-3">
            <Link
              to="/login"
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50"
            >
              Sign In
            </Link>
            <Link
              to="/school/register"
              className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800"
            >
              Register School
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="py-20 text-center border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              The Trusted System of Record for Student Volunteer Hours
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              GoodHours is school-first — giving administrators the tools to manage cohorts,
              approve community partners, and verify student service hours with confidence.
            </p>
            <Link
              to="/school/register"
              className="inline-block px-8 py-3 bg-gray-900 text-white rounded-md text-lg font-medium hover:bg-gray-800"
            >
              Register Your School
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-center mb-10">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center text-lg font-bold mx-auto mb-4">1</div>
                <h3 className="font-semibold mb-2">School Registers</h3>
                <p className="text-sm text-gray-600">
                  School admins sign in with Google and register using their school's official email. Your school becomes the trusted anchor.
                </p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center text-lg font-bold mx-auto mb-4">2</div>
                <h3 className="font-semibold mb-2">Invite Students & Partners</h3>
                <p className="text-sm text-gray-600">
                  Create cohorts, import your student roster, and invite approved community service organizations. Everything flows through school approval.
                </p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center text-lg font-bold mx-auto mb-4">3</div>
                <h3 className="font-semibold mb-2">Track & Verify</h3>
                <p className="text-sm text-gray-600">
                  Students sign up for opportunities, complete service, and hours are verified through a structured audit trail you control.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Value props */}
        <section className="py-16 border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-3 gap-8">
            <div className="border border-gray-200 rounded-lg p-8">
              <h3 className="text-xl font-bold mb-3">For Schools</h3>
              <ul className="text-gray-600 space-y-2 text-sm">
                <li>• School-first registration with Google Sign-In</li>
                <li>• Create cohorts and import student rosters via CSV</li>
                <li>• Approve community service partners (Beneficiaries)</li>
                <li>• Full audit trail for all verification actions</li>
                <li>• Review student self-submitted volunteering requests</li>
              </ul>
            </div>
            <div className="border border-gray-200 rounded-lg p-8">
              <h3 className="text-xl font-bold mb-3">For Students</h3>
              <ul className="text-gray-600 space-y-2 text-sm">
                <li>• Invited directly by your school cohort</li>
                <li>• Browse only school-approved opportunities</li>
                <li>• Sign up for time slots with calendar view</li>
                <li>• Track progress toward graduation requirement</li>
                <li>• Submit self-selected volunteering for review</li>
              </ul>
            </div>
            <div className="border border-gray-200 rounded-lg p-8">
              <h3 className="text-xl font-bold mb-3">For Community Partners</h3>
              <ul className="text-gray-600 space-y-2 text-sm">
                <li>• Invited by partnering schools</li>
                <li>• Create calendar-based volunteer opportunities</li>
                <li>• Manage student signups and attendance</li>
                <li>• Approve or reject hours with audit logging</li>
                <li>• Student details revealed only after attendance</li>
              </ul>
            </div>
          </div>
        </section>

        {/* School CTA */}
        <section className="py-16">
          <div className="max-w-xl mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-gray-600 mb-8">
              GoodHours is free for schools. Register your school with Google Sign-In — students and community partners join through invitation only.
            </p>
            <Link
              to="/school/register"
              className="inline-flex items-center gap-3 px-6 py-3 bg-white border-2 border-gray-300 rounded-md font-medium hover:bg-gray-50 text-gray-800"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign In with Google to Register
            </Link>
            <p className="mt-4 text-sm text-gray-500">
              Already registered?{" "}
              <Link to="/login" className="text-blue-600 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </main>

      <footer className="py-8 bg-gray-50 border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-500">
            © {new Date().getFullYear()} GoodHours. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm">
            <a href="#" className="text-gray-500 hover:text-gray-800">Help & Support</a>
            <a href="#" className="text-gray-500 hover:text-gray-800">Terms of Service</a>
            <a href="#" className="text-gray-500 hover:text-gray-800">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
