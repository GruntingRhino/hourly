import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";

type Tab = "monitoring" | "onboarding" | "support" | "rollback" | "bugs";

interface ReminderSummary {
  schoolId: string;
  schoolName: string;
  deadlineReminders: number;
  behindAlerts: number;
  adminAlerts: number;
  pendingReviewCount: number;
  atRiskStudents: number;
}

interface LaunchWorkspace {
  school: {
    id: string;
    name: string;
    requiredHours: number;
    serviceStartDate: string | null;
    serviceEndDate: string | null;
    hasLocation: boolean;
  };
  plan: {
    onboardingInstructions: {
      overview: string;
      nextMilestone: string;
    };
    supportProcess: {
      ownerName: string;
      ownerEmail: string;
      responseTimeHours: number;
      escalationAfterHours: number;
      intakeChannels: string[];
      notes: string;
    };
    rollbackPlan: {
      ownerName: string;
      trigger: string;
      freezeAction: string;
      rollbackSteps: string;
      restoreCheck: string;
      lastDrillAt: string;
    };
    firstUserMonitoring: {
      launchStartDate: string;
      checkCadence: "DAILY" | "TWICE_DAILY" | "WEEKDAYS";
      activeStudentTarget: number;
      watchList: string[];
      notes: string;
    };
  };
  summary: {
    readiness: "NOT_READY" | "PILOTING" | "LIVE" | "ATTENTION";
    headline: string;
    detail: string;
  };
  metrics: {
    approvedPartners: number;
    pendingPartners: number;
    totalCohorts: number;
    publishedCohorts: number;
    invitedStudents: number;
    acceptedInvites: number;
    pendingInvites: number;
    enrolledStudents: number;
    studentsWithHours: number;
    completedStudents: number;
    atRiskStudents: number;
    pendingReviewCount: number;
    pendingSelfSubmissions: number;
    pendingLegacyVerifications: number;
    noShowCount: number;
    totalApprovedHours: number;
    totalPendingHours: number;
    openBugCount: number;
    criticalBugCount: number;
  };
  checklist: Array<{
    id: string;
    title: string;
    description: string;
    done: boolean;
    actionHref: string;
    actionLabel: string;
  }>;
  bugs: LaunchBug[];
}

interface LaunchBug {
  id: string;
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "INVESTIGATING" | "BLOCKED" | "FIXED" | "MONITORING" | "CLOSED";
  area: string;
  source: string;
  ownerName: string;
  workaround: string;
  nextAction: string;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OnboardingForm {
  overview: string;
  nextMilestone: string;
}

interface SupportForm {
  ownerName: string;
  ownerEmail: string;
  responseTimeHours: string;
  escalationAfterHours: string;
  intakeChannels: string;
  notes: string;
}

interface RollbackForm {
  ownerName: string;
  trigger: string;
  freezeAction: string;
  rollbackSteps: string;
  restoreCheck: string;
  lastDrillAt: string;
}

interface MonitoringForm {
  launchStartDate: string;
  checkCadence: "DAILY" | "TWICE_DAILY" | "WEEKDAYS";
  activeStudentTarget: string;
  watchList: string;
  notes: string;
}

interface BugCreateForm {
  title: string;
  description: string;
  severity: LaunchBug["severity"];
  area: string;
  source: string;
  ownerName: string;
  workaround: string;
  nextAction: string;
}

interface BugEditForm extends BugCreateForm {
  status: LaunchBug["status"];
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function summaryClasses(readiness: LaunchWorkspace["summary"]["readiness"]): string {
  switch (readiness) {
    case "LIVE":
      return "border-green-200 bg-green-50 text-green-900";
    case "ATTENTION":
      return "border-red-200 bg-red-50 text-red-900";
    case "PILOTING":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      return "border-blue-200 bg-blue-50 text-blue-900";
  }
}

function badgeClasses(value: string): string {
  switch (value) {
    case "CRITICAL":
    case "BLOCKED":
      return "bg-red-50 text-red-700";
    case "HIGH":
    case "OPEN":
    case "ATTENTION":
      return "bg-amber-50 text-amber-700";
    case "FIXED":
    case "LIVE":
      return "bg-green-50 text-green-700";
    case "MONITORING":
    case "INVESTIGATING":
    case "PILOTING":
      return "bg-blue-50 text-blue-700";
    case "NOT_READY":
      return "bg-blue-50 text-blue-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function MetricCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {subtext && <div className="mt-1 text-xs text-gray-400">{subtext}</div>}
    </div>
  );
}

export default function LaunchCenter() {
  const [tab, setTab] = useState<Tab>("monitoring");
  const [workspace, setWorkspace] = useState<LaunchWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [onboardingForm, setOnboardingForm] = useState<OnboardingForm>({
    overview: "",
    nextMilestone: "",
  });
  const [supportForm, setSupportForm] = useState<SupportForm>({
    ownerName: "",
    ownerEmail: "",
    responseTimeHours: "24",
    escalationAfterHours: "48",
    intakeChannels: "",
    notes: "",
  });
  const [rollbackForm, setRollbackForm] = useState<RollbackForm>({
    ownerName: "",
    trigger: "",
    freezeAction: "",
    rollbackSteps: "",
    restoreCheck: "",
    lastDrillAt: "",
  });
  const [monitoringForm, setMonitoringForm] = useState<MonitoringForm>({
    launchStartDate: "",
    checkCadence: "DAILY",
    activeStudentTarget: "10",
    watchList: "",
    notes: "",
  });

  const [onboardingMessage, setOnboardingMessage] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [rollbackMessage, setRollbackMessage] = useState("");
  const [monitoringMessage, setMonitoringMessage] = useState("");
  const [bugMessage, setBugMessage] = useState("");

  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [savingSupport, setSavingSupport] = useState(false);
  const [savingRollback, setSavingRollback] = useState(false);
  const [savingMonitoring, setSavingMonitoring] = useState(false);

  const [runningReminders, setRunningReminders] = useState(false);
  const [latestReminderSummary, setLatestReminderSummary] = useState<ReminderSummary | null>(null);

  const [createBugForm, setCreateBugForm] = useState<BugCreateForm>({
    title: "",
    description: "",
    severity: "MEDIUM",
    area: "",
    source: "",
    ownerName: "",
    workaround: "",
    nextAction: "",
  });
  const [creatingBug, setCreatingBug] = useState(false);
  const [selectedBugId, setSelectedBugId] = useState<string>("");
  const [bugEditForm, setBugEditForm] = useState<BugEditForm>({
    title: "",
    description: "",
    severity: "MEDIUM",
    status: "OPEN",
    area: "",
    source: "",
    ownerName: "",
    workaround: "",
    nextAction: "",
  });
  const [savingBug, setSavingBug] = useState(false);

  const selectedBug = useMemo(
    () => workspace?.bugs.find((bug) => bug.id === selectedBugId) ?? null,
    [workspace, selectedBugId]
  );

  const loadWorkspace = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<LaunchWorkspace>("/schools/launch");
      setWorkspace(data);
    } catch (err: any) {
      setError(err.message || "Failed to load launch center.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, []);

  useEffect(() => {
    if (!workspace) return;

    setOnboardingForm({
      overview: workspace.plan.onboardingInstructions.overview,
      nextMilestone: workspace.plan.onboardingInstructions.nextMilestone,
    });
    setSupportForm({
      ownerName: workspace.plan.supportProcess.ownerName,
      ownerEmail: workspace.plan.supportProcess.ownerEmail,
      responseTimeHours: String(workspace.plan.supportProcess.responseTimeHours),
      escalationAfterHours: String(workspace.plan.supportProcess.escalationAfterHours),
      intakeChannels: workspace.plan.supportProcess.intakeChannels.join(", "),
      notes: workspace.plan.supportProcess.notes,
    });
    setRollbackForm({
      ownerName: workspace.plan.rollbackPlan.ownerName,
      trigger: workspace.plan.rollbackPlan.trigger,
      freezeAction: workspace.plan.rollbackPlan.freezeAction,
      rollbackSteps: workspace.plan.rollbackPlan.rollbackSteps,
      restoreCheck: workspace.plan.rollbackPlan.restoreCheck,
      lastDrillAt: workspace.plan.rollbackPlan.lastDrillAt,
    });
    setMonitoringForm({
      launchStartDate: workspace.plan.firstUserMonitoring.launchStartDate,
      checkCadence: workspace.plan.firstUserMonitoring.checkCadence,
      activeStudentTarget: String(workspace.plan.firstUserMonitoring.activeStudentTarget),
      watchList: workspace.plan.firstUserMonitoring.watchList.join(", "),
      notes: workspace.plan.firstUserMonitoring.notes,
    });

    const firstBug = workspace.bugs[0];
    if (!selectedBugId && firstBug) {
      setSelectedBugId(firstBug.id);
    }
  }, [workspace]);

  useEffect(() => {
    if (!selectedBug) return;
    setBugEditForm({
      title: selectedBug.title,
      description: selectedBug.description,
      severity: selectedBug.severity,
      status: selectedBug.status,
      area: selectedBug.area,
      source: selectedBug.source,
      ownerName: selectedBug.ownerName,
      workaround: selectedBug.workaround,
      nextAction: selectedBug.nextAction,
    });
  }, [selectedBug]);

  const handleSaveOnboarding = async () => {
    setSavingOnboarding(true);
    setOnboardingMessage("");
    try {
      const data = await api.put<LaunchWorkspace>("/schools/launch", {
        onboardingInstructions: onboardingForm,
      });
      setWorkspace(data);
      setOnboardingMessage("Onboarding instructions saved.");
    } catch (err: any) {
      setOnboardingMessage(err.message || "Failed to save onboarding instructions.");
    } finally {
      setSavingOnboarding(false);
    }
  };

  const handleSaveSupport = async () => {
    setSavingSupport(true);
    setSupportMessage("");
    try {
      const data = await api.put<LaunchWorkspace>("/schools/launch", {
        supportProcess: {
          ownerName: supportForm.ownerName,
          ownerEmail: supportForm.ownerEmail,
          responseTimeHours: Number(supportForm.responseTimeHours) || 24,
          escalationAfterHours: Number(supportForm.escalationAfterHours) || 48,
          intakeChannels: splitCsv(supportForm.intakeChannels),
          notes: supportForm.notes,
        },
      });
      setWorkspace(data);
      setSupportMessage("Support process saved.");
    } catch (err: any) {
      setSupportMessage(err.message || "Failed to save support process.");
    } finally {
      setSavingSupport(false);
    }
  };

  const handleSaveRollback = async () => {
    setSavingRollback(true);
    setRollbackMessage("");
    try {
      const data = await api.put<LaunchWorkspace>("/schools/launch", {
        rollbackPlan: rollbackForm,
      });
      setWorkspace(data);
      setRollbackMessage("Rollback plan saved.");
    } catch (err: any) {
      setRollbackMessage(err.message || "Failed to save rollback plan.");
    } finally {
      setSavingRollback(false);
    }
  };

  const handleSaveMonitoring = async () => {
    setSavingMonitoring(true);
    setMonitoringMessage("");
    try {
      const data = await api.put<LaunchWorkspace>("/schools/launch", {
        firstUserMonitoring: {
          launchStartDate: monitoringForm.launchStartDate,
          checkCadence: monitoringForm.checkCadence,
          activeStudentTarget: Number(monitoringForm.activeStudentTarget) || 10,
          watchList: splitCsv(monitoringForm.watchList),
          notes: monitoringForm.notes,
        },
      });
      setWorkspace(data);
      setMonitoringMessage("Monitoring plan saved.");
    } catch (err: any) {
      setMonitoringMessage(err.message || "Failed to save monitoring plan.");
    } finally {
      setSavingMonitoring(false);
    }
  };

  const handleRunReminders = async () => {
    setRunningReminders(true);
    setMonitoringMessage("");
    try {
      const summary = await api.post<ReminderSummary | null>("/messages/reminders/run", {});
      setLatestReminderSummary(summary);
      setMonitoringMessage("Reminder cycle completed.");
      await loadWorkspace();
    } catch (err: any) {
      setMonitoringMessage(err.message || "Failed to run reminders.");
    } finally {
      setRunningReminders(false);
    }
  };

  const handleCreateBug = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingBug(true);
    setBugMessage("");
    try {
      const bug = await api.post<LaunchBug>("/schools/launch/bugs", createBugForm);
      setCreateBugForm({
        title: "",
        description: "",
        severity: "MEDIUM",
        area: "",
        source: "",
        ownerName: "",
        workaround: "",
        nextAction: "",
      });
      setSelectedBugId(bug.id);
      setBugMessage("Bug added to triage.");
      await loadWorkspace();
    } catch (err: any) {
      setBugMessage(err.message || "Failed to create bug.");
    } finally {
      setCreatingBug(false);
    }
  };

  const handleSaveBug = async () => {
    if (!selectedBug) return;
    setSavingBug(true);
    setBugMessage("");
    try {
      await api.put<LaunchBug>(`/schools/launch/bugs/${selectedBug.id}`, bugEditForm);
      setBugMessage("Bug triage entry saved.");
      await loadWorkspace();
    } catch (err: any) {
      setBugMessage(err.message || "Failed to save bug.");
    } finally {
      setSavingBug(false);
    }
  };

  const targetProgress = useMemo(() => {
    if (!workspace) return 0;
    const target = Number(monitoringForm.activeStudentTarget) || workspace.plan.firstUserMonitoring.activeStudentTarget;
    return Math.min(100, Math.round((workspace.metrics.studentsWithHours / Math.max(1, target)) * 100));
  }, [monitoringForm.activeStudentTarget, workspace]);

  if (loading) {
    return <div className="text-gray-500">Loading launch center...</div>;
  }

  if (error || !workspace) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error || "Launch center unavailable."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Launch Center</h1>
          <p className="mt-1 text-sm text-gray-500">
            Operational controls for onboarding, support, rollback, bug triage, and first-user monitoring.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/dashboard"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Dashboard
          </Link>
          <Link
            to="/messages"
            className="px-4 py-[7px] bg-blue-600 text-white rounded-md text-sm font-medium hover:opacity-85"
          >
            Messages
          </Link>
        </div>
      </div>

      <div className={`rounded-2xl border p-5 ${summaryClasses(workspace.summary.readiness)}`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(workspace.summary.readiness)}`}>
            {workspace.summary.readiness.replace("_", " ")}
          </span>
          <div className="font-semibold">{workspace.summary.headline}</div>
        </div>
        <div className="mt-2 text-sm opacity-90">{workspace.summary.detail}</div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {([
          ["monitoring", "Monitoring"],
          ["onboarding", "Onboarding"],
          ["support", "Support"],
          ["rollback", "Rollback"],
          ["bugs", "Bug Triage"],
        ] as Array<[Tab, string]>).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === value
                ? "border-blue-700 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "monitoring" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Approved Partners" value={String(workspace.metrics.approvedPartners)} subtext={`${workspace.metrics.pendingPartners} pending`} />
            <MetricCard label="Published Cohorts" value={`${workspace.metrics.publishedCohorts}/${workspace.metrics.totalCohorts}`} subtext="published / total" />
            <MetricCard label="Invited Students" value={String(workspace.metrics.invitedStudents)} subtext={`${workspace.metrics.pendingInvites} pending invites`} />
            <MetricCard label="Students With Hours" value={String(workspace.metrics.studentsWithHours)} subtext={`${workspace.metrics.enrolledStudents} enrolled`} />
            <MetricCard label="Pending Review" value={String(workspace.metrics.pendingReviewCount)} subtext={`${workspace.metrics.pendingSelfSubmissions} self-submissions`} />
            <MetricCard label="Open Bugs" value={String(workspace.metrics.openBugCount)} subtext={`${workspace.metrics.criticalBugCount} critical`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">First-user monitoring</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Watch the rollout funnel and keep the review queue small while the first student group goes live.
                  </p>
                </div>
                <button
                  onClick={handleRunReminders}
                  disabled={runningReminders}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {runningReminders ? "Running..." : "Run Reminders"}
                </button>
              </div>

              {monitoringMessage && (
                <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {monitoringMessage}
                </div>
              )}

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Launch Window</div>
                  <div className="mt-2 text-sm text-gray-700">
                    Start: <span className="font-medium">{formatDate(workspace.plan.firstUserMonitoring.launchStartDate)}</span>
                  </div>
                  <div className="mt-1 text-sm text-gray-700">
                    Cadence: <span className="font-medium">{workspace.plan.firstUserMonitoring.checkCadence.replace("_", " ")}</span>
                  </div>
                  <div className="mt-1 text-sm text-gray-700">
                    Target: <span className="font-medium">{workspace.plan.firstUserMonitoring.activeStudentTarget} students with hours</span>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Target Progress</div>
                      <div className="mt-1 text-2xl font-semibold text-gray-900">{targetProgress}%</div>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      {workspace.metrics.studentsWithHours} / {workspace.plan.firstUserMonitoring.activeStudentTarget}
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-blue-600" style={{ width: `${targetProgress}%` }} />
                  </div>
                </div>
              </div>

              {latestReminderSummary && (
                <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="font-medium text-blue-900">Latest reminder run</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-5 text-center">
                    <div>
                      <div className="text-lg font-semibold text-blue-900">{latestReminderSummary.deadlineReminders}</div>
                      <div className="text-xs text-blue-700">Deadline reminders</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-blue-900">{latestReminderSummary.behindAlerts}</div>
                      <div className="text-xs text-blue-700">Behind alerts</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-blue-900">{latestReminderSummary.adminAlerts}</div>
                      <div className="text-xs text-blue-700">Admin alerts</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-blue-900">{latestReminderSummary.pendingReviewCount}</div>
                      <div className="text-xs text-blue-700">Pending reviews</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-blue-900">{latestReminderSummary.atRiskStudents}</div>
                      <div className="text-xs text-blue-700">At-risk students</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-gray-900">Monitoring plan</h2>
              <p className="mt-1 text-sm text-gray-500">
                Persist the operating target and the people you want to watch most closely.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Launch start date</label>
                  <input
                    type="date"
                    aria-label="Launch start date"
                    value={monitoringForm.launchStartDate}
                    onChange={(e) => setMonitoringForm((current) => ({ ...current, launchStartDate: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Check cadence</label>
                  <select
                    aria-label="Check cadence"
                    value={monitoringForm.checkCadence}
                    onChange={(e) =>
                      setMonitoringForm((current) => ({
                        ...current,
                        checkCadence: e.target.value as MonitoringForm["checkCadence"],
                      }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="TWICE_DAILY">Twice daily</option>
                    <option value="WEEKDAYS">Weekdays only</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Students with hours target</label>
                  <input
                    type="number"
                    min="1"
                    aria-label="Students with hours target"
                    value={monitoringForm.activeStudentTarget}
                    onChange={(e) => setMonitoringForm((current) => ({ ...current, activeStudentTarget: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Watch list</label>
                  <input
                    type="text"
                    aria-label="Watch list"
                    value={monitoringForm.watchList}
                    onChange={(e) => setMonitoringForm((current) => ({ ...current, watchList: e.target.value }))}
                    placeholder="Student names or owners, comma-separated"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Monitoring notes</label>
                  <textarea
                    rows={5}
                    aria-label="Monitoring notes"
                    value={monitoringForm.notes}
                    onChange={(e) => setMonitoringForm((current) => ({ ...current, notes: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={handleSaveMonitoring}
                  disabled={savingMonitoring}
                  className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {savingMonitoring ? "Saving..." : "Save Monitoring Plan"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Accepted Invites" value={String(workspace.metrics.acceptedInvites)} subtext={`${workspace.metrics.pendingInvites} still pending`} />
            <MetricCard label="Approved Hours" value={`${workspace.metrics.totalApprovedHours.toFixed(1)}h`} subtext={`${workspace.metrics.totalPendingHours.toFixed(1)}h pending`} />
            <MetricCard label="At-Risk Students" value={String(workspace.metrics.atRiskStudents)} subtext={`${workspace.metrics.completedStudents} completed`} />
            <MetricCard label="No-Shows" value={String(workspace.metrics.noShowCount)} subtext={`${workspace.metrics.pendingLegacyVerifications} legacy verifications pending`} />
          </div>
        </div>
      )}

      {tab === "onboarding" && (
        <div className="grid gap-6 lg:grid-cols-[1.1fr,1fr]">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">Onboarding instructions</h2>
            <p className="mt-1 text-sm text-gray-500">
              Set the rollout narrative for staff so the pilot follows one consistent path.
            </p>
            {onboardingMessage && (
              <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {onboardingMessage}
              </div>
            )}
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Operator overview</label>
                <textarea
                  rows={5}
                  aria-label="Operator overview"
                  value={onboardingForm.overview}
                  onChange={(e) => setOnboardingForm((current) => ({ ...current, overview: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Next milestone</label>
                <textarea
                  rows={4}
                  aria-label="Next milestone"
                  value={onboardingForm.nextMilestone}
                  onChange={(e) => setOnboardingForm((current) => ({ ...current, nextMilestone: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={handleSaveOnboarding}
                disabled={savingOnboarding}
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {savingOnboarding ? "Saving..." : "Save Onboarding Instructions"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">Launch checklist</h2>
            <p className="mt-1 text-sm text-gray-500">
              This checklist reflects live product state, not guesses. Use it before sending the next invite batch.
            </p>
            <div className="mt-5 space-y-3">
              {workspace.checklist.map((item) => (
                <div key={item.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-gray-900">{item.title}</div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.done ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                          {item.done ? "Done" : "Needs work"}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-500">{item.description}</div>
                    </div>
                    <Link
                      to={item.actionHref}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {item.actionLabel}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "support" && (
        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">Support process</h2>
            <p className="mt-1 text-sm text-gray-500">
              Define the operating owner, intake channel, and escalation window before the first live support request lands.
            </p>
            {supportMessage && (
              <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {supportMessage}
              </div>
            )}
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Support owner</label>
                <input
                  type="text"
                  aria-label="Support owner"
                  value={supportForm.ownerName}
                  onChange={(e) => setSupportForm((current) => ({ ...current, ownerName: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Owner email</label>
                <input
                  type="email"
                  aria-label="Owner email"
                  value={supportForm.ownerEmail}
                  onChange={(e) => setSupportForm((current) => ({ ...current, ownerEmail: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">First response SLA (hours)</label>
                <input
                  type="number"
                  min="1"
                  aria-label="First response SLA (hours)"
                  value={supportForm.responseTimeHours}
                  onChange={(e) => setSupportForm((current) => ({ ...current, responseTimeHours: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Escalate after (hours)</label>
                <input
                  type="number"
                  min="1"
                  aria-label="Escalate after (hours)"
                  value={supportForm.escalationAfterHours}
                  onChange={(e) => setSupportForm((current) => ({ ...current, escalationAfterHours: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Intake channels</label>
                <input
                  type="text"
                  aria-label="Intake channels"
                  value={supportForm.intakeChannels}
                  onChange={(e) => setSupportForm((current) => ({ ...current, intakeChannels: e.target.value }))}
                  placeholder="Messages, Email, Office hours"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Support notes</label>
                <textarea
                  rows={6}
                  aria-label="Support notes"
                  value={supportForm.notes}
                  onChange={(e) => setSupportForm((current) => ({ ...current, notes: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              onClick={handleSaveSupport}
              disabled={savingSupport}
              className="mt-5 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {savingSupport ? "Saving..." : "Save Support Process"}
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">Support flow</h2>
            <div className="mt-5 space-y-3">
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">1. Intake</div>
                <div className="mt-1 text-sm text-gray-700">
                  Route new issues through <span className="font-medium">{supportForm.intakeChannels || "Messages"}</span>.
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">2. First response</div>
                <div className="mt-1 text-sm text-gray-700">
                  Respond within <span className="font-medium">{supportForm.responseTimeHours || "24"} hours</span> with owner and workaround.
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">3. Escalation</div>
                <div className="mt-1 text-sm text-gray-700">
                  Escalate unresolved issues after <span className="font-medium">{supportForm.escalationAfterHours || "48"} hours</span>.
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">4. Triage</div>
                <div className="mt-1 text-sm text-gray-700">
                  Move any product defect into the bug triage list so support, engineering, and rollout state stay aligned.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "rollback" && (
        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">Rollback plan</h2>
            <p className="mt-1 text-sm text-gray-500">
              Define the trigger, freeze action, rollback sequence, and restore checks before the school is fully live.
            </p>
            {rollbackMessage && (
              <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {rollbackMessage}
              </div>
            )}
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Rollback owner</label>
                <input
                  type="text"
                  aria-label="Rollback owner"
                  value={rollbackForm.ownerName}
                  onChange={(e) => setRollbackForm((current) => ({ ...current, ownerName: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Trigger</label>
                <textarea
                  rows={3}
                  aria-label="Trigger"
                  value={rollbackForm.trigger}
                  onChange={(e) => setRollbackForm((current) => ({ ...current, trigger: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Freeze action</label>
                <textarea
                  rows={2}
                  aria-label="Freeze action"
                  value={rollbackForm.freezeAction}
                  onChange={(e) => setRollbackForm((current) => ({ ...current, freezeAction: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Rollback steps</label>
                <textarea
                  rows={7}
                  aria-label="Rollback steps"
                  value={rollbackForm.rollbackSteps}
                  onChange={(e) => setRollbackForm((current) => ({ ...current, rollbackSteps: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Restore check</label>
                <textarea
                  rows={4}
                  aria-label="Restore check"
                  value={rollbackForm.restoreCheck}
                  onChange={(e) => setRollbackForm((current) => ({ ...current, restoreCheck: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Last rollback drill</label>
                <input
                  type="date"
                  aria-label="Last rollback drill"
                  value={rollbackForm.lastDrillAt}
                  onChange={(e) => setRollbackForm((current) => ({ ...current, lastDrillAt: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              onClick={handleSaveRollback}
              disabled={savingRollback}
              className="mt-5 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {savingRollback ? "Saving..." : "Save Rollback Plan"}
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">Current risk signals</h2>
            <div className="mt-5 space-y-3">
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Review queue</div>
                <div className="mt-1 text-sm text-gray-700">
                  {workspace.metrics.pendingReviewCount} items are waiting for review.
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Adoption proof</div>
                <div className="mt-1 text-sm text-gray-700">
                  {workspace.metrics.studentsWithHours} students have logged hours and {workspace.metrics.completedStudents} have already reached the goal.
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Bug load</div>
                <div className="mt-1 text-sm text-gray-700">
                  {workspace.metrics.openBugCount} open bug entries, including {workspace.metrics.criticalBugCount} critical.
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Health checks</div>
                <div className="mt-1 text-sm text-gray-700">
                  Keep login, dashboard, partners, cohorts, submissions, and reminders in the restore checklist.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "bugs" && (
        <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
          <div className="space-y-6">
            <form onSubmit={handleCreateBug} className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-gray-900">New bug triage item</h2>
              <p className="mt-1 text-sm text-gray-500">
                Capture rollout defects with enough detail to assign, reproduce, and verify.
              </p>
              {bugMessage && (
                <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {bugMessage}
                </div>
              )}
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
                  <input
                    type="text"
                    aria-label="New bug title"
                    value={createBugForm.title}
                    onChange={(e) => setCreateBugForm((current) => ({ ...current, title: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Severity</label>
                    <select
                      aria-label="New bug severity"
                      value={createBugForm.severity}
                      onChange={(e) =>
                        setCreateBugForm((current) => ({
                          ...current,
                          severity: e.target.value as BugCreateForm["severity"],
                        }))
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Area</label>
                    <input
                      type="text"
                      aria-label="New bug area"
                      value={createBugForm.area}
                      onChange={(e) => setCreateBugForm((current) => ({ ...current, area: e.target.value }))}
                      placeholder="Onboarding, Partners, Cohorts"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    rows={4}
                    aria-label="New bug description"
                    value={createBugForm.description}
                    onChange={(e) => setCreateBugForm((current) => ({ ...current, description: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Source</label>
                    <input
                      type="text"
                      aria-label="New bug source"
                      value={createBugForm.source}
                      onChange={(e) => setCreateBugForm((current) => ({ ...current, source: e.target.value }))}
                      placeholder="Student report, admin test"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Owner</label>
                    <input
                      type="text"
                      aria-label="New bug owner"
                      value={createBugForm.ownerName}
                      onChange={(e) => setCreateBugForm((current) => ({ ...current, ownerName: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Workaround</label>
                  <textarea
                    rows={2}
                    aria-label="New bug workaround"
                    value={createBugForm.workaround}
                    onChange={(e) => setCreateBugForm((current) => ({ ...current, workaround: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Next action</label>
                  <textarea
                    rows={2}
                    aria-label="New bug next action"
                    value={createBugForm.nextAction}
                    onChange={(e) => setCreateBugForm((current) => ({ ...current, nextAction: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creatingBug}
                  className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {creatingBug ? "Saving..." : "Add Bug"}
                </button>
              </div>
            </form>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900">Triage queue</h2>
                <div className="text-sm text-gray-500">{workspace.bugs.length} total</div>
              </div>
              <div className="mt-5 space-y-3">
                {workspace.bugs.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 p-5 text-sm text-gray-500">
                    No rollout bugs yet.
                  </div>
                ) : (
                  workspace.bugs.map((bug) => (
                    <button
                      key={bug.id}
                      onClick={() => setSelectedBugId(bug.id)}
                      className={`w-full rounded-lg border p-4 text-left transition-colors ${
                        selectedBugId === bug.id
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClasses(bug.severity)}`}>
                          {bug.severity}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClasses(bug.status)}`}>
                          {bug.status}
                        </span>
                      </div>
                      <div className="mt-2 font-medium text-gray-900">{bug.title}</div>
                      <div className="mt-1 text-sm text-gray-500">
                        {bug.area || "General"} · Updated {new Date(bug.updatedAt).toLocaleDateString()}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">Selected bug</h2>
            {!selectedBug ? (
              <div className="mt-5 rounded-lg border border-dashed border-gray-300 p-5 text-sm text-gray-500">
                Select a bug to edit severity, status, owner, workaround, and next action.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
                  <input
                    type="text"
                    aria-label="Selected bug title"
                    value={bugEditForm.title}
                    onChange={(e) => setBugEditForm((current) => ({ ...current, title: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Severity</label>
                    <select
                      aria-label="Selected bug severity"
                      value={bugEditForm.severity}
                      onChange={(e) =>
                        setBugEditForm((current) => ({
                          ...current,
                          severity: e.target.value as BugEditForm["severity"],
                        }))
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                    <select
                      aria-label="Selected bug status"
                      value={bugEditForm.status}
                      onChange={(e) =>
                        setBugEditForm((current) => ({
                          ...current,
                          status: e.target.value as BugEditForm["status"],
                        }))
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="OPEN">Open</option>
                      <option value="INVESTIGATING">Investigating</option>
                      <option value="BLOCKED">Blocked</option>
                      <option value="FIXED">Fixed</option>
                      <option value="MONITORING">Monitoring</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Area</label>
                    <input
                      type="text"
                      aria-label="Selected bug area"
                      value={bugEditForm.area}
                      onChange={(e) => setBugEditForm((current) => ({ ...current, area: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Source</label>
                    <input
                      type="text"
                      aria-label="Selected bug source"
                      value={bugEditForm.source}
                      onChange={(e) => setBugEditForm((current) => ({ ...current, source: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Owner</label>
                  <input
                    type="text"
                    aria-label="Selected bug owner"
                    value={bugEditForm.ownerName}
                    onChange={(e) => setBugEditForm((current) => ({ ...current, ownerName: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    rows={5}
                    aria-label="Selected bug description"
                    value={bugEditForm.description}
                    onChange={(e) => setBugEditForm((current) => ({ ...current, description: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Workaround</label>
                  <textarea
                    rows={3}
                    aria-label="Selected bug workaround"
                    value={bugEditForm.workaround}
                    onChange={(e) => setBugEditForm((current) => ({ ...current, workaround: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Next action</label>
                  <textarea
                    rows={3}
                    aria-label="Selected bug next action"
                    value={bugEditForm.nextAction}
                    onChange={(e) => setBugEditForm((current) => ({ ...current, nextAction: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="text-xs text-gray-400">
                  Created {new Date(selectedBug.createdAt).toLocaleString()} · Updated {new Date(selectedBug.updatedAt).toLocaleString()}
                </div>
                <button
                  onClick={handleSaveBug}
                  disabled={savingBug}
                  className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {savingBug ? "Saving..." : "Save Bug"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
