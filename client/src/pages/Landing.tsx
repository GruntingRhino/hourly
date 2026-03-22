import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <img src="/logo-full.png" alt="GoodHours" className="h-9 w-auto"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display="none"; }} />
          <div className="flex gap-3">
            <Link to="/login"
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Sign In
            </Link>
            <Link to="/school/register"
              className="px-4 py-2 bg-blue-700 text-white rounded-md text-sm font-medium hover:bg-blue-800 transition-colors">
              Register School
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="py-20 text-center bg-gradient-to-b from-blue-50 to-white border-b border-gray-100">
          <div className="max-w-3xl mx-auto px-4">
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
              School-first community service tracking
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-5 text-gray-900 leading-tight">
              The Trusted System of Record for Student Volunteer Hours
            </h2>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              GoodHours gives administrators the tools to manage cohorts,
              approve community partners, and verify student service hours with confidence.
            </p>
            <Link to="/school/register"
              className="inline-block px-8 py-3.5 bg-blue-700 text-white rounded-lg text-base font-semibold hover:bg-blue-800 transition-colors shadow-sm">
              Register Your School — Free
            </Link>
            <p className="mt-4 text-sm text-gray-400">Students and partners join by invitation only</p>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-center mb-3 text-gray-900">How It Works</h2>
            <p className="text-center text-gray-500 text-sm mb-10">Three steps from registration to verified hours</p>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { n: "1", title: "School Registers", body: "School admins sign in with Google and register using their school's official email. Your school becomes the trusted anchor for everything else." },
                { n: "2", title: "Invite Students & Partners", body: "Create cohorts, import your student roster, and invite approved community service organizations. Everything flows through school approval." },
                { n: "3", title: "Track & Verify", body: "Students sign up for opportunities, complete service, and hours are verified through a structured audit trail you control." },
              ].map(({ n, title, body }) => (
                <div key={n} className="text-center">
                  <div className="w-11 h-11 rounded-full bg-blue-700 text-white flex items-center justify-center text-lg font-bold mx-auto mb-4 shadow-sm">
                    {n}
                  </div>
                  <h3 className="font-semibold mb-2 text-gray-900">{title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Value props */}
        <section className="py-16 border-b border-gray-100 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-3 gap-6">
            {[
              {
                title: "For Schools",
                accent: "blue",
                items: [
                  "School-first registration with Google Sign-In",
                  "Create cohorts and import student rosters via CSV",
                  "Approve community service partners",
                  "Full audit trail for all verification actions",
                  "Review student self-submitted volunteering requests",
                ],
              },
              {
                title: "For Students",
                accent: "amber",
                items: [
                  "Invited directly by your school cohort",
                  "Browse only school-approved opportunities",
                  "Sign up for time slots with calendar view",
                  "Track progress toward graduation requirement",
                  "Submit self-selected volunteering for review",
                ],
              },
              {
                title: "For Community Partners",
                accent: "blue",
                items: [
                  "Invited by partnering schools",
                  "Create calendar-based volunteer opportunities",
                  "Manage student signups and attendance",
                  "Approve or reject hours with audit logging",
                  "Student details revealed only after attendance",
                ],
              },
            ].map(({ title, accent, items }) => (
              <div key={title} className={`bg-white border rounded-xl p-8 ${accent === "amber" ? "border-amber-200" : "border-gray-200"}`}>
                <h3 className={`text-lg font-bold mb-4 ${accent === "amber" ? "text-amber-700" : "text-blue-700"}`}>{title}</h3>
                <ul className="space-y-2.5">
                  {items.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-gray-600">
                      <span className={`mt-0.5 shrink-0 ${accent === "amber" ? "text-amber-500" : "text-blue-500"}`}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="max-w-xl mx-auto px-4 text-center">
            <img src="/logo-icon.png" alt="" className="w-16 h-16 mx-auto mb-6 rounded-2xl shadow-md" />
            <h2 className="text-2xl font-bold mb-3 text-gray-900">Ready to get started?</h2>
            <p className="text-gray-600 mb-8 text-sm leading-relaxed">
              GoodHours is free for schools. Register with Google Sign-In — students and community partners join through invitation only.
            </p>
            <Link
              to="/school/register"
              className="inline-flex items-center gap-3 px-6 py-3 bg-white border-2 border-gray-200 rounded-lg font-medium hover:bg-gray-50 hover:border-gray-300 text-gray-800 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign In with Google to Register
            </Link>
            <p className="mt-4 text-sm text-gray-500">
              Already registered?{" "}
              <Link to="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
            </p>
          </div>
        </section>
      </main>

      <footer className="py-8 bg-gray-50 border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <img src="/logo-full.png" alt="GoodHours" className="h-7 w-auto opacity-70" />
          <div className="text-xs text-gray-400">© {new Date().getFullYear()} GoodHours. All rights reserved.</div>
          <div className="flex gap-6 text-sm">
            <a href="#" className="text-gray-400 hover:text-gray-600">Help</a>
            <a href="#" className="text-gray-400 hover:text-gray-600">Terms</a>
            <a href="#" className="text-gray-400 hover:text-gray-600">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
