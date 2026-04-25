import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/(?:^|[\s-])\w/g, (w) => w.toUpperCase());
}

interface CohortSummary {
  id: string;
  name: string;
  status: string;
  requiredHours: number;
  studentCount: number;
  totalHours: number;
  completedCount: number;
  atRiskCount: number;
  completionPercentage: number;
  invitationsPending: number;
}

interface Beneficiary {
  id: string;
  name: string;
  category: string | null;
  approvalStatus: string;
}

interface StudentRow {
  id: string;
  name: string;
  email: string;
  cohortName: string;
  approvedHours: number;
  requiredHours: number;
  status: "COMPLETED" | "ON_TRACK" | "AT_RISK";
}

interface SchoolReportStudent {
  name: string;
  email: string;
  cohortName?: string | null;
  approvedHours: number;
  pendingHours: number;
  requiredHours: number;
  percentComplete: number;
  status: string;
  riskReasons?: string[];
}

interface SchoolReportResponse {
  schoolName: string;
  requiredHours: number;
  totalStudents: number;
  studentsCompleted: number;
  students: SchoolReportStudent[];
}

export default function SchoolDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "SCHOOL_ADMIN";
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0); // 0 = welcome, 1 = partners, 2 = cohorts
  const schoolOnboardingComplete = (user?.school as any)?.onboardingComplete ?? false;
  const showOnboarding = isAdmin && !schoolOnboardingComplete && !onboardingDismissed;
  const [cohorts, setCohorts] = useState<CohortSummary[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleDismissOnboarding = async () => {
    setOnboardingDismissed(true);
    try { await api.put("/schools/onboarding", {}); } catch {}
  };

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [c, b, s] = await Promise.all([
        api.get<CohortSummary[]>("/cohorts"),
        api.get<Beneficiary[]>("/beneficiaries?status=APPROVED"),
        api.get<StudentRow[]>("/cohorts/school-students").catch(() => []),
      ]);
      setCohorts(c);
      setBeneficiaries(b);
      setStudents(s);
    } catch {
      setError("Failed to load dashboard. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      const report = await api.get<SchoolReportResponse>("/reports/school");
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`${report.schoolName} Service Report`, 14, 18);
      doc.setFontSize(11);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 27);
      doc.text(`Students: ${report.totalStudents}`, 14, 34);
      doc.text(`Completed: ${report.studentsCompleted}`, 70, 34);
      doc.text(`Default Goal: ${report.requiredHours}h`, 120, 34);

      autoTable(doc, {
        startY: 42,
        head: [["Student", "Cohort", "Approved", "Pending", "Required", "%", "Status", "Risk Factors"]],
        body: report.students.map((student) => [
          student.name,
          student.cohortName || "—",
          student.approvedHours.toFixed(1),
          student.pendingHours.toFixed(1),
          student.requiredHours.toFixed(1),
          `${student.percentComplete}%`,
          student.status,
          student.riskReasons?.join("; ") || "—",
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [31, 41, 55] },
      });

      doc.save(`${report.schoolName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-service-report.pdf`);
    } catch (err) {
      console.error(err);
      setError("Failed to export PDF report.");
    }
  };

  if (loading) return <div className="text-gray-500">Loading dashboard...</div>;
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>;

  // Aggregate stats across all cohorts
  const totalStudents = cohorts.reduce((s, c) => s + c.studentCount, 0);
  const totalHours = cohorts.reduce((s, c) => s + c.totalHours, 0);
  const totalCompleted = cohorts.reduce((s, c) => s + c.completedCount, 0);
  const totalAtRisk = cohorts.reduce((s, c) => s + c.atRiskCount, 0);
  const pendingInvites = cohorts.reduce((s, c) => s + c.invitationsPending, 0);

  return (
    <div>
      {showOnboarding && (() => {
        const STEPS = [
          {
            num: 1, title: "Welcome to GoodHours",
            body: "You're almost ready to start tracking community service hours. Complete the setup steps below — takes less than 5 minutes.",
            cta: null, ctaLabel: "", next: "Get Started →",
          },
          {
            num: 2, title: "Add Community Partners",
            body: "Search the directory for nonprofits near your school, or create a custom partner. Partners need approval before students can log hours with them.",
            cta: "/beneficiaries", ctaLabel: "Go to Partners →", next: "Done, next step →",
          },
          {
            num: 3, title: "Create a Cohort & Invite Students",
            body: "Create a graduation cohort, set an hours goal, and invite students by email. Students will join and can start browsing approved opportunities.",
            cta: "/cohorts", ctaLabel: "Go to Cohorts →", next: "Finish setup",
          },
        ];
        const step = STEPS[onboardingStep];
        const isLast = onboardingStep === STEPS.length - 1;
        return (
          <div className="mb-6 bg-white border border-blue-200 rounded-xl shadow-sm overflow-hidden">
            {/* Progress bar */}
            <div className="h-1 bg-blue-50">
              <div className="h-1 bg-blue-600 transition-all duration-500"
                style={{ width: `${((onboardingStep + 1) / STEPS.length) * 100}%` }} />
            </div>
            <div className="p-5">
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-3">
                {STEPS.map((s, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      i < onboardingStep ? "bg-blue-600 text-white" :
                      i === onboardingStep ? "bg-blue-700 text-white ring-2 ring-blue-200" :
                      "bg-gray-100 text-gray-400"
                    }`}>{i < onboardingStep ? "✓" : s.num}</div>
                    {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < onboardingStep ? "bg-blue-400" : "bg-gray-200"}`} />}
                  </div>
                ))}
                <span className="ml-2 text-xs text-gray-400">Step {step.num} of {STEPS.length}</span>
              </div>
              <div className="font-semibold text-gray-900 mb-1">{step.title}</div>
              <p className="text-sm text-gray-600 mb-4">{step.body}</p>
              <div className="flex flex-wrap items-center gap-3">
                {step.cta && (
                  <Link to={step.cta} className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors">
                    {step.ctaLabel}
                  </Link>
                )}
                <button
                  onClick={() => isLast ? handleDismissOnboarding() : setOnboardingStep(s => s + 1)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  {isLast ? "Finish setup" : step.cta ? "Skip this step →" : "Get Started →"}
                </button>
                <button onClick={handleDismissOnboarding} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">
                  Dismiss setup
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="text-sm font-semibold text-blue-700 mb-1">{user?.school?.name || "School"}</div>
          <h1 className="text-[22px] font-bold text-gray-900">Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportPdf} className="px-4 py-[7px] bg-white border border-gray-200 rounded-md text-[13.5px] font-medium text-gray-700 hover:bg-gray-50">
            Export PDF
          </button>
          <Link to="/cohorts" className="px-4 py-[7px] bg-blue-600 text-white rounded-md text-[13.5px] font-medium hover:opacity-85">
            Manage Cohorts
          </Link>
        </div>
      </div>

      {/* School-wide stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">Total Students</div>
          <div className="text-3xl font-bold text-gray-900 leading-none">{totalStudents}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">Total Hours</div>
          <div className="text-3xl font-bold text-blue-600 leading-none">{totalHours === 0 ? "0" : totalHours.toFixed(1)}</div>
          <div className="text-xs text-gray-400 mt-1">verified</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">Goal Reached</div>
          <div className={`text-3xl font-bold leading-none ${totalCompleted > 0 ? "text-green-600" : "text-gray-800"}`}>{totalCompleted}</div>
          <div className="text-xs text-gray-400 mt-1">of {totalStudents} students</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">At Risk</div>
          <div className={`text-3xl font-bold leading-none ${totalAtRisk > 0 ? "text-red-600" : "text-gray-800"}`}>{totalAtRisk}</div>
          <div className="text-xs text-gray-400 mt-1">deadline, pace, or attendance</div>
        </div>
      </div>

      {totalStudents === 0 && (
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="font-semibold text-amber-900 mb-2">This school is not activated yet</div>
          <div className="text-sm text-amber-800 mb-4">
            You have successfully claimed ownership for your school. Complete these three steps to start tracking volunteer hours for your students.
          </div>
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <Link to="/settings" className="rounded-lg border border-amber-200 bg-white p-3 hover:border-amber-300">
              <div className="font-medium text-gray-900">1. Confirm service rules</div>
              <div className="text-gray-600 mt-1">Required hours, dates, self-submission policy, and category caps.</div>
            </Link>
            <Link to="/beneficiaries" className="rounded-lg border border-amber-200 bg-white p-3 hover:border-amber-300">
              <div className="font-medium text-gray-900">2. Add partners</div>
              <div className="text-gray-600 mt-1">Approve at least one beneficiary so students have valid places to earn hours.</div>
            </Link>
            <Link to="/cohorts" className="rounded-lg border border-amber-200 bg-white p-3 hover:border-amber-300">
              <div className="font-medium text-gray-900">3. Import students</div>
              <div className="text-gray-600 mt-1">Create a cohort, import a CSV, then publish invitations and verify the roster.</div>
            </Link>
          </div>
        </div>
      )}

      {/* Quick links — 3×2 grid */}
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        {[
          { to: "/cohorts", label: "View All Cohorts", count: cohorts.length },
          { to: "/beneficiaries", label: "Partners Approved", count: beneficiaries.length },
          { to: "/submissions", label: "Self-Submitted Hours", count: null },
          { to: "/students", label: "Student Roster", count: students.length },
          { to: "/students/on-track", label: "On-Track", count: cohorts.reduce((s, c) => s + (c.studentCount - c.atRiskCount), 0) },
          { to: "/students/off-track", label: "Off-Track", count: totalAtRisk },
        ].map((b) => (
          <Link
            key={b.to}
            to={b.to}
            className="flex items-center justify-between px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span>{b.label}</span>
            {b.count != null && (
              <span className="ml-2 bg-gray-100 text-gray-500 rounded-full text-[11.5px] font-semibold px-2 py-0.5">{b.count}</span>
            )}
          </Link>
        ))}
      </div>

      {/* Pending invites alert */}
      {pendingInvites > 0 && (
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg flex justify-between items-center">
          <span className="text-sm text-blue-800">{pendingInvites} student invitation{pendingInvites !== 1 ? "s" : ""} pending across cohorts.</span>
          <Link to="/cohorts" className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
            View Cohorts
          </Link>
        </div>
      )}

      {/* Cohorts list */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-[15px] font-semibold text-gray-900">Cohorts</h2>
          <Link to="/cohorts" className="text-[13px] text-blue-600 hover:opacity-75">Manage →</Link>
        </div>

        {cohorts.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-500 text-sm">
            No cohorts yet.{" "}
            <Link to="/cohorts" className="text-blue-600 hover:underline">Create your first cohort</Link> to get started.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {cohorts.map((c) => (
              <Link key={c.id} to={`/cohorts/${c.id}`} className="block bg-white border border-gray-200 rounded-lg p-[18px] hover:border-blue-300 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2.5">
                    <div>
                      <div className="font-bold text-[15px] text-gray-900">{c.name}</div>
                      <div className="text-[12.5px] text-gray-500">{c.requiredHours}h goal</div>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${c.status === "PUBLISHED" ? "bg-blue-50 text-blue-600" : "bg-yellow-50 text-yellow-700"}`}>
                      {c.status.toLowerCase()}
                    </span>
                  </div>
                  <span className="text-[12px] text-gray-400 font-medium">{c.invitationsPending > 0 ? `${c.invitationsPending} pending` : ""}</span>
                </div>

                <div className="flex gap-6 mb-3">
                  {[
                    { label: "Students", value: c.studentCount, color: "text-gray-900" },
                    { label: "Avg Hours", value: c.studentCount > 0 ? `${(c.totalHours / c.studentCount).toFixed(1)}h` : "0h", color: "text-blue-600" },
                    { label: "On-Track", value: c.studentCount - c.atRiskCount, color: "text-green-600" },
                    { label: "Off-Track", value: c.atRiskCount, color: c.atRiskCount > 0 ? "text-red-500" : "text-gray-400" },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                      <div className="text-[11.5px] text-gray-500">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {c.studentCount > 0 && (
                  <>
                    <div className="w-full bg-gray-200 rounded-full h-[5px]">
                      <div
                        className={`h-[5px] rounded-full ${c.completionPercentage >= 80 ? "bg-green-500" : c.completionPercentage >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                        style={{ width: `${c.completionPercentage}%` }}
                      />
                    </div>
                    <div className="text-[11.5px] text-gray-400 mt-1">{c.completionPercentage}% completed {c.requiredHours}h goal</div>
                  </>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Condensed student roster */}
      {students.length > 0 && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-[15px] font-semibold text-gray-900">Student Roster</h2>
            <Link to="/students" className="text-[13px] text-blue-600 hover:opacity-75">View All ({students.length}) →</Link>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-[13.5px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">Name</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 hidden sm:table-cell">Cohort</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">Hours</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...students]
                  .sort((a, b) => (a.approvedHours / a.requiredHours) - (b.approvedHours / b.requiredHours))
                  .slice(0, 8)
                  .map((s) => (
                    <tr key={s.id} className="border-b border-gray-200 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5 font-semibold text-gray-900">{s.name}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-[12px] hidden sm:table-cell">{s.cohortName}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="font-medium text-gray-700">{s.approvedHours.toFixed(1)}</span>
                        <span className="text-gray-400 text-[12px]">/{s.requiredHours}h</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`text-[11.5px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${
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
      )}

      {/* Partners */}
      {beneficiaries.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Approved Partners</h2>
            <Link to="/beneficiaries" className="text-sm text-blue-600 hover:underline">Manage →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {beneficiaries.slice(0, 6).map((b) => (
              <div key={b.id} className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="text-sm font-medium">{toTitleCase(b.name)}</div>
                {b.category && <div className="text-xs text-gray-400 mt-0.5">{b.category}</div>}
              </div>
            ))}
          </div>
          {beneficiaries.length > 6 && (
            <Link to="/beneficiaries" className="block mt-2 text-sm text-blue-600 hover:underline">
              View all {beneficiaries.length} partners →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
