import { useState } from "react";
import { Link } from "react-router-dom";

type DemoTab = "school" | "student" | "partner";

function SchoolDashboardMock() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden text-left font-sans">
      {/* Nav bar */}
      <div className="flex items-center px-5 border-b border-gray-200" style={{ height: 46 }}>
        <div className="font-bold text-gray-900 text-[13px] mr-6">Lincoln High School</div>
        {["Dashboard", "Cohorts", "Partners", "Submissions"].map((tab, i) => (
          <div key={tab} className={`px-3 text-[12px] h-full flex items-center border-b-2 ${i === 0 ? "border-blue-600 text-blue-600 font-semibold" : "border-transparent text-gray-500"}`}>{tab}</div>
        ))}
        <div className="ml-auto flex gap-1.5">
          <div className="px-2.5 py-1 bg-white border border-gray-200 rounded text-[11px] font-medium text-gray-600">Export PDF</div>
          <div className="px-2.5 py-1 bg-blue-600 rounded text-[11px] font-medium text-white">Manage Cohorts</div>
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-0">
        {[
          { label: "Total Students", value: "247", sub: null, valueColor: "text-gray-900" },
          { label: "Total Hours", value: "8,432.5", sub: "verified", subColor: "text-gray-400", valueColor: "text-blue-600" },
          { label: "Goal Reached", value: "89", sub: "of 247 students", subColor: "text-gray-400", valueColor: "text-green-600" },
          { label: "At Risk", value: "12", sub: "deadline, pace, or attendance", subColor: "text-gray-400", valueColor: "text-red-500" },
        ].map((m, i) => (
          <div key={m.label} className={`px-4 py-3 ${i < 3 ? "border-r border-gray-200" : ""}`}>
            <div className="text-[9px] text-gray-400 uppercase tracking-wide font-medium mb-1">{m.label}</div>
            <div className={`text-xl font-bold leading-none ${m.valueColor}`}>{m.value}</div>
            {m.sub && <div className={`text-[9px] mt-1 ${m.subColor}`}>{m.sub}</div>}
          </div>
        ))}
      </div>
      {/* Quick links grid */}
      <div className="grid grid-cols-3 gap-1.5 px-3 py-2 border-t border-gray-200 bg-gray-50">
        {["View All Cohorts (3)", "Partners (10)", "Self-Submitted Hours", "Student Roster (247)", "On-Track (235)", "Off-Track (12)"].map((label) => (
          <div key={label} className="px-2.5 py-1.5 bg-white border border-gray-200 rounded text-[10px] text-gray-700 flex justify-between items-center">
            <span>{label}</span>
          </div>
        ))}
      </div>
      {/* Body */}
      <div className="grid grid-cols-2 gap-3 p-3 border-t border-gray-200">
        {/* Cohorts */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-[11px] font-semibold text-gray-700">Cohorts</span>
            <span className="text-[9px] text-blue-600">Manage →</span>
          </div>
          <div>
            {[
              { name: "Class of 2026", goal: "40h", students: 84, avg: "38.2h", onTrack: 71, offTrack: 13, pct: 94 },
              { name: "Class of 2027", goal: "40h", students: 91, avg: "22.4h", onTrack: 78, offTrack: 12, pct: 56 },
              { name: "Class of 2025", goal: "40h", students: 72, avg: "40.0h", onTrack: 72, offTrack: 0, pct: 100 },
            ].map((c, i, arr) => (
              <div key={c.name} className={`px-3 py-2 ${i < arr.length - 1 ? "border-b border-gray-100" : ""}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-semibold text-gray-800">{c.name}</span>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 uppercase tracking-wide">published</span>
                </div>
                <div className="flex gap-3 mb-1.5">
                  <div><div className="text-[11px] font-bold text-gray-900">{c.students}</div><div className="text-[8px] text-gray-400">Students</div></div>
                  <div><div className="text-[11px] font-bold text-blue-600">{c.avg}</div><div className="text-[8px] text-gray-400">Avg Hours</div></div>
                  <div><div className="text-[11px] font-bold text-green-600">{c.onTrack}</div><div className="text-[8px] text-gray-400">On-Track</div></div>
                  <div><div className={`text-[11px] font-bold ${c.offTrack > 0 ? "text-red-500" : "text-gray-400"}`}>{c.offTrack}</div><div className="text-[8px] text-gray-400">Off-Track</div></div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-[4px]">
                  <div className={`h-[4px] rounded-full ${c.pct >= 80 ? "bg-green-500" : c.pct >= 50 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${c.pct}%` }} />
                </div>
                <div className="text-[8px] text-gray-400 mt-0.5">{c.pct}% completed {c.goal} goal</div>
              </div>
            ))}
          </div>
        </div>
        {/* Student Roster */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-[11px] font-semibold text-gray-700">Student Roster</span>
            <span className="text-[9px] text-blue-600">View All →</span>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Name", "Hours", "Status"].map((h) => (
                  <th key={h} className={`px-3 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide ${h === "Name" ? "text-left" : "text-right"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { name: "Ava Thompson", hours: "32.0", req: 40, status: "ON_TRACK" },
                { name: "James Rivera", hours: "28.5", req: 40, status: "ON_TRACK" },
                { name: "Sofia Chen", hours: "8.0", req: 40, status: "AT_RISK" },
                { name: "Marcus Lee", hours: "14.0", req: 40, status: "ON_TRACK" },
                { name: "Priya Patel", hours: "40.0", req: 40, status: "COMPLETED" },
              ].map((s) => (
                <tr key={s.name} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-1.5 text-[10px] font-semibold text-gray-800">{s.name}</td>
                  <td className="px-3 py-1.5 text-[10px] text-right">
                    <span className="font-semibold text-gray-700">{s.hours}</span>
                    <span className="text-gray-400">/{s.req}h</span>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                      s.status === "COMPLETED" ? "bg-green-50 text-green-700" :
                      s.status === "ON_TRACK" ? "bg-green-50 text-green-700" :
                      "bg-red-50 text-red-600"
                    }`}>{s.status === "COMPLETED" ? "Completed" : s.status === "ON_TRACK" ? "On Track" : "At Risk"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StudentDashboardMock() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden text-left font-sans">
      {/* Nav bar */}
      <div className="flex items-center px-5 border-b border-gray-200" style={{ height: 46 }}>
        <div className="font-bold text-gray-900 text-[13px] mr-6">GoodHours</div>
        {["Dashboard", "Browse", "Submit Hours", "Settings"].map((tab, i) => (
          <div key={tab} className={`px-3 text-[12px] h-full flex items-center border-b-2 ${i === 0 ? "border-blue-600 text-blue-600 font-semibold" : "border-transparent text-gray-500"}`}>{tab}</div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[9px] font-bold text-white">JS</div>
          <span className="text-[11px] text-gray-600">John Smith</span>
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-4 border-b border-gray-200">
        {[
          { label: "Verified Hours", value: "32.0", sub: "of 40 required", valueColor: "text-green-600" },
          { label: "Pending Verification", value: "4.5h", sub: "awaiting approval", valueColor: "text-amber-500" },
          { label: "Activities Signed Up", value: "3", sub: "upcoming", valueColor: "text-blue-600" },
          { label: "Hours Remaining", value: "3.5h", sub: "to reach goal", valueColor: "text-gray-900" },
        ].map((m, i) => (
          <div key={m.label} className={`px-4 py-3 ${i < 3 ? "border-r border-gray-200" : ""}`}>
            <div className="text-[9px] text-gray-400 uppercase tracking-wide font-medium mb-1">{m.label}</div>
            <div className={`text-xl font-bold leading-none ${m.valueColor}`}>{m.value}</div>
            <div className="text-[9px] text-gray-400 mt-1">{m.sub}</div>
          </div>
        ))}
      </div>
      {/* Progress bar */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[11px] font-semibold text-gray-700">Progress toward goal</span>
          <span className="text-[11px] text-gray-500">32.0 / 40 hours</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-[6px]">
          <div className="bg-blue-600 h-[6px] rounded-full" style={{ width: "80%" }} />
        </div>
        <div className="text-[9px] text-amber-500 mt-1">4.5h more pending approval</div>
      </div>
      {/* Body */}
      <div className="grid grid-cols-2 gap-3 p-3">
        {/* Upcoming Activities */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-[11px] font-semibold text-gray-700">Upcoming Activities</span>
          </div>
          <div>
            {[
              { name: "Fundraise for Fresh Food", org: "City Food Bank", date: "4/21/2026 · 10:00 AM–2:00 PM", hours: "4h" },
              { name: "Stack Food and Inventory", org: "City Food Bank", date: "4/28/2026 · 3:00–6:00 PM", hours: "3h" },
            ].map((a, i, arr) => (
              <div key={a.name} className={`px-3 py-2 ${i < arr.length - 1 ? "border-b border-gray-100" : ""}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-[11px] font-semibold text-gray-800">{a.name}</div>
                    <div className="text-[9px] text-gray-400 mt-0.5">{a.date}</div>
                    <div className="text-[9px] text-gray-400">{a.org}</div>
                    <div className="text-[10px] font-bold text-blue-600 mt-0.5">{a.hours}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Recent Activity */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-[11px] font-semibold text-gray-700">Recent Activity</span>
          </div>
          <div>
            {[
              { name: "Food Bank Sorting", org: "City Food Bank", date: "4/12/2026", hours: "3h", status: "verified" },
              { name: "Library Program", org: "Public Library", date: "4/5/2026", hours: "2h", status: "verified" },
              { name: "Animal Shelter Help", org: "Happy Paws", date: "3/28/2026", hours: "4h", status: "pending" },
            ].map((a, i, arr) => (
              <div key={a.name} className={`px-3 py-2 flex justify-between items-center ${i < arr.length - 1 ? "border-b border-gray-100" : ""}`}>
                <div>
                  <div className="text-[11px] font-semibold text-gray-800">{a.name}</div>
                  <div className="text-[9px] text-gray-400">{a.org} · {a.date}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-gray-600">{a.hours}</span>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${a.status === "verified" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-600"}`}>{a.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PartnerDashboardMock() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden text-left font-sans">
      {/* Nav bar */}
      <div className="flex items-center px-5 border-b border-gray-200" style={{ height: 46 }}>
        <div className="font-bold text-gray-900 text-[13px] mr-6">City Food Bank</div>
        {["Dashboard", "Opportunities", "Settings"].map((tab, i) => (
          <div key={tab} className={`px-3 text-[12px] h-full flex items-center border-b-2 ${i === 0 ? "border-purple-600 text-purple-600 font-semibold" : "border-transparent text-gray-500"}`}>{tab}</div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="px-2.5 py-1 bg-blue-600 rounded text-[11px] font-medium text-white">+ New Opportunity</div>
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-4 border-b border-gray-200">
        {[
          { label: "Pending Approvals", value: "8", sub: "awaiting review", valueColor: "text-amber-500" },
          { label: "Active Opportunities", value: "4", sub: "currently open", valueColor: "text-blue-600" },
          { label: "Total Volunteers", value: "94", sub: "all time", valueColor: "text-green-600" },
          { label: "School Partners", value: "2", sub: "approved", valueColor: "text-gray-900" },
        ].map((m, i) => (
          <div key={m.label} className={`px-4 py-3 ${i < 3 ? "border-r border-gray-200" : ""}`}>
            <div className="text-[9px] text-gray-400 uppercase tracking-wide font-medium mb-1">{m.label}</div>
            <div className={`text-xl font-bold leading-none ${m.valueColor}`}>{m.value}</div>
            <div className="text-[9px] text-gray-400 mt-1">{m.sub}</div>
          </div>
        ))}
      </div>
      {/* Body */}
      <div className="grid grid-cols-2 gap-3 p-3">
        {/* Pending Hour Approvals */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-[11px] font-semibold text-gray-700">Pending Hour Approvals</span>
            <span className="text-[9px] text-blue-600">View all →</span>
          </div>
          <div>
            {[
              { name: "Jane Davis", opp: "Stack Food and Inventory", date: "4/21/2026", hours: "4h expected" },
              { name: "Jane Davis", opp: "Stack Food and Inventory", date: "4/21/2026", hours: "4h expected" },
            ].map((s, i, arr) => (
              <div key={s.name} className={`px-3 py-2.5 ${i < arr.length - 1 ? "border-b border-gray-100" : ""}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-[11px] font-semibold text-gray-800">{s.name}</div>
                    <div className="text-[9px] text-gray-400 mt-0.5">{s.opp} · {s.date}</div>
                    <div className="text-[10px] font-semibold text-gray-700 mt-0.5">{s.hours}</div>
                  </div>
                  <div className="flex gap-1 mt-0.5">
                    <div className="px-2 py-0.5 bg-blue-600 rounded text-[9px] font-medium text-white">Approve</div>
                    <div className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[9px] font-medium text-red-500">Reject</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* School Partners */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-[11px] font-semibold text-gray-700">School Partners</span>
            <span className="text-[9px] text-blue-600">Manage →</span>
          </div>
          <div>
            {[
              { name: "Lincoln High School", status: "accepted" },
              { name: "Jefferson Middle School", status: "pending" },
              { name: "Westside Academy", status: "accepted" },
            ].map((p, i, arr) => (
              <div key={p.name} className={`px-3 py-2.5 flex justify-between items-center ${i < arr.length - 1 ? "border-b border-gray-100" : ""}`}>
                <span className="text-[11px] text-gray-800">{p.name}</span>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${p.status === "accepted" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-600"}`}>{p.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [activeTab, setActiveTab] = useState<DemoTab>("school");

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 h-14 flex items-center justify-between px-6 md:px-10">
        <a href="#" className="flex items-center">
          <img src="/logo-full.png" alt="GoodHours" className="h-8 w-auto"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              el.style.display = "none";
              const span = document.createElement("span");
              span.textContent = "GoodHours";
              span.className = "font-bold text-blue-700 text-lg";
              el.parentNode?.insertBefore(span, el.nextSibling);
            }} />
        </a>
        <div className="hidden md:flex items-center gap-7">
          <a href="#how" className="text-sm text-gray-600 hover:text-blue-700 font-medium transition-colors">How It Works</a>
          <a href="#features" className="text-sm text-gray-600 hover:text-blue-700 font-medium transition-colors">Features</a>
          <a href="#demo" className="text-sm text-gray-600 hover:text-blue-700 font-medium transition-colors">See Demo</a>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login"
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-700 transition-colors">
            Sign In
          </Link>
          <Link to="/school/register"
            className="px-4 py-2 text-sm font-semibold text-white rounded-md transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(90deg, #1a56db 60%, #f97316 140%)" }}>
            Register School
          </Link>
        </div>
      </nav>

      <main>
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-20 grid md:grid-cols-2 gap-12 items-start">
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full px-3 py-1.5 mb-5">
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              School-first community service tracking
            </div>
            <h1 className="text-4xl md:text-[42px] font-extrabold text-gray-900 leading-tight tracking-tight mb-6">
              The Trusted System of Record for Student Volunteer Hours
            </h1>
            <ul className="space-y-3 mb-8">
              {[
                "Automatically track, verify, and report student volunteer hours",
                "Connect schools with approved community service partners",
                "Meet graduation requirements with a compliant digital record",
                "Free for schools — no credit card required to get started",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                  <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-blue-700 flex items-center justify-center">
                    <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3 items-start">
              <Link to="/school/register"
                className="px-6 py-3 bg-blue-700 text-white rounded-lg text-sm font-bold hover:bg-blue-800 transition-colors shadow-sm">
                Register Your School — Free
              </Link>
              <p className="text-xs text-gray-400">Students and partners join by invitation only</p>
            </div>
          </div>
          {/* Hero preview — school dashboard */}
          <div className="hidden md:block">
            <div className="scale-[0.72] origin-top-left w-[140%] pointer-events-none">
              <SchoolDashboardMock />
            </div>
          </div>
        </section>

        {/* Stats bar */}
        <section style={{ background: "linear-gradient(90deg, #1a3a8f 0%, #1a56db 50%, #c2410c 100%)" }}
          className="py-8">
          <div className="max-w-4xl mx-auto px-6 grid grid-cols-4 gap-6 text-center">
            {[
              { value: "700,000+", label: "Community Partners Across USA" },
              { value: "100%", label: "Verified school-controlled records" },
              { value: "FERPA", label: "Compliant student data security" },
              { value: "35,000", label: "High Schools Across USA. Claim Yours." },
            ].map((s) => (
              <div key={s.label} className="text-white">
                <div className="text-3xl font-extrabold">{s.value}</div>
                <div className="text-sm opacity-85 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-20 bg-white">
          <div className="max-w-4xl mx-auto px-6 md:px-10">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-extrabold text-gray-900 mb-2">How It Works</h2>
              <p className="text-gray-500">Three steps from registration to verified hours</p>
            </div>
            <div className="grid md:grid-cols-3 gap-10 text-center">
              {[
                {
                  n: "1",
                  title: "School Registers",
                  body: "School admins sign in with Google and register using their school's official email. Your school becomes the trusted anchor for everything else.",
                },
                {
                  n: "2",
                  title: "Invite Students & Partners",
                  body: "Create cohorts, import your student roster, and invite approved community service organizations. Everything flows through school approval.",
                },
                {
                  n: "3",
                  title: "Track & Verify",
                  body: "Students sign up for opportunities, complete service, and hours are verified through a structured audit trail you control.",
                },
              ].map(({ n, title, body }) => (
                <div key={n}>
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-extrabold text-white mx-auto mb-4"
                    style={{ background: "linear-gradient(135deg, #1a56db, #f97316)" }}>
                    {n}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-6 md:px-10">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Built for Everyone</h2>
              <p className="text-gray-500">GoodHours works for schools, students, and community partners.</p>
            </div>
            {/* Demo tabs + mockup */}
            <div id="demo" className="mb-12">
              <div className="flex items-center border-b-2 border-gray-200 mb-6">
                {(["school", "student", "partner"] as DemoTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-[2px] capitalize transition-colors ${
                      activeTab === tab
                        ? "border-blue-600 text-blue-700 font-semibold"
                        : "border-transparent text-gray-500 hover:text-blue-600"
                    }`}>
                    {tab === "school" ? "School Admin" : tab === "student" ? "Student" : "Community Partner"}
                  </button>
                ))}
                <Link to="/school/register"
                  className="ml-auto px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-semibold transition-colors">
                  Register Free →
                </Link>
              </div>
              <div>
                {activeTab === "school" && <SchoolDashboardMock />}
                {activeTab === "student" && <StudentDashboardMock />}
                {activeTab === "partner" && <PartnerDashboardMock />}
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  emoji: "🏫",
                  bg: "bg-blue-50",
                  title: "For Schools",
                  color: "text-blue-700",
                  checkColor: "bg-blue-600",
                  items: [
                    "School-first registration, free forever",
                    "Create cohorts and bulk-import students",
                    "Approve community service partners",
                    "Full audit trail for all volunteering actions",
                    "Review student self-submitted volunteering",
                    "School-scoped student data access controls",
                  ],
                },
                {
                  emoji: "🎒",
                  bg: "bg-green-50",
                  title: "For Students",
                  color: "text-green-700",
                  checkColor: "bg-green-500",
                  items: [
                    "Invited directly by your school cohort",
                    "Browse only school-approved opportunities",
                    "Sign up for time slots with calendar view",
                    "Track progress toward graduation requirement",
                    "Submit self-selected volunteering for review",
                    "Download certified hour transcripts",
                  ],
                },
                {
                  emoji: "🤝",
                  bg: "bg-orange-50",
                  title: "For Community Partners",
                  color: "text-orange-700",
                  checkColor: "bg-orange-500",
                  items: [
                    "Invited by partnering schools",
                    "Create calendar-based volunteer opportunities",
                    "Manage student signups and attendance",
                    "Approve or reject hours with audit logging",
                    "Branded partner profile and directory listing",
                    "Volunteer identities hidden from partners by default",
                  ],
                },
              ].map(({ emoji, bg, title, color, checkColor, items }) => (
                <div key={title} className="bg-white border border-gray-200 rounded-xl p-7">
                  <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center text-xl mb-4`}>{emoji}</div>
                  <h3 className={`text-base font-bold mb-4 ${color}`}>{title}</h3>
                  <ul className="space-y-2.5">
                    {items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600">
                        <span className={`mt-0.5 shrink-0 w-4 h-4 rounded-full ${checkColor} flex items-center justify-center`}>
                          <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section
          className="py-20 text-center"
          style={{ background: "linear-gradient(135deg, #1a3a8f 0%, #1a56db 40%, #c2410c 100%)" }}>
          <div className="max-w-xl mx-auto px-6">
            <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-5">
              <img src="/logo-icon.png" alt="" className="w-8 h-8 object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-3">Ready to get started?</h2>
            <p className="text-white/80 text-base mb-8 leading-relaxed">
              GoodHours is free for schools. Register with Google Sign-In — students and community partners join through invitation only.
            </p>
            <Link
              to="/school/register"
              className="inline-flex items-center gap-3 px-6 py-3.5 bg-white text-blue-700 rounded-lg font-bold text-sm hover:bg-blue-50 transition-colors shadow-sm mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign In with Google to Register
            </Link>
            <p className="text-white/60 text-sm">
              Already registered?{" "}
              <Link to="/login" className="text-white font-medium underline hover:text-blue-200">Sign in</Link>
            </p>
          </div>
        </section>
      </main>

      <footer className="bg-gray-900 py-8">
        <div className="max-w-6xl mx-auto px-6 md:px-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <img src="/logo-full.png" alt="GoodHours" className="h-7 w-auto opacity-60 brightness-0 invert"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              el.style.display = "none";
              const span = document.createElement("span");
              span.textContent = "GoodHours";
              span.className = "font-bold text-white/60 text-sm";
              el.parentNode?.insertBefore(span, el.nextSibling);
            }} />
          <div className="text-xs text-gray-500">© {new Date().getFullYear()} GoodHours. All rights reserved.</div>
          <div className="flex gap-5">
            <Link to="/faq" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Help</Link>
            <Link to="/terms" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Terms</Link>
            <Link to="/privacy" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
