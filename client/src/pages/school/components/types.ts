export type Tab = "monitoring" | "onboarding" | "support" | "rollback" | "bugs";

export interface ReminderSummary {
  schoolId: string;
  schoolName: string;
  deadlineReminders: number;
  behindAlerts: number;
  adminAlerts: number;
  pendingReviewCount: number;
  atRiskStudents: number;
}

export interface LaunchWorkspace {
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

export interface LaunchBug {
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

export interface MonitoringForm {
  launchStartDate: string;
  checkCadence: "DAILY" | "TWICE_DAILY" | "WEEKDAYS";
  activeStudentTarget: string;
  watchList: string;
  notes: string;
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

export interface BugEditForm extends BugCreateForm {
  status: LaunchBug["status"];
}

export function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

export function summaryClasses(readiness: LaunchWorkspace["summary"]["readiness"]): string {
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

export function badgeClasses(value: string): string {
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

export function MetricCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {subtext && <div className="mt-1 text-xs text-gray-400">{subtext}</div>}
    </div>
  );
}
