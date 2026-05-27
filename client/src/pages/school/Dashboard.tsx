import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import { getNotificationHref } from "../../lib/notificationRouting";
import type { AppNotification } from "../../lib/notificationRouting";
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

interface AtRiskStudent {
  id: string;
  name: string;
  email: string;
  cohort: string | null;
  approvedHours: number;
  pendingHours: number;
  requiredHours: number;
  remainingHours: number;
  percentComplete: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  riskReasons: string[];
  noShowCount: number;
  daysToDeadline: number | null;
}

interface InterventionCampaign {
  id: string;
  actionType: string;
  audienceType: string;
  queueType: string | null;
  savedView: string | null;
  subject: string | null;
  bodyPreview: string | null;
  priority: boolean;
  recipientCount: number;
  createdAt: string;
  followUpCount: number;
  actor: { id: string; name: string; role: string };
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
  const schoolId = user?.schoolId;
  const isAdmin = user?.role === "SCHOOL_ADMIN";
  const isTeacher = user?.role === "TEACHER";
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0); // 0 = welcome, 1 = partners, 2 = cohorts
  const schoolOnboardingComplete = (user?.school as any)?.onboardingComplete ?? false;
  const showOnboarding = isAdmin && !schoolOnboardingComplete && !onboardingDismissed;
  const [cohorts, setCohorts] = useState<CohortSummary[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);
  const [interventions, setInterventions] = useState<InterventionCampaign[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);
  const [runningReminders, setRunningReminders] = useState(false);
  const [reminderMessage, setReminderMessage] = useState("");

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
      const [c, b, s, n, atRisk, interventionHistory] = await Promise.all([
        api.get<CohortSummary[]>("/cohorts"),
        api.get<Beneficiary[]>("/beneficiaries?status=APPROVED"),
        api.get<StudentRow[]>("/cohorts/school-students").catch(() => []),
        api.get<AppNotification[]>("/messages/notifications").catch(() => []),
        schoolId ? api.get<{ total: number; students: AtRiskStudent[] }>(`/schools/${schoolId}/students/at-risk`).catch(() => ({ total: 0, students: [] })) : Promise.resolve({ total: 0, students: [] }),
        api.get<{ campaigns: InterventionCampaign[] }>("/messages/interventions/history?limit=6").catch(() => ({ campaigns: [] })),
      ]);
      setCohorts(c);
      setBeneficiaries(b);
      setStudents(s);
      setNotifications(n);
      setAtRiskStudents(atRisk.students || []);
      setInterventions(interventionHistory.campaigns || []);
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

  const handleDownload = async (path: string, filename: string, label: string) => {
    setDownloadingReport(label);
    setError("");
    try {
      const blob = await api.download(path);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "Failed to export CSV report.");
    } finally {
      setDownloadingReport(null);
    }
  };

  const handleRunReminders = async () => {
    setRunningReminders(true);
    setError("");
    setReminderMessage("");
    try {
      await api.post("/messages/reminders/run", {});
      setReminderMessage("Reminder cycle completed.");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to run reminders.");
    } finally {
      setRunningReminders(false);
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
  const topAtRisk = [...atRiskStudents]
    .sort((a, b) => {
      const riskWeight = (student: AtRiskStudent) => (student.riskLevel === "HIGH" ? 3 : student.riskLevel === "MEDIUM" ? 2 : 1);
      const riskDiff = riskWeight(b) - riskWeight(a);
      if (riskDiff !== 0) return riskDiff;
      const deadlineDiff = (a.daysToDeadline ?? Number.POSITIVE_INFINITY) - (b.daysToDeadline ?? Number.POSITIVE_INFINITY);
      if (deadlineDiff !== 0) return deadlineDiff;
      return (b.noShowCount ?? 0) - (a.noShowCount ?? 0);
    })
    .slice(0, 5);

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
          <h1 className="text-[22px] font-bold text-gray-900">{isTeacher ? "Teacher Dashboard" : "Dashboard"}</h1>
        </div>
        <div className="flex gap-2">
          {user?.schoolId && (
            <>
              <button
                onClick={() => handleDownload(`/schools/${user.schoolId}/export`, "all-students.csv", "students")}
                disabled={downloadingReport !== null}
                className="px-4 py-[7px] bg-white border border-gray-200 rounded-md text-[13.5px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {downloadingReport === "students" ? "Exporting..." : "Export CSV"}
              </button>
              <button
                onClick={() => handleDownload(`/schools/${user.schoolId}/students/at-risk?format=csv`, "at-risk-students.csv", "at-risk")}
                disabled={downloadingReport !== null}
                className="px-4 py-[7px] bg-white border border-gray-200 rounded-md text-[13.5px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {downloadingReport === "at-risk" ? "Exporting..." : "At-Risk CSV"}
              </button>
            </>
          )}
          <button onClick={handleExportPdf} className="px-4 py-[7px] bg-white border border-gray-200 rounded-md text-[13.5px] font-medium text-gray-700 hover:bg-gray-50">
            Export PDF
          </button>
          <Link to="/cohorts" className="px-4 py-[7px] bg-blue-600 text-white rounded-md text-[13.5px] font-medium hover:opacity-85">
            {isTeacher ? "View Assigned Cohorts" : "Manage Cohorts"}
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

      {topAtRisk.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-amber-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <div className="text-sm font-semibold text-red-700 mb-1">Administrator Intervention Center</div>
              <h2 className="text-lg font-bold text-gray-900">Students who need action now</h2>
              <p className="text-sm text-gray-600 mt-1">Prioritized for admins and teachers: overdue deadlines, approval bottlenecks, and attendance concerns.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/students?view=ADMIN_MORNING&triage=URGENT&filter=ALL" className="px-3 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700">
                Open Triage Queue
              </Link>
              {schoolId && (
                <button
                  onClick={() => handleDownload(`/schools/${schoolId}/students/at-risk?format=csv`, "at-risk-priority-queue.csv", "admin-at-risk")}
                  disabled={downloadingReport !== null}
                  className="px-3 py-2 bg-white border border-red-200 rounded-md text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {downloadingReport === "admin-at-risk" ? "Exporting..." : "Export At-Risk CSV"}
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-5">
            {topAtRisk.map((student) => (
              <Link
                key={student.id}
                to={`/students?view=ADMIN_MORNING&triage=URGENT&filter=AT_RISK&student=${student.id}`}
                className="rounded-lg border border-white/80 bg-white/90 p-3 hover:border-red-200 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{student.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{student.cohort || "No cohort"}</div>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${student.riskLevel === "HIGH" ? "bg-red-100 text-red-700" : student.riskLevel === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                    {student.riskLevel}
                  </span>
                </div>
                <div className="mt-3 text-xs text-gray-600 space-y-1">
                  <div>{student.approvedHours.toFixed(1)}h approved · {student.remainingHours.toFixed(1)}h left</div>
                  {student.daysToDeadline != null && <div>{student.daysToDeadline < 0 ? `${Math.abs(student.daysToDeadline)}d overdue` : `${student.daysToDeadline}d to deadline`}</div>}
                  {student.pendingHours > 0 && <div>{student.pendingHours.toFixed(1)}h pending approval</div>}
                  {student.noShowCount > 0 && <div>{student.noShowCount} no-show{student.noShowCount === 1 ? "" : "s"}</div>}
                </div>
                {!!student.riskReasons?.length && (
                  <div className="mt-3 text-[11px] text-gray-500 line-clamp-3">
                    {student.riskReasons.slice(0, 2).join(" • ")}
                  </div>
                )}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Link to="/students?view=DEADLINE_ESCALATIONS&triage=OVERDUE&filter=ALL" className="px-3 py-1.5 rounded-full bg-white border border-red-200 text-red-700 hover:bg-red-50">
              Deadline Escalations
            </Link>
            <Link to="/students?view=APPROVAL_BOTTLENECKS&triage=PENDING_APPROVAL&filter=ALL" className="px-3 py-1.5 rounded-full bg-white border border-amber-200 text-amber-700 hover:bg-amber-50">
              Approval Bottlenecks
            </Link>
            <Link to="/students?view=ATTENDANCE_WATCH&triage=NO_SHOWS&filter=ALL" className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
              Attendance Watch
            </Link>
          </div>
        </div>
      )}

      {interventions.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <div className="text-sm font-semibold text-gray-900">Recent Outreach & Intervention History</div>
              <p className="text-sm text-gray-500 mt-1">See who was contacted, from which queue, who sent it, and whether students showed follow-up activity after outreach.</p>
            </div>
            <Link to="/students?view=ADMIN_MORNING&triage=URGENT&filter=ALL" className="text-sm font-medium text-blue-600 hover:text-blue-800">
              Open roster workflow
            </Link>
          </div>
          <div className="space-y-3">
            {interventions.map((campaign) => (
              <div key={campaign.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">{campaign.subject || "School outreach"}</span>
                      {campaign.priority && <span className="rounded bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Priority</span>}
                      {campaign.queueType && <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">{campaign.queueType.replaceAll("_", " ")}</span>}
                    </div>
                    <div className="text-xs text-gray-500">
                      Sent by {campaign.actor.name} · {new Date(campaign.createdAt).toLocaleString()} · {campaign.recipientCount} student{campaign.recipientCount === 1 ? "" : "s"}
                    </div>
                    {campaign.bodyPreview && <div className="mt-2 text-sm text-gray-600 line-clamp-2">{campaign.bodyPreview}</div>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs min-w-[180px]">
                    <div className="rounded bg-gray-50 p-2">
                      <div className="text-gray-500">Follow-up</div>
                      <div className="font-semibold text-gray-900">{campaign.followUpCount}/{campaign.recipientCount}</div>
                    </div>
                    <div className="rounded bg-gray-50 p-2">
                      <div className="text-gray-500">View</div>
                      <div className="font-semibold text-gray-900">{campaign.savedView ? campaign.savedView.replaceAll("_", " ") : "Direct"}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {reminderMessage && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {reminderMessage}
        </div>
      )}

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

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 mb-6">
        {[
          { to: "/cohorts", label: "View All Cohorts", count: cohorts.length },
          { to: "/beneficiaries", label: "Partners Approved", count: beneficiaries.length },
          { to: "/students", label: "Student Roster", count: students.length },
          { to: "/cohorts", label: "Pending Invites", count: pendingInvites },
          { to: "/students/on-track", label: "On-Track", count: cohorts.reduce((s, c) => s + (c.studentCount - c.atRiskCount), 0) },
          { to: "/students/off-track", label: "Off-Track", count: totalAtRisk },
        ].map((b) => (
          <Link
            key={`${b.to}-${b.label}`}
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

      <div className="mb-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-gray-900">Messages & Alerts</h2>
              <p className="text-sm text-gray-500 mt-1">
                Notifications, reminder runs, and school-wide communication now live here instead of a separate top-level tab.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/messages?tab=notifications"
                className="px-3.5 py-[7px] bg-white border border-gray-200 rounded-md text-[13px] font-medium text-gray-700 hover:bg-gray-50"
              >
                Open Inbox
              </Link>
              <button
                onClick={handleRunReminders}
                disabled={runningReminders}
                className="px-3.5 py-[7px] bg-blue-600 text-white rounded-md text-[13px] font-medium hover:opacity-85 disabled:opacity-50"
              >
                {runningReminders ? "Running..." : "Run Reminders"}
              </button>
            </div>
          </div>
          {notifications.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
              No recent alerts.
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 4).map((notification) => (
                <Link
                  key={notification.id}
                  to={getNotificationHref(notification)}
                  className={`block rounded-lg border px-4 py-3 transition-colors hover:border-blue-300 hover:bg-blue-50 ${
                    notification.read ? "border-gray-200" : "border-blue-200 bg-blue-50/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{notification.title}</div>
                      <div className="text-sm text-gray-600 mt-0.5">{notification.body}</div>
                    </div>
                    <div className="shrink-0 text-xs text-gray-400">
                      {new Date(notification.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-[15px] font-semibold text-gray-900">Communication Shortcuts</h2>
          <div className="mt-4 space-y-3">
            <Link to="/messages?tab=inbox" className="block rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50">
              <div className="text-sm font-medium text-gray-900">Direct messages</div>
              <div className="text-sm text-gray-500 mt-1">Read school conversations and send follow-ups.</div>
            </Link>
            <Link to="/messages?tab=notifications" className="block rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50">
              <div className="text-sm font-medium text-gray-900">Notification feed</div>
              <div className="text-sm text-gray-500 mt-1">Review automated alerts, reminders, and review notices.</div>
            </Link>
            <Link to="/messages" className="block rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50">
              <div className="text-sm font-medium text-gray-900">Announcement center</div>
              <div className="text-sm text-gray-500 mt-1">Broadcast cohort or school-wide messages when needed.</div>
            </Link>
          </div>
        </div>
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
              <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-[18px] hover:border-blue-300 transition-colors">
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
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/cohorts/${c.id}`}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-[12.5px] font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Manage Cohort
                  </Link>
                  {user?.schoolId && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDownload(`/schools/${user.schoolId}/export?cohortId=${c.id}`, `${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-students.csv`, `students-${c.id}`)}
                        disabled={downloadingReport !== null}
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-[12.5px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {downloadingReport === `students-${c.id}` ? "Exporting..." : "Students CSV"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(`/schools/${user.schoolId}/students/at-risk?cohortId=${c.id}&format=csv`, `${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-at-risk.csv`, `at-risk-${c.id}`)}
                        disabled={downloadingReport !== null}
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-[12.5px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {downloadingReport === `at-risk-${c.id}` ? "Exporting..." : "At-Risk CSV"}
                      </button>
                    </>
                  )}
                </div>
              </div>
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
