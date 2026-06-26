export type Tab = "monitoring" | "onboarding" | "support" | "rollback" | "bugs";

export interface LaunchBug {
  id: string;
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "INVESTIGATING" | "BLOCKED" | "FIXED" | "MONITORING" | "CLOSED";
  area: string | null;
  source: string | null;
  ownerName: string | null;
  workaround: string | null;
  nextAction: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BugCreateForm {
  title: string;
  description: string;
  severity: LaunchBug["severity"];
  area: string;
  source: string;
  ownerName: string;
  workaround: string;
  nextAction: string;
}

export interface BugEditForm {
  title: string;
  description: string;
  severity: LaunchBug["severity"];
  status: LaunchBug["status"];
  area: string;
  source: string;
  ownerName: string;
  workaround: string;
  nextAction: string;
}

export interface ReminderSummary {
  status: string;
  message: string;
  remindersSent: number;
  escalationsSent: number;
  deadlineReminders: number;
  behindAlerts: number;
  adminAlerts: number;
  pendingReviewCount: number;
  atRiskStudents: number;
}

export interface LaunchWorkspace {
  summary: {
    readiness: "LIVE" | "ATTENTION" | "PILOTING" | "NOT_READY";
    title?: string;
    subtitle?: string;
    headline: string;
    detail: string;
  };
  metrics: {
    approvedPartners: number;
    pendingPartners: number;
    publishedCohorts: number;
    totalCohorts: number;
    invitedStudents: number;
    pendingInvites: number;
    studentsWithHours: number;
    enrolledStudents: number;
    pendingReviewCount: number;
    pendingSelfSubmissions: number;
    openBugCount: number;
    criticalBugCount: number;
    acceptedInvites: number;
    totalApprovedHours: number;
    totalPendingHours: number;
    atRiskStudents: number;
    completedStudents: number;
    noShowCount: number;
    pendingLegacyVerifications: number;
  };
  plan: {
    firstUserMonitoring: {
      launchStartDate: string | null;
      checkCadence: "DAILY" | "TWICE_DAILY" | "WEEKDAYS";
      activeStudentTarget: number;
      watchList: string[];
      notes: string | null;
    };
    onboardingInstructions: {
      overview: string;
      nextMilestone: string;
    };
    supportProcess: {
      ownerName: string | null;
      ownerEmail: string | null;
      responseTimeHours: number | null;
      escalationAfterHours: number | null;
      intakeChannels: string[];
      notes: string | null;
    };
    rollbackPlan: {
      ownerName: string | null;
      trigger: string | null;
      freezeAction: string | null;
      rollbackSteps: string | null;
      restoreCheck: string | null;
      lastDrillAt: string | null;
    };
  };
  checklist: Array<{
    id: string;
    title: string;
    description: string;
    actionLabel: string;
    actionHref: string;
    done: boolean;
  }>;
  bugs: LaunchBug[];
  reminders: {
    lastRunAt: string | null;
    nextRunAt: string | null;
    cadenceLabel: string;
  };
}

export interface MonitoringForm {
  launchStartDate: string;
  checkCadence: "DAILY" | "TWICE_DAILY" | "WEEKDAYS";
  activeStudentTarget: string;
  watchList: string;
  notes: string;
}

export interface OnboardingForm {
  overview: string;
  nextMilestone: string;
}

export interface SupportForm {
  ownerName: string;
  ownerEmail: string;
  responseTimeHours: string;
  escalationAfterHours: string;
  intakeChannels: string;
  notes: string;
}

export interface RollbackForm {
  ownerName: string;
  trigger: string;
  freezeAction: string;
  rollbackSteps: string;
  restoreCheck: string;
  lastDrillAt: string;
}

export interface BugItem {
  id: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "INVESTIGATING" | "BLOCKED" | "FIXED" | "MONITORING" | "CLOSED";
  area: string | null;
  source: string | null;
  ownerName: string | null;
  workaround: string | null;
  nextAction: string | null;
  createdAt: string;
  updatedAt: string;
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function summaryClasses(readiness: LaunchWorkspace["summary"]["readiness"]): string {
  switch (readiness) {
    case "LIVE":
      return "border-[var(--ok-b)] bg-[var(--ok-bg)] text-green-900";
    case "ATTENTION":
      return "border-[var(--er-b)] bg-[var(--er-bg)] text-red-900";
    case "PILOTING":
      return "border-[var(--wn-b)] bg-[var(--wn-bg)] text-amber-900";
    default:
      return "border-[var(--in-b)] bg-[var(--in-bg)] text-blue-900";
  }
}

export function badgeClasses(value: string): string {
  switch (value) {
    case "CRITICAL":
    case "BLOCKED":
      return "bg-[var(--er-bg)] text-[var(--er-t)]";
    case "HIGH":
    case "OPEN":
    case "ATTENTION":
      return "bg-[var(--wn-bg)] text-[var(--wn-t)]";
    case "FIXED":
    case "LIVE":
      return "bg-[var(--ok-bg)] text-[var(--ok-t)]";
    case "MONITORING":
    case "INVESTIGATING":
    case "PILOTING":
      return "bg-[var(--in-bg)] text-[var(--action)]";
    case "NOT_READY":
      return "bg-[var(--in-bg)] text-[var(--action)]";
    default:
      return "bg-[var(--surface-alt)] text-[var(--text)]";
  }
}

export function MetricCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="rounded-[3px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="text-sm text-[var(--text-sec)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[var(--text)]">{value}</div>
      {subtext && <div className="mt-1 text-xs text-[var(--text-faint)]">{subtext}</div>}
    </div>
  );
}
