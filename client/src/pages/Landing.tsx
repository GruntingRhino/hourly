import { useState } from "react";
import { Link } from "react-router-dom";

type DemoTab = "school" | "student" | "partner";

function SchoolDashboardMock() {
  return (
    <div className="border border-[var(--border)] rounded-[3px] overflow-hidden text-left" style={{ background: "var(--surface)" }}>
      {/* Nav bar */}
      <div className="flex items-center px-4 border-b border-[var(--border)]" style={{ height: 42, background: "var(--navy)" }}>
        <div className="font-semibold text-white text-[12px] mr-5">Lincoln High School</div>
        {["Dashboard", "Cohorts", "Partners", "Submissions"].map((tab, i) => (
          <div key={tab} className={`px-3 text-[11px] h-full flex items-center border-b-2 ${i === 0 ? "border-white text-white font-medium" : "border-transparent text-white/80"}`}>{tab}</div>
        ))}
        <div className="ml-auto flex gap-1.5">
          <div className="px-2 py-0.5 border border-white/40 rounded-[2px] text-[10px] font-medium text-white/90">Export PDF</div>
          <div className="px-2 py-0.5 rounded-[2px] text-[10px] font-medium text-white" style={{ background: "var(--action)" }}>Manage Cohorts</div>
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-4">
        {[
          { label: "Total Students", value: "247", valueColor: "text-[var(--text)]" },
          { label: "Total Hours", value: "8,432.5", valueColor: "text-[var(--action)]" },
          { label: "Goal Reached", value: "89", valueColor: "text-[var(--ok-t)]" },
          { label: "At Risk", value: "12", valueColor: "text-[var(--er-t)]" },
        ].map((m, i) => (
          <div key={m.label} className={`px-4 py-2.5 ${i < 3 ? "border-r border-[var(--border)]" : ""}`} style={{ background: "var(--surface)" }}>
            <div className="text-[9px] uppercase tracking-wide font-semibold mb-1" style={{ color: "var(--text-faint)" }}>{m.label}</div>
            <div className={`text-lg font-bold leading-none ${m.valueColor}`}>{m.value}</div>
          </div>
        ))}
      </div>
      {/* Quick links */}
      <div className="grid grid-cols-3 gap-1.5 px-3 py-2 border-t border-[var(--border)]" style={{ background: "var(--surface-alt)" }}>
        {["View All Cohorts (3)", "Partners (10)", "Self-Submitted Hours", "Student Roster (247)", "On-Track (235)", "Off-Track (12)"].map((label) => (
          <div key={label} className="px-2 py-1 border border-[var(--border)] rounded-[2px] text-[9px] flex justify-between items-center" style={{ background: "var(--surface)", color: "var(--text-sec)" }}>
            <span>{label}</span>
          </div>
        ))}
      </div>
      {/* Body */}
      <div className="grid grid-cols-2 gap-3 p-3 border-t border-[var(--border)]">
        {/* Cohorts */}
        <div className="border border-[var(--border)] rounded-[3px] overflow-hidden">
          <div className="flex justify-between items-center px-3 py-1.5 border-b border-[var(--border)]" style={{ background: "var(--surface-alt)" }}>
            <span className="text-[10px] font-semibold" style={{ color: "var(--text)" }}>Cohorts</span>
            <span className="text-[9px]" style={{ color: "var(--action)" }}>Manage →</span>
          </div>
          <div>
            {[
              { name: "Class of 2026", goal: "40h", students: 84, avg: "38.2h", onTrack: 71, offTrack: 13, pct: 94 },
              { name: "Class of 2027", goal: "40h", students: 91, avg: "22.4h", onTrack: 78, offTrack: 12, pct: 56 },
              { name: "Class of 2025", goal: "40h", students: 72, avg: "40.0h", onTrack: 72, offTrack: 0, pct: 100 },
            ].map((c, i, arr) => (
              <div key={c.name} className={`px-3 py-2 ${i < arr.length - 1 ? "border-b border-[var(--border)]" : ""}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-semibold" style={{ color: "var(--text)" }}>{c.name}</span>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-[2px] uppercase tracking-wide border" style={{ background: "var(--navy)", color: "#fff", borderColor: "transparent" }}>published</span>
                </div>
                <div className="flex gap-3 mb-1.5">
                  <div><div className="text-[10px] font-bold" style={{ color: "var(--text)" }}>{c.students}</div><div className="text-[8px]" style={{ color: "var(--text-faint)" }}>Students</div></div>
                  <div><div className="text-[10px] font-bold" style={{ color: "var(--action)" }}>{c.avg}</div><div className="text-[8px]" style={{ color: "var(--text-faint)" }}>Avg Hours</div></div>
                  <div><div className="text-[10px] font-bold" style={{ color: "var(--ok-t)" }}>{c.onTrack}</div><div className="text-[8px]" style={{ color: "var(--text-faint)" }}>On-Track</div></div>
                  <div><div className="text-[10px] font-bold" style={{ color: c.offTrack > 0 ? "var(--er-t)" : "var(--text-faint)" }}>{c.offTrack}</div><div className="text-[8px]" style={{ color: "var(--text-faint)" }}>Off-Track</div></div>
                </div>
                <div className="w-full rounded-full h-[4px] border border-[var(--border)]" style={{ background: "var(--surface-alt)" }}>
                  <div className={`h-[4px] rounded-full ${c.pct >= 80 ? "bg-[var(--ok-t)]" : c.pct >= 50 ? "bg-[var(--wn-t)]" : "bg-[var(--er-t)]"}`} style={{ width: `${c.pct}%` }} />
                </div>
                <div className="text-[8px] mt-0.5" style={{ color: "var(--text-faint)" }}>{c.pct}% completed {c.goal} goal</div>
              </div>
            ))}
          </div>
        </div>
        {/* Student Roster */}
        <div className="border border-[var(--border)] rounded-[3px] overflow-hidden">
          <div className="flex justify-between items-center px-3 py-1.5 border-b border-[var(--border)]" style={{ background: "var(--surface-alt)" }}>
            <span className="text-[10px] font-semibold" style={{ color: "var(--text)" }}>Student Roster</span>
            <span className="text-[9px]" style={{ color: "var(--action)" }}>View All →</span>
          </div>
          <table className="w-full">
            <thead className="border-b border-[var(--border)]" style={{ background: "var(--surface-alt)" }}>
              <tr>
                {["Name", "Hours", "Status"].map((h) => (
                  <th key={h} className={`px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wide ${h === "Name" ? "text-left" : "text-right"}`} style={{ color: "var(--text-faint)" }}>{h}</th>
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
                <tr key={s.name} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-alt)]">
                  <td className="px-3 py-1.5 text-[10px] font-semibold" style={{ color: "var(--text)" }}>{s.name}</td>
                  <td className="px-3 py-1.5 text-[10px] text-right">
                    <span className="font-semibold" style={{ color: "var(--text-sec)" }}>{s.hours}</span>
                    <span style={{ color: "var(--text-faint)" }}>/{s.req}h</span>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-[2px] uppercase tracking-wide border ${
                      s.status === "COMPLETED" || s.status === "ON_TRACK"
                        ? "border-[var(--ok-b)]"
                        : "border-[var(--er-b)]"
                    }`} style={{
                      background: s.status === "COMPLETED" || s.status === "ON_TRACK" ? "var(--ok-bg)" : "var(--er-bg)",
                      color: s.status === "COMPLETED" || s.status === "ON_TRACK" ? "var(--ok-t)" : "var(--er-t)",
                    }}>
                      {s.status === "COMPLETED" ? "Completed" : s.status === "ON_TRACK" ? "On Track" : "At Risk"}
                    </span>
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
    <div className="border border-[var(--border)] rounded-[3px] overflow-hidden text-left" style={{ background: "var(--surface)" }}>
      {/* Nav bar */}
      <div className="flex items-center px-4 border-b border-[var(--border)]" style={{ height: 42, background: "var(--navy)" }}>
        <div className="font-semibold text-white text-[12px] mr-5">GoodHours</div>
        {["Dashboard", "Browse", "Submit Hours", "Settings"].map((tab, i) => (
          <div key={tab} className={`px-3 text-[11px] h-full flex items-center border-b-2 ${i === 0 ? "border-white text-white font-medium" : "border-transparent text-white/80"}`}>{tab}</div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ background: "var(--navy-mid)" }}>JS</div>
          <span className="text-[10px] text-white/90">John Smith</span>
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-4 border-b border-[var(--border)]">
        {[
          { label: "Verified Hours", value: "32.0", valueColor: "text-[var(--ok-t)]" },
          { label: "Pending Verification", value: "4.5h", valueColor: "text-[var(--wn-t)]" },
          { label: "Activities Signed Up", value: "3", valueColor: "text-[var(--action)]" },
          { label: "Hours Remaining", value: "3.5h", valueColor: "text-[var(--text)]" },
        ].map((m, i) => (
          <div key={m.label} className={`px-4 py-2.5 ${i < 3 ? "border-r border-[var(--border)]" : ""}`}>
            <div className="text-[9px] uppercase tracking-wide font-semibold mb-1" style={{ color: "var(--text-faint)" }}>{m.label}</div>
            <div className={`text-lg font-bold leading-none ${m.valueColor}`}>{m.value}</div>
          </div>
        ))}
      </div>
      {/* Progress bar */}
      <div className="px-4 py-2.5 border-b border-[var(--border)]">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] font-semibold" style={{ color: "var(--text)" }}>Progress toward goal</span>
          <span className="text-[10px]" style={{ color: "var(--text-sec)" }}>32.0 / 40 hours</span>
        </div>
        <div className="w-full rounded-full h-[5px] border border-[var(--border)]" style={{ background: "var(--surface-alt)" }}>
          <div className="h-[5px] rounded-full" style={{ width: "80%", background: "var(--action)" }} />
        </div>
        <div className="text-[9px] mt-0.5" style={{ color: "var(--wn-t)" }}>4.5h more pending approval</div>
      </div>
      {/* Body */}
      <div className="grid grid-cols-2 gap-3 p-3">
        <div className="border border-[var(--border)] rounded-[3px] overflow-hidden">
          <div className="flex justify-between items-center px-3 py-1.5 border-b border-[var(--border)]" style={{ background: "var(--surface-alt)" }}>
            <span className="text-[10px] font-semibold" style={{ color: "var(--text)" }}>Upcoming Activities</span>
          </div>
          <div>
            {[
              { name: "Fundraise for Fresh Food", org: "City Food Bank", date: "4/21/2026 · 10:00 AM–2:00 PM", hours: "4h" },
              { name: "Stack Food and Inventory", org: "City Food Bank", date: "4/28/2026 · 3:00–6:00 PM", hours: "3h" },
            ].map((a, i, arr) => (
              <div key={a.name} className={`px-3 py-2 ${i < arr.length - 1 ? "border-b border-[var(--border)]" : ""}`}>
                <div className="text-[10px] font-semibold" style={{ color: "var(--text)" }}>{a.name}</div>
                <div className="text-[9px] mt-0.5" style={{ color: "var(--text-faint)" }}>{a.date}</div>
                <div className="text-[9px]" style={{ color: "var(--text-faint)" }}>{a.org}</div>
                <div className="text-[9px] font-bold mt-0.5" style={{ color: "var(--action)" }}>{a.hours}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="border border-[var(--border)] rounded-[3px] overflow-hidden">
          <div className="flex justify-between items-center px-3 py-1.5 border-b border-[var(--border)]" style={{ background: "var(--surface-alt)" }}>
            <span className="text-[10px] font-semibold" style={{ color: "var(--text)" }}>Recent Activity</span>
          </div>
          <div>
            {[
              { name: "Food Bank Sorting", org: "City Food Bank", date: "4/12/2026", hours: "3h", status: "verified" },
              { name: "Library Program", org: "Public Library", date: "4/5/2026", hours: "2h", status: "verified" },
              { name: "Animal Shelter Help", org: "Happy Paws", date: "3/28/2026", hours: "4h", status: "pending" },
            ].map((a, i, arr) => (
              <div key={a.name} className={`px-3 py-2 flex justify-between items-center ${i < arr.length - 1 ? "border-b border-[var(--border)]" : ""}`}>
                <div>
                  <div className="text-[10px] font-semibold" style={{ color: "var(--text)" }}>{a.name}</div>
                  <div className="text-[9px]" style={{ color: "var(--text-faint)" }}>{a.org} · {a.date}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-semibold" style={{ color: "var(--text-sec)" }}>{a.hours}</span>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-[2px] uppercase tracking-wide border" style={a.status === "verified"
                    ? { background: "var(--ok-bg)", color: "var(--ok-t)", borderColor: "var(--ok-b)" }
                    : { background: "var(--wn-bg)", color: "var(--wn-t)", borderColor: "var(--wn-b)" }
                  }>{a.status}</span>
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
    <div className="border border-[var(--border)] rounded-[3px] overflow-hidden text-left" style={{ background: "var(--surface)" }}>
      {/* Nav bar */}
      <div className="flex items-center px-4 border-b border-[var(--border)]" style={{ height: 42, background: "var(--navy)" }}>
        <div className="font-semibold text-white text-[12px] mr-5">City Food Bank</div>
        {["Dashboard", "Opportunities", "Settings"].map((tab, i) => (
          <div key={tab} className={`px-3 text-[11px] h-full flex items-center border-b-2 ${i === 0 ? "border-white text-white font-medium" : "border-transparent text-white/80"}`}>{tab}</div>
        ))}
        <div className="ml-auto">
          <div className="px-2 py-0.5 rounded-[2px] text-[10px] font-medium text-white" style={{ background: "var(--action)" }}>+ New Opportunity</div>
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-4 border-b border-[var(--border)]">
        {[
          { label: "Pending Approvals", value: "8", valueColor: "text-[var(--wn-t)]" },
          { label: "Active Opportunities", value: "4", valueColor: "text-[var(--action)]" },
          { label: "Total Volunteers", value: "94", valueColor: "text-[var(--ok-t)]" },
          { label: "School Partners", value: "2", valueColor: "text-[var(--text)]" },
        ].map((m, i) => (
          <div key={m.label} className={`px-4 py-2.5 ${i < 3 ? "border-r border-[var(--border)]" : ""}`}>
            <div className="text-[9px] uppercase tracking-wide font-semibold mb-1" style={{ color: "var(--text-faint)" }}>{m.label}</div>
            <div className={`text-lg font-bold leading-none ${m.valueColor}`}>{m.value}</div>
          </div>
        ))}
      </div>
      {/* Body */}
      <div className="grid grid-cols-2 gap-3 p-3">
        <div className="border border-[var(--border)] rounded-[3px] overflow-hidden">
          <div className="flex justify-between items-center px-3 py-1.5 border-b border-[var(--border)]" style={{ background: "var(--surface-alt)" }}>
            <span className="text-[10px] font-semibold" style={{ color: "var(--text)" }}>Pending Hour Approvals</span>
            <span className="text-[9px]" style={{ color: "var(--action)" }}>View all →</span>
          </div>
          <div>
            {[
              { name: "Jane Davis", opp: "Stack Food and Inventory", date: "4/21/2026", hours: "4h expected" },
              { name: "Jane Davis", opp: "Stack Food and Inventory", date: "4/21/2026", hours: "4h expected" },
            ].map((s, i, arr) => (
              <div key={i} className={`px-3 py-2 ${i < arr.length - 1 ? "border-b border-[var(--border)]" : ""}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-[10px] font-semibold" style={{ color: "var(--text)" }}>{s.name}</div>
                    <div className="text-[9px] mt-0.5" style={{ color: "var(--text-faint)" }}>{s.opp} · {s.date}</div>
                    <div className="text-[9px] font-semibold mt-0.5" style={{ color: "var(--text-sec)" }}>{s.hours}</div>
                  </div>
                  <div className="flex gap-1 mt-0.5">
                    <div className="px-2 py-0.5 rounded-[2px] text-[9px] font-medium text-white" style={{ background: "var(--action)" }}>Approve</div>
                    <div className="px-2 py-0.5 border rounded-[2px] text-[9px] font-medium" style={{ borderColor: "var(--er-b)", color: "var(--er-t)", background: "var(--er-bg)" }}>Reject</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border border-[var(--border)] rounded-[3px] overflow-hidden">
          <div className="flex justify-between items-center px-3 py-1.5 border-b border-[var(--border)]" style={{ background: "var(--surface-alt)" }}>
            <span className="text-[10px] font-semibold" style={{ color: "var(--text)" }}>School Partners</span>
            <span className="text-[9px]" style={{ color: "var(--action)" }}>Manage →</span>
          </div>
          <div>
            {[
              { name: "Lincoln High School", status: "accepted" },
              { name: "Jefferson Middle School", status: "pending" },
              { name: "Westside Academy", status: "accepted" },
            ].map((p, i, arr) => (
              <div key={p.name} className={`px-3 py-2 flex justify-between items-center ${i < arr.length - 1 ? "border-b border-[var(--border)]" : ""}`}>
                <span className="text-[10px]" style={{ color: "var(--text)" }}>{p.name}</span>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-[2px] uppercase tracking-wide border" style={
                  p.status === "accepted"
                    ? { background: "var(--ok-bg)", color: "var(--ok-t)", borderColor: "var(--ok-b)" }
                    : { background: "var(--wn-bg)", color: "var(--wn-t)", borderColor: "var(--wn-b)" }
                }>{p.status}</span>
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
    <div className="min-h-screen" style={{ background: "var(--bg)", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-10" style={{ background: "var(--navy)", height: 54 }}>
        <a href="#" className="flex items-center">
          <img src="/logo-full.png" alt="GoodHours" className="h-7 w-auto brightness-0 invert"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              el.style.display = "none";
              const span = document.createElement("span");
              span.textContent = "GoodHours";
              span.className = "font-semibold text-white text-[15px] tracking-tight";
              el.parentNode?.insertBefore(span, el.nextSibling);
            }} />
        </a>
        <div className="hidden md:flex items-center gap-6">
          <a href="#how" className="text-[13.5px] text-white/85 hover:text-white transition-colors">How It Works</a>
          <a href="#features" className="text-[13.5px] text-white/85 hover:text-white transition-colors">Features</a>
          <a href="#demo" className="text-[13.5px] text-white/85 hover:text-white transition-colors">See Demo</a>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-[13.5px] text-white/90 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link to="/school/register"
            className="h-[34px] px-4 text-[13px] font-semibold text-white rounded-[2px] flex items-center transition-colors"
            style={{ background: "var(--action)" }}>
            Register School
          </Link>
        </div>
      </nav>

      <main>
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 md:px-10 py-14 md:py-16 grid md:grid-cols-2 gap-12 items-start">
          <div>
            <h1 className="text-[36px] md:text-[40px] font-bold leading-tight tracking-tight mb-5" style={{ color: "var(--navy)" }}>
              The Trusted System of Record for Student Volunteer Hours
            </h1>
            <ul className="space-y-2.5 mb-7">
              {[
                "Automatically track, verify, and report student volunteer hours",
                "Connect schools with approved community service partners",
                "Track graduation requirements with an organized digital record",
                "Free for schools — no credit card required to get started",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-[13.5px]" style={{ color: "var(--text-sec)" }}>
                  <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "var(--navy)" }}>
                    <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3 items-start">
              <Link to="/school/register"
                className="h-[38px] px-6 text-[13.5px] font-semibold text-white rounded-[2px] flex items-center transition-colors"
                style={{ background: "var(--navy)" }}>
                Register Your School — Free
              </Link>
              <p className="text-[12px]" style={{ color: "var(--text-faint)" }}>Students and partners join by invitation only</p>
              <Link to="/login" className="text-[13px] font-medium underline md:hidden" style={{ color: "var(--action)" }}>
                Already have an account? Sign in
              </Link>
            </div>
          </div>
          {/* Hero preview */}
          <div className="hidden md:block">
            <div className="scale-[0.72] origin-top-left w-[140%] pointer-events-none">
              <SchoolDashboardMock />
            </div>
          </div>
        </section>

        {/* Stats bar */}
        <section className="py-8 md:py-10" style={{ background: "var(--navy)" }}>
          <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 text-center">
            {[
              { value: "School-first", label: "Community service coordination" },
              { value: "Verified", label: "School-reviewed hour records" },
              { value: "Privacy-focused", label: "Controls for student information" },
              { value: "13+", label: "Age requirement" },
            ].map((s) => (
              <div key={s.label} className="text-white">
                <div className="text-xl md:text-[28px] font-bold">{s.value}</div>
                <div className="text-[12px] md:text-[13px] opacity-75 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-14 md:py-16" style={{ background: "var(--surface)" }}>
          <div className="max-w-4xl mx-auto px-6 md:px-10">
            <div className="text-center mb-10">
              <h2 className="text-[28px] font-bold mb-2" style={{ color: "var(--navy)" }}>How It Works</h2>
              <p style={{ color: "var(--text-sec)", fontSize: 14 }}>Three steps from registration to verified hours</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 md:gap-10 text-center">
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
                    className="w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold text-white mx-auto mb-4"
                    style={{ background: "var(--navy)" }}>
                    {n}
                  </div>
                  <h3 className="font-semibold mb-2" style={{ color: "var(--text)" }}>{title}</h3>
                  <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-sec)" }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-14 md:py-16" style={{ background: "var(--bg)" }}>
          <div className="max-w-6xl mx-auto px-6 md:px-10">
            <div className="text-center mb-10">
              <h2 className="text-[28px] font-bold mb-2" style={{ color: "var(--navy)" }}>Built for Everyone</h2>
              <p className="text-[14px]" style={{ color: "var(--text-sec)" }}>GoodHours works for schools, students, and community partners.</p>
            </div>
            {/* Demo tabs */}
            <div id="demo" className="mb-10">
              <div className="flex items-center border-b border-[var(--border)] mb-5 overflow-x-auto">
                {(["school", "student", "partner"] as DemoTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 md:px-5 py-2.5 text-[13.5px] font-medium border-b-2 -mb-[2px] capitalize transition-colors whitespace-nowrap ${
                      activeTab === tab
                        ? "border-[var(--navy)] text-[var(--navy)] font-semibold"
                        : "border-transparent hover:text-[var(--action)]"
                    }`}
                    style={{ color: activeTab === tab ? "var(--navy)" : "var(--text-sec)" }}>
                    {tab === "school" ? "School Admin" : tab === "student" ? "Student" : "Community Partner"}
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0">
                {activeTab === "school" && (
                  <div className="min-w-[640px] md:min-w-0"><SchoolDashboardMock /></div>
                )}
                {activeTab === "student" && (
                  <div className="min-w-[640px] md:min-w-0"><StudentDashboardMock /></div>
                )}
                {activeTab === "partner" && (
                  <div className="min-w-[640px] md:min-w-0"><PartnerDashboardMock /></div>
                )}
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-5 md:gap-6">
              {[
                {
                  title: "For Schools",
                  color: "var(--navy)",
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
                  title: "For Students",
                  color: "var(--ok-t)",
                  items: [
                    "Invited directly by your school cohort",
                    "Browse only school-approved opportunities",
                    "Sign up for time slots with calendar view",
                    "Track progress toward graduation requirement",
                    "Submit self-selected volunteering for review",
                    "Download hour summaries",
                  ],
                },
                {
                  title: "For Community Partners",
                  color: "var(--action)",
                  items: [
                    "Invited by partnering schools",
                    "Create calendar-based volunteer opportunities",
                    "Manage student signups and attendance",
                    "Approve or reject hours with audit logging",
                    "Branded partner profile and directory listing",
                    "Volunteer identities hidden from partners by default",
                  ],
                },
              ].map(({ title, color, items }) => (
                <div key={title} className="border border-[var(--border)] rounded-[3px] p-6" style={{ background: "var(--surface)" }}>
                  <h3 className="text-[14px] font-semibold mb-4" style={{ color }}>{title}</h3>
                  <ul className="space-y-2.5">
                    {items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-[13px]" style={{ color: "var(--text-sec)" }}>
                        <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: color }}>
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
        <section className="py-16 text-center" style={{ background: "var(--navy)" }}>
          <div className="max-w-xl mx-auto px-6">
            <img src="/logo-full.png" alt="GoodHours" className="h-7 w-auto brightness-0 invert mx-auto mb-5"
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                el.style.display = "none";
                const span = document.createElement("span");
                span.textContent = "GoodHours";
                span.className = "font-semibold text-white text-[15px] tracking-tight block mb-5";
                el.parentNode?.insertBefore(span, el.nextSibling);
              }} />
            <h2 className="text-[28px] font-bold text-white mb-3">Ready to get started?</h2>
            <p className="text-white/90 text-[14px] mb-7 leading-relaxed">
              GoodHours is free for schools. Register with Google Sign-In — students and community partners join through invitation only.
            </p>
            <Link
              to="/school/register"
              className="inline-flex items-center gap-3 px-6 h-[42px] rounded-[2px] font-semibold text-[13.5px] mb-4 transition-colors"
              style={{ background: "var(--surface)", color: "var(--navy)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign In with Google to Register
            </Link>
            <p className="text-white/85 text-[13px]">
              Already registered?{" "}
              <Link to="/login" className="text-white font-medium underline hover:text-white/90">Sign in</Link>
            </p>
          </div>
        </section>
      </main>

      <footer className="py-7" style={{ background: "var(--navy)" }}>
        <div className="max-w-6xl mx-auto px-6 md:px-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10 pt-7">
          <img src="/logo-full.png" alt="GoodHours" className="h-6 w-auto opacity-50 brightness-0 invert"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              el.style.display = "none";
              const span = document.createElement("span");
              span.textContent = "GoodHours";
              span.className = "font-semibold text-white/85 text-[13px]";
              el.parentNode?.insertBefore(span, el.nextSibling);
            }} />
          <div className="text-[12px] text-white/75">© {new Date().getFullYear()} GoodHours. All rights reserved.</div>
          <div className="flex gap-5">
            <Link to="/faq" className="text-[13px] text-white/80 hover:text-white transition-colors">Help</Link>
            <Link to="/terms" className="text-[13px] text-white/80 hover:text-white transition-colors">Terms</Link>
            <Link to="/privacy" className="text-[13px] text-white/80 hover:text-white transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
