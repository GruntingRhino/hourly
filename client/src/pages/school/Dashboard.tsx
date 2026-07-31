import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../../lib/api";
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
  const schoolOnboardingComplete = user?.school?.onboardingComplete ?? false;
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
    try { await api.put("/schools/onboarding", {}); } catch { /* Local dismissal remains valid if persistence fails. */ }
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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to export CSV report."));
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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to run reminders."));
    } finally {
      setRunningReminders(false);
    }
  };

  if (loading) return <div className="text-[var(--text-faint)]">Loading dashboard...</div>;
  if (error) return <div className="p-4 bg-[var(--er-bg)] border border-[var(--er-b)] rounded-[3px] text-[var(--er-t)] text-sm">{error}</div>;

  // Aggregate school-wide stats from the live student roster so unassigned students
  // are counted consistently with the roster, triage queue, and reports export.
  const totalStudents = students.length;
  const totalHours = students.reduce((sum, student) => sum + (student.approvedHours || 0), 0);
  const totalCompleted = students.filter((student) => student.status === "COMPLETED").length;
  const totalAtRisk = students.filter((student) => student.status === "AT_RISK").length;
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
          <div className="mb-6 bg-[var(--surface)] border border-[var(--in-b)] rounded-[3px] overflow-hidden">
            {/* Progress bar */}
            <div className="h-1 bg-[var(--action-lt)]">
              <div className="h-1 bg-[var(--action)] transition-all duration-500"
                style={{ width: `${((onboardingStep + 1) / STEPS.length) * 100}%` }} />
            </div>
            <div className="p-5">
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-3">
                {STEPS.map((s, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      i < onboardingStep ? "bg-[var(--action)] text-white" :
                      i === onboardingStep ? "bg-[var(--navy)] text-white ring-2 ring-blue-200" :
                      "bg-[var(--surface-alt)] text-[var(--text-faint)]"
                    }`}>{i < onboardingStep ? "✓" : s.num}</div>
                    {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < onboardingStep ? "bg-blue-400" : "bg-[var(--border)]"}`} />}
                  </div>
                ))}
                <span className="ml-2 text-xs text-[var(--text-faint)]">Step {step.num} of {STEPS.length}</span>
              </div>
              <div className="font-semibold text-[var(--text)] mb-1">{step.title}</div>
              <p className="text-sm text-[var(--text-sec)] mb-4">{step.body}</p>
              <div className="flex flex-wrap items-center gap-3">
                {step.cta && (
                  <Link to={step.cta} className="px-4 py-2 bg-[var(--navy)] text-white rounded-[3px] text-sm font-medium hover:bg-[var(--navy)] transition-colors">
                    {step.ctaLabel}
                  </Link>
                )}
                <button
                  onClick={() => isLast ? handleDismissOnboarding() : setOnboardingStep(s => s + 1)}
                  className="px-4 py-2 bg-[var(--surface-alt)] text-[var(--text-sec)] rounded-[3px] text-sm font-medium hover:bg-[var(--border)] transition-colors"
                >
                  {isLast ? "Finish setup" : step.cta ? "Skip this step →" : "Get Started →"}
                </button>
                <button onClick={handleDismissOnboarding} className="text-xs text-[var(--text-faint)] hover:text-[var(--text-sec)] ml-auto">
                  Dismiss setup
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="text-[12px] mb-1" style={{ color: "var(--text-faint)" }}>{user?.school?.name || "School"}</div>
          <h1 className="text-[20px] font-semibold" style={{ color: "var(--text)" }}>{isTeacher ? "Teacher Dashboard" : "Dashboard"}</h1>
        </div>
        <div className="flex gap-2">
          {user?.schoolId && (
            <>
              <button
                onClick={() => handleDownload(`/schools/${user.schoolId}/export`, "all-students.csv", "students")}
                disabled={downloadingReport !== null}
                className="px-4 py-[7px] bg-[var(--surface)] border border-[var(--border)] rounded-[2px] text-[13.5px] font-medium text-[var(--text-sec)] hover:bg-[var(--bg)] disabled:opacity-50"
              >
                {downloadingReport === "students" ? "Exporting..." : "Export CSV"}
              </button>
              <button
                onClick={() => handleDownload(`/schools/${user.schoolId}/students/at-risk?format=csv`, "at-risk-students.csv", "at-risk")}
                disabled={downloadingReport !== null}
                className="px-4 py-[7px] bg-[var(--surface)] border border-[var(--border)] rounded-[2px] text-[13.5px] font-medium text-[var(--text-sec)] hover:bg-[var(--bg)] disabled:opacity-50"
              >
                {downloadingReport === "at-risk" ? "Exporting..." : "At-Risk CSV"}
              </button>
            </>
          )}
          <button onClick={handleExportPdf} className="px-4 py-[7px] bg-[var(--surface)] border border-[var(--border)] rounded-[2px] text-[13.5px] font-medium text-[var(--text-sec)] hover:bg-[var(--bg)]">
            Export PDF
          </button>
          <Link to="/cohorts" className="px-4 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-[13.5px] font-medium hover:opacity-85">
            {isTeacher ? "View Assigned Cohorts" : "Manage Cohorts"}
          </Link>
        </div>
      </div>

      {/* School-wide stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 mb-6" style={{ border: "1px solid var(--border)", borderRadius: 3, overflow: "hidden" }}>
        {[
          { label: "Total Students", value: String(totalStudents), sub: null, color: "var(--text)" },
          { label: "Total Hours", value: totalHours === 0 ? "0" : totalHours.toFixed(1), sub: "verified", color: "var(--action)" },
          { label: "Goal Reached", value: String(totalCompleted), sub: `of ${totalStudents} students`, color: totalCompleted > 0 ? "var(--ok-t)" : "var(--text)" },
          { label: "At Risk", value: String(totalAtRisk), sub: "deadline, pace, or attendance", color: totalAtRisk > 0 ? "var(--er-t)" : "var(--text)" },
        ].map((stat, i) => (
          <div key={stat.label} className={`px-5 py-4 ${i < 3 ? "border-r" : ""}`} style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-[.07em] mb-2" style={{ color: "var(--text-faint)" }}>{stat.label}</div>
            <div className="text-[28px] font-bold leading-none" style={{ color: stat.color }}>{stat.value}</div>
            {stat.sub && <div className="text-[12px] mt-1" style={{ color: "var(--text-faint)" }}>{stat.sub}</div>}
          </div>
        ))}
      </div>

      {topAtRisk.length > 0 && (
        <div className="mb-6 rounded-[3px] border border-[var(--er-b)] p-5" style={{ background: "var(--er-bg)" }}>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <div className="text-sm font-semibold text-[var(--er-t)] mb-1">Administrator Intervention Center</div>
              <h2 className="text-lg font-bold text-[var(--text)]">Students who need action now</h2>
              <p className="text-sm text-[var(--text-sec)] mt-1">Prioritized for admins and teachers: overdue deadlines, approval bottlenecks, and attendance concerns.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/groups?view=ADMIN_MORNING&triage=URGENT&filter=ALL" className="px-3 py-2 bg-[var(--er-t)] text-white rounded-[2px] text-sm font-medium hover:bg-red-700">
                Open Triage Queue
              </Link>
              {schoolId && (
                <button
                  onClick={() => handleDownload(`/schools/${schoolId}/students/at-risk?format=csv`, "at-risk-priority-queue.csv", "admin-at-risk")}
                  disabled={downloadingReport !== null}
                  className="px-3 py-2 bg-[var(--surface)] border border-[var(--er-b)] rounded-[2px] text-sm font-medium text-[var(--er-t)] hover:bg-[var(--er-bg)] disabled:opacity-50"
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
                to={`/groups?view=ADMIN_MORNING&triage=URGENT&filter=AT_RISK&student=${student.id}`}
                className="rounded-[3px] border border-white/80 bg-[var(--surface)]/90 p-3 hover:border-[var(--er-b)] hover:bg-[var(--surface)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">{student.name}</div>
                    <div className="text-xs text-[var(--text-faint)] mt-0.5">{student.cohort || "No cohort"}</div>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${student.riskLevel === "HIGH" ? "bg-[var(--er-bg)] text-[var(--er-t)]" : student.riskLevel === "MEDIUM" ? "bg-amber-100 text-[var(--wn-t)]" : "bg-[var(--in-bg)] text-[var(--navy)]"}`}>
                    {student.riskLevel}
                  </span>
                </div>
                <div className="mt-3 text-xs text-[var(--text-sec)] space-y-1">
                  <div>{student.approvedHours.toFixed(1)}h approved · {student.remainingHours.toFixed(1)}h left</div>
                  {student.daysToDeadline != null && <div>{student.daysToDeadline < 0 ? `${Math.abs(student.daysToDeadline)}d overdue` : `${student.daysToDeadline}d to deadline`}</div>}
                  {student.pendingHours > 0 && <div>{student.pendingHours.toFixed(1)}h pending approval</div>}
                  {student.noShowCount > 0 && <div>{student.noShowCount} no-show{student.noShowCount === 1 ? "" : "s"}</div>}
                </div>
                {!!student.riskReasons?.length && (
                  <div className="mt-3 text-[11px] text-[var(--text-faint)] line-clamp-3">
                    {student.riskReasons.slice(0, 2).join(" • ")}
                  </div>
                )}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Link to="/groups?view=DEADLINE_ESCALATIONS&triage=OVERDUE&filter=ALL" className="px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--er-b)] text-[var(--er-t)] hover:bg-[var(--er-bg)]">
              Deadline Escalations
            </Link>
            <Link to="/groups?view=APPROVAL_BOTTLENECKS&triage=PENDING_APPROVAL&filter=ALL" className="px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--wn-b)] text-[var(--wn-t)] hover:bg-[var(--wn-bg)]">
              Approval Bottlenecks
            </Link>
            <Link to="/groups?view=ATTENDANCE_WATCH&triage=NO_SHOWS&filter=ALL" className="px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-sec)] hover:bg-[var(--bg)]">
              Attendance Watch
            </Link>
          </div>
        </div>
      )}

      {interventions.length > 0 && (
        <div className="mb-6 rounded-[3px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <div className="text-sm font-semibold text-[var(--text)]">Recent Outreach & Intervention History</div>
              <p className="text-sm text-[var(--text-faint)] mt-1">See who was contacted, from which queue, who sent it, and whether students showed follow-up activity after outreach.</p>
            </div>
            <Link to="/groups?view=ADMIN_MORNING&triage=URGENT&filter=ALL" className="text-sm font-medium text-[var(--action)] underline underline-offset-2 hover:text-[var(--navy)]">
              Open roster workflow
            </Link>
          </div>
          <div className="space-y-3">
            {interventions.map((campaign) => (
              <div key={campaign.id} className="rounded-[3px] border border-[var(--border)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-[var(--text)]">{campaign.subject || "School outreach"}</span>
                      {campaign.priority && <span className="rounded bg-[var(--er-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--er-t)]">Priority</span>}
                      {campaign.queueType && <span className="rounded bg-[var(--action-lt)] px-2 py-0.5 text-[11px] text-[var(--navy)]">{campaign.queueType.replaceAll("_", " ")}</span>}
                    </div>
                    <div className="text-xs text-[var(--text-faint)]">
                      Sent by {campaign.actor.name} · {new Date(campaign.createdAt).toLocaleString()} · {campaign.recipientCount} student{campaign.recipientCount === 1 ? "" : "s"}
                    </div>
                    {campaign.bodyPreview && <div className="mt-2 text-sm text-[var(--text-sec)] line-clamp-2">{campaign.bodyPreview}</div>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs min-w-[180px]">
                    <div className="rounded bg-[var(--bg)] p-2">
                      <div className="text-[var(--text-faint)]">Follow-up</div>
                      <div className="font-semibold text-[var(--text)]">{campaign.followUpCount}/{campaign.recipientCount}</div>
                    </div>
                    <div className="rounded bg-[var(--bg)] p-2">
                      <div className="text-[var(--text-faint)]">View</div>
                      <div className="font-semibold text-[var(--text)]">{campaign.savedView ? campaign.savedView.replaceAll("_", " ") : "Direct"}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {reminderMessage && (
        <div className="mb-6 rounded-[3px] border border-[var(--ok-b)] bg-[var(--ok-bg)] px-4 py-3 text-sm text-[var(--ok-t)]">
          {reminderMessage}
        </div>
      )}

      {totalStudents === 0 && (
        <div className="mb-8 rounded-[3px] border border-[var(--wn-b)] bg-[var(--wn-bg)] p-5">
          <div className="font-semibold text-[var(--wn-t)] mb-2">This school is not activated yet</div>
          <div className="text-sm text-[var(--wn-t)] mb-4">
            You have successfully claimed ownership for your school. Complete these three steps to start tracking volunteer hours for your students.
          </div>
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <Link to="/settings" className="rounded-[3px] border border-[var(--wn-b)] bg-[var(--surface)] p-3 hover:border-amber-300">
              <div className="font-medium text-[var(--text)]">1. Confirm service rules</div>
              <div className="text-[var(--text-sec)] mt-1">Required hours, dates, self-submission policy, and category caps.</div>
            </Link>
            <Link to="/beneficiaries" className="rounded-[3px] border border-[var(--wn-b)] bg-[var(--surface)] p-3 hover:border-amber-300">
              <div className="font-medium text-[var(--text)]">2. Add partners</div>
              <div className="text-[var(--text-sec)] mt-1">Approve at least one beneficiary so students have valid places to earn hours.</div>
            </Link>
            <Link to="/cohorts" className="rounded-[3px] border border-[var(--wn-b)] bg-[var(--surface)] p-3 hover:border-amber-300">
              <div className="font-medium text-[var(--text)]">3. Import students</div>
              <div className="text-[var(--text-sec)] mt-1">Create a cohort, import a CSV, then publish invitations and verify the roster.</div>
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
            className="flex items-center justify-between px-3.5 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-[3px] text-sm text-[var(--text-sec)] hover:bg-[var(--bg)] transition-colors"
          >
            <span>{b.label}</span>
            {b.count != null && (
              <span className="ml-2 bg-[var(--surface-alt)] text-[var(--text-faint)] rounded-full text-[11.5px] font-semibold px-2 py-0.5">{b.count}</span>
            )}
          </Link>
        ))}
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--text)]">Messages & Alerts</h2>
              <p className="text-sm text-[var(--text-faint)] mt-1">
                Notifications, reminder runs, and school-wide communication now live here instead of a separate top-level tab.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/messages?tab=notifications"
                className="px-3.5 py-[7px] bg-[var(--surface)] border border-[var(--border)] rounded-[2px] text-[13px] font-medium text-[var(--text-sec)] hover:bg-[var(--bg)]"
              >
                Open Inbox
              </Link>
              <button
                onClick={handleRunReminders}
                disabled={runningReminders}
                className="px-3.5 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium hover:opacity-85 disabled:opacity-50"
              >
                {runningReminders ? "Running..." : "Run Reminders"}
              </button>
            </div>
          </div>
          {notifications.length === 0 ? (
            <div className="rounded-[3px] border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-faint)]">
              No recent alerts.
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 4).map((notification) => (
                <Link
                  key={notification.id}
                  to={getNotificationHref(notification)}
                  className={`block rounded-[3px] border px-4 py-3 transition-colors hover:border-[var(--action)] hover:bg-[var(--action-lt)] ${
                    notification.read ? "border-[var(--border)]" : "border-[var(--in-b)] bg-[var(--action-lt)]/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-[var(--text)]">{notification.title}</div>
                      <div className="text-sm text-[var(--text-sec)] mt-0.5">{notification.body}</div>
                    </div>
                    <div className="shrink-0 text-xs text-[var(--text-faint)]">
                      {new Date(notification.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-5">
          <h2 className="text-[15px] font-semibold text-[var(--text)]">Communication Shortcuts</h2>
          <div className="mt-4 space-y-3">
            <Link to="/messages?tab=inbox" className="block rounded-[3px] border border-[var(--border)] px-4 py-3 hover:bg-[var(--bg)]">
              <div className="text-sm font-medium text-[var(--text)]">Direct messages</div>
              <div className="text-sm text-[var(--text-faint)] mt-1">Read school conversations and send follow-ups.</div>
            </Link>
            <Link to="/messages?tab=notifications" className="block rounded-[3px] border border-[var(--border)] px-4 py-3 hover:bg-[var(--bg)]">
              <div className="text-sm font-medium text-[var(--text)]">Notification feed</div>
              <div className="text-sm text-[var(--text-faint)] mt-1">Review automated alerts, reminders, and review notices.</div>
            </Link>
            <Link to="/messages" className="block rounded-[3px] border border-[var(--border)] px-4 py-3 hover:bg-[var(--bg)]">
              <div className="text-sm font-medium text-[var(--text)]">Announcement center</div>
              <div className="text-sm text-[var(--text-faint)] mt-1">Broadcast cohort or school-wide messages when needed.</div>
            </Link>
          </div>
        </div>
      </div>

      {/* Pending invites alert */}
      {pendingInvites > 0 && (
        <div className="mb-6 p-3 bg-[var(--action-lt)] border border-[var(--in-b)] rounded-[3px] flex justify-between items-center">
          <span className="text-sm text-[var(--navy)]">{pendingInvites} student invitation{pendingInvites !== 1 ? "s" : ""} pending across cohorts.</span>
          <Link to="/cohorts" className="px-3 py-1.5 bg-[var(--action)] text-white rounded text-xs hover:bg-[var(--navy)]">
            View Cohorts
          </Link>
        </div>
      )}

      {/* Cohorts list */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-[15px] font-semibold text-[var(--text)]">Cohorts</h2>
          <Link to="/cohorts" className="text-[13px] text-[var(--action)] hover:opacity-75">Manage →</Link>
        </div>

        {cohorts.length === 0 ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6 text-center text-[var(--text-faint)] text-sm">
            No cohorts yet.{" "}
            <Link to="/cohorts" className="text-[var(--action)] underline underline-offset-2 hover:opacity-85">Create your first cohort</Link> to get started.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {cohorts.map((c) => (
              <div key={c.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-[18px] hover:border-[var(--action)] transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2.5">
                    <div>
                      <div className="font-bold text-[15px] text-[var(--text)]">{c.name}</div>
                      <div className="text-[12.5px] text-[var(--text-faint)]">{c.requiredHours}h goal</div>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-[2px] uppercase tracking-wide border" style={c.status === "PUBLISHED"
                      ? { background: "var(--navy)", color: "#fff", borderColor: "transparent" }
                      : { background: "var(--wn-bg)", color: "var(--wn-t)", borderColor: "var(--wn-b)" }
                    }>
                      {c.status.toLowerCase()}
                    </span>
                  </div>
                  <span className="text-[12px] text-[var(--text-faint)] font-medium">{c.invitationsPending > 0 ? `${c.invitationsPending} pending` : ""}</span>
                </div>

                <div className="flex gap-6 mb-3">
                  {[
                    { label: "Students", value: c.studentCount, color: "text-[var(--text)]" },
                    { label: "Avg Hours", value: c.studentCount > 0 ? `${(c.totalHours / c.studentCount).toFixed(1)}h` : "0h", color: "text-[var(--action)]" },
                    { label: "On-Track", value: c.studentCount - c.atRiskCount, color: "text-[var(--ok-t)]" },
                    { label: "Off-Track", value: c.atRiskCount, color: c.atRiskCount > 0 ? "text-[var(--er-t)]" : "text-[var(--text-faint)]" },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                      <div className="text-[11.5px] text-[var(--text-faint)]">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {c.studentCount > 0 && (
                  <>
                    <div className="w-full rounded-full h-[5px] border border-[var(--border)]" style={{ background: "var(--surface-alt)" }}>
                      <div
                        className="h-[5px] rounded-full"
                        style={{ width: `${c.completionPercentage}%`, background: c.completionPercentage >= 80 ? "var(--ok-t)" : c.completionPercentage >= 50 ? "var(--wn-t)" : "var(--er-t)" }}
                      />
                    </div>
                    <div className="text-[11.5px] text-[var(--text-faint)] mt-1">{c.completionPercentage}% completed {c.requiredHours}h goal</div>
                  </>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/cohorts/${c.id}`}
                    className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-[2px] text-[12.5px] font-medium text-[var(--text-sec)] hover:bg-[var(--bg)]"
                  >
                    Manage Cohort
                  </Link>
                  {user?.schoolId && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDownload(`/schools/${user.schoolId}/export?cohortId=${c.id}`, `${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-students.csv`, `students-${c.id}`)}
                        disabled={downloadingReport !== null}
                        className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-[2px] text-[12.5px] font-medium text-[var(--text-sec)] hover:bg-[var(--bg)] disabled:opacity-50"
                      >
                        {downloadingReport === `students-${c.id}` ? "Exporting..." : "Students CSV"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(`/schools/${user.schoolId}/students/at-risk?cohortId=${c.id}&format=csv`, `${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-at-risk.csv`, `at-risk-${c.id}`)}
                        disabled={downloadingReport !== null}
                        className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-[2px] text-[12.5px] font-medium text-[var(--text-sec)] hover:bg-[var(--bg)] disabled:opacity-50"
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
            <h2 className="text-[15px] font-semibold text-[var(--text)]">Student Roster</h2>
            <Link to="/students" className="text-[13px] text-[var(--action)] hover:opacity-75">View All ({students.length}) →</Link>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] overflow-hidden">
            <table className="w-full text-[13.5px]">
              <thead className="bg-[var(--bg)]">
                <tr>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wide border-b border-[var(--border)]">Name</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wide border-b border-[var(--border)] hidden sm:table-cell">Cohort</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wide border-b border-[var(--border)]">Hours</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wide border-b border-[var(--border)]">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...students]
                  .sort((a, b) => (a.approvedHours / a.requiredHours) - (b.approvedHours / b.requiredHours))
                  .slice(0, 8)
                  .map((s) => (
                    <tr key={s.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)] transition-colors">
                      <td className="px-3 py-2.5 font-semibold text-[var(--text)]">{s.name}</td>
                      <td className="px-3 py-2.5 text-[var(--text-faint)] text-[12px] hidden sm:table-cell">{s.cohortName}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="font-medium text-[var(--text-sec)]">{s.approvedHours.toFixed(1)}</span>
                        <span className="text-[var(--text-faint)] text-[12px]">/{s.requiredHours}h</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-[2px] uppercase tracking-wide border" style={
                          s.status === "COMPLETED" || s.status === "ON_TRACK"
                            ? { background: "var(--ok-bg)", color: "var(--ok-t)", borderColor: "var(--ok-b)" }
                            : { background: "var(--er-bg)", color: "var(--er-t)", borderColor: "var(--er-b)" }
                        }>{s.status === "COMPLETED" ? "Completed" : s.status === "ON_TRACK" ? "On Track" : "At Risk"}</span>
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
            <Link to="/beneficiaries" className="text-sm text-[var(--action)] hover:underline">Manage →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {beneficiaries.slice(0, 6).map((b) => (
              <div key={b.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-3">
                <div className="text-sm font-medium">{toTitleCase(b.name)}</div>
                {b.category && <div className="text-xs text-[var(--text-faint)] mt-0.5">{b.category}</div>}
              </div>
            ))}
          </div>
          {beneficiaries.length > 6 && (
            <Link to="/beneficiaries" className="block mt-2 text-sm text-[var(--action)] hover:underline">
              View all {beneficiaries.length} partners →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
