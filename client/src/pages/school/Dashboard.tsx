import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

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

export default function SchoolDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "SCHOOL_ADMIN";
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0); // 0 = welcome, 1 = partners, 2 = cohorts
  const schoolOnboardingComplete = (user?.school as any)?.onboardingComplete ?? true;
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
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Link to="/cohorts" className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800">
            Manage Cohorts
          </Link>
        </div>
      </div>

      {/* School-wide stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">Total Students</div>
          <div className="text-2xl font-bold">{totalStudents}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">Total Hours</div>
          <div className="text-2xl font-bold text-blue-600">{totalHours === 0 ? "0" : totalHours.toFixed(1)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">Goal Reached</div>
          <div className={`text-2xl font-bold ${totalCompleted > 0 ? "text-green-600" : "text-gray-800"}`}>{totalCompleted}</div>
          <div className="text-xs text-gray-400">of {totalStudents} students</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">At Risk</div>
          <div className={`text-2xl font-bold ${totalAtRisk > 0 ? "text-red-600" : "text-gray-800"}`}>{totalAtRisk}</div>
          <div className="text-xs text-gray-400">below 50% of goal</div>
        </div>
      </div>

      {/* Quick links */}
      <div className="flex gap-3 mb-8 flex-wrap">
        <Link to="/cohorts" className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
          View All Cohorts ({cohorts.length})
        </Link>
        <Link to="/beneficiaries" className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
          Partners ({beneficiaries.length} approved)
        </Link>
        <Link to="/submissions" className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
          Self-Submitted Hours
        </Link>
        <Link to="/students" className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
          Student Roster ({students.length})
        </Link>
        <Link to="/students/on-track" className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
          On-Track Students
        </Link>
        <Link to="/students/off-track" className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
          Off-Track Students
        </Link>
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Cohorts</h2>
          <Link to="/cohorts" className="text-sm text-blue-600 hover:underline">Manage →</Link>
        </div>

        {cohorts.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
            No cohorts yet.{" "}
            <Link to="/cohorts" className="text-blue-600 hover:underline">Create your first cohort</Link> to get started.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cohorts.map((c) => (
              <Link key={c.id} to={`/cohorts/${c.id}`} className="block bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-300 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-gray-500">{c.requiredHours}h goal</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === "PUBLISHED" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                    {c.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center mb-3">
                  <div>
                    <div className="text-lg font-bold">{c.studentCount}</div>
                    <div className="text-xs text-gray-500">Students</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-blue-600">{c.studentCount > 0 ? (c.totalHours / c.studentCount).toFixed(1) : "0"}h</div>
                    <div className="text-xs text-gray-500">Avg Hours</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-green-600">{c.studentCount - c.atRiskCount}</div>
                    <div className="text-xs text-gray-500">On-Track</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-red-500">{c.atRiskCount}</div>
                    <div className="text-xs text-gray-500">Off-Track</div>
                  </div>
                </div>

                {c.studentCount > 0 && (
                  <div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${c.completionPercentage}%` }} />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{c.completionPercentage}% completion</div>
                  </div>
                )}

                {c.invitationsPending > 0 && (
                  <div className="mt-2 text-xs text-blue-600">{c.invitationsPending} invitation{c.invitationsPending !== 1 ? "s" : ""} pending</div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Condensed student roster */}
      {students.length > 0 && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Student Roster</h2>
            <Link to="/students" className="text-sm text-blue-600 hover:underline">View All ({students.length}) →</Link>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600 hidden sm:table-cell">Cohort</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Hours</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...students]
                  .sort((a, b) => (a.approvedHours / a.requiredHours) - (b.approvedHours / b.requiredHours))
                  .slice(0, 8)
                  .map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{s.name}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs hidden sm:table-cell">{s.cohortName}</td>
                      <td className="px-4 py-2 text-right">
                        <span className="font-medium">{s.approvedHours.toFixed(1)}</span>
                        <span className="text-gray-400 text-xs">/{s.requiredHours}h</span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          s.status === "COMPLETED" ? "bg-green-50 text-green-700" :
                          s.status === "ON_TRACK" ? "bg-blue-50 text-blue-700" :
                          "bg-red-50 text-red-600"
                        }`}>{s.status.replace("_", " ")}</span>
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
                <div className="text-sm font-medium">{b.name}</div>
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
