import prisma from "./prisma";
import { buildStudentProgressRecords } from "./studentProgress";

export type MonitoringCadence = "DAILY" | "TWICE_DAILY" | "WEEKDAYS";

export interface OnboardingInstructionsConfig {
  overview: string;
  nextMilestone: string;
}

export interface SupportProcessConfig {
  ownerName: string;
  ownerEmail: string;
  responseTimeHours: number;
  escalationAfterHours: number;
  intakeChannels: string[];
  notes: string;
}

export interface RollbackPlanConfig {
  ownerName: string;
  trigger: string;
  freezeAction: string;
  rollbackSteps: string;
  restoreCheck: string;
  lastDrillAt: string;
}

export interface FirstUserMonitoringConfig {
  launchStartDate: string;
  checkCadence: MonitoringCadence;
  activeStudentTarget: number;
  watchList: string[];
  notes: string;
}

export interface LaunchPlan {
  onboardingInstructions: OnboardingInstructionsConfig;
  supportProcess: SupportProcessConfig;
  rollbackPlan: RollbackPlanConfig;
  firstUserMonitoring: FirstUserMonitoringConfig;
}

export interface LaunchChecklistItem {
  id: string;
  title: string;
  description: string;
  done: boolean;
  actionHref: string;
  actionLabel: string;
}

export interface LaunchSummary {
  readiness: "NOT_READY" | "PILOTING" | "LIVE" | "ATTENTION";
  headline: string;
  detail: string;
}

export interface LaunchMetrics {
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
}

export interface LaunchBugRecord {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  area: string;
  source: string;
  ownerName: string;
  workaround: string;
  nextAction: string;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
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
  plan: LaunchPlan;
  summary: LaunchSummary;
  metrics: LaunchMetrics;
  checklist: LaunchChecklistItem[];
  bugs: LaunchBugRecord[];
}

type LaunchPlanSource = {
  createdAt: Date;
  name: string;
  launchOnboardingConfig: string | null;
  launchSupportConfig: string | null;
  launchRollbackConfig: string | null;
  launchMonitoringConfig: string | null;
  staff: Array<{
    name: string;
    email: string;
    role: string;
  }>;
};

function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as Record<string, unknown>) } as T;
  } catch {
    return fallback;
  }
}

function cleanText(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function cleanList(values: string[] | undefined | null): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = cleanText(value);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

function toDateInput(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

function getDefaultOwner(staff: LaunchPlanSource["staff"]): { name: string; email: string } {
  const admin = staff.find((member) => member.role === "SCHOOL_ADMIN") ?? staff[0];
  return {
    name: admin?.name ?? "",
    email: admin?.email ?? "",
  };
}

function getDefaultOnboardingConfig(): OnboardingInstructionsConfig {
  return {
    overview:
      "Start with one cohort, one approved partner, and a small student invite batch. Verify the full flow before expanding the rollout.",
    nextMilestone:
      "Invite the first group only after the dashboard shows a live cohort, approved partners, and a review owner for incoming submissions.",
  };
}

function getDefaultSupportConfig(staff: LaunchPlanSource["staff"]): SupportProcessConfig {
  const owner = getDefaultOwner(staff);
  return {
    ownerName: owner.name,
    ownerEmail: owner.email,
    responseTimeHours: 24,
    escalationAfterHours: 48,
    intakeChannels: ["Messages", "Email"],
    notes:
      "Capture every first-user issue in the bug triage list. Reply with a workaround, owner, and next check time before closing the loop.",
  };
}

function getDefaultRollbackConfig(staff: LaunchPlanSource["staff"]): RollbackPlanConfig {
  const owner = getDefaultOwner(staff);
  return {
    ownerName: owner.name,
    trigger:
      "Pause rollout if students cannot join, partner approvals block logging, or the review queue stops staff from keeping up.",
    freezeAction: "Stop sending new invitations and pause partner approvals until the issue is contained.",
    rollbackSteps:
      "1. Pause new invites.\n2. Revert the last risky config change.\n3. Confirm login, dashboard, partners, cohorts, and submissions still load.\n4. Message affected users with the workaround and next update time.",
    restoreCheck:
      "Confirm /api/health, admin login, partner list, cohort roster, and submission review all behave normally before reopening rollout.",
    lastDrillAt: "",
  };
}

function getDefaultMonitoringConfig(source: LaunchPlanSource): FirstUserMonitoringConfig {
  return {
    launchStartDate: toDateInput(source.createdAt),
    checkCadence: "DAILY",
    activeStudentTarget: 10,
    watchList: [],
    notes:
      "Track the funnel: invited students -> joined students -> students with hours -> approved hours. Run reminders when the queue or at-risk count grows.",
  };
}

export function normalizeOnboardingInstructionsConfig(
  value: Partial<OnboardingInstructionsConfig> | undefined,
  source: LaunchPlanSource
): OnboardingInstructionsConfig {
  const base = {
    ...getDefaultOnboardingConfig(),
    ...safeParseJson<OnboardingInstructionsConfig>(source.launchOnboardingConfig, getDefaultOnboardingConfig()),
  };
  return {
    overview: cleanText(value?.overview ?? base.overview),
    nextMilestone: cleanText(value?.nextMilestone ?? base.nextMilestone),
  };
}

export function normalizeSupportProcessConfig(
  value: Partial<SupportProcessConfig> | undefined,
  source: LaunchPlanSource
): SupportProcessConfig {
  const defaults = getDefaultSupportConfig(source.staff);
  const base = {
    ...defaults,
    ...safeParseJson<SupportProcessConfig>(source.launchSupportConfig, defaults),
  };
  return {
    ownerName: cleanText(value?.ownerName ?? base.ownerName),
    ownerEmail: cleanText(value?.ownerEmail ?? base.ownerEmail),
    responseTimeHours: Math.min(168, Math.max(1, Number(value?.responseTimeHours ?? base.responseTimeHours) || defaults.responseTimeHours)),
    escalationAfterHours: Math.min(168, Math.max(1, Number(value?.escalationAfterHours ?? base.escalationAfterHours) || defaults.escalationAfterHours)),
    intakeChannels: cleanList(value?.intakeChannels ?? base.intakeChannels),
    notes: cleanText(value?.notes ?? base.notes),
  };
}

export function normalizeRollbackPlanConfig(
  value: Partial<RollbackPlanConfig> | undefined,
  source: LaunchPlanSource
): RollbackPlanConfig {
  const defaults = getDefaultRollbackConfig(source.staff);
  const base = {
    ...defaults,
    ...safeParseJson<RollbackPlanConfig>(source.launchRollbackConfig, defaults),
  };
  return {
    ownerName: cleanText(value?.ownerName ?? base.ownerName),
    trigger: cleanText(value?.trigger ?? base.trigger),
    freezeAction: cleanText(value?.freezeAction ?? base.freezeAction),
    rollbackSteps: cleanText(value?.rollbackSteps ?? base.rollbackSteps),
    restoreCheck: cleanText(value?.restoreCheck ?? base.restoreCheck),
    lastDrillAt: cleanText(value?.lastDrillAt ?? base.lastDrillAt),
  };
}

export function normalizeFirstUserMonitoringConfig(
  value: Partial<FirstUserMonitoringConfig> | undefined,
  source: LaunchPlanSource
): FirstUserMonitoringConfig {
  const defaults = getDefaultMonitoringConfig(source);
  const base = {
    ...defaults,
    ...safeParseJson<FirstUserMonitoringConfig>(source.launchMonitoringConfig, defaults),
  };
  const cadence = value?.checkCadence ?? base.checkCadence;
  return {
    launchStartDate: cleanText(value?.launchStartDate ?? base.launchStartDate),
    checkCadence:
      cadence === "TWICE_DAILY" || cadence === "WEEKDAYS" || cadence === "DAILY"
        ? cadence
        : defaults.checkCadence,
    activeStudentTarget: Math.min(10000, Math.max(1, Number(value?.activeStudentTarget ?? base.activeStudentTarget) || defaults.activeStudentTarget)),
    watchList: cleanList(value?.watchList ?? base.watchList),
    notes: cleanText(value?.notes ?? base.notes),
  };
}

export function readLaunchPlan(source: LaunchPlanSource): LaunchPlan {
  return {
    onboardingInstructions: normalizeOnboardingInstructionsConfig(undefined, source),
    supportProcess: normalizeSupportProcessConfig(undefined, source),
    rollbackPlan: normalizeRollbackPlanConfig(undefined, source),
    firstUserMonitoring: normalizeFirstUserMonitoringConfig(undefined, source),
  };
}

function buildChecklist(metrics: LaunchMetrics, hasLocation: boolean): LaunchChecklistItem[] {
  return [
    {
      id: "location",
      title: "Set school location for partner discovery",
      description: "The Discover map needs a geocoded school address so the first partner search is local and usable.",
      done: hasLocation,
      actionHref: "/settings",
      actionLabel: "Open Settings",
    },
    {
      id: "partners",
      title: "Approve at least one partner",
      description: "Students need an approved beneficiary before the first logged hours can be trustworthy.",
      done: metrics.approvedPartners > 0,
      actionHref: "/beneficiaries",
      actionLabel: "Manage Partners",
    },
    {
      id: "cohort",
      title: "Publish a cohort",
      description: "A draft cohort is not enough. Publish the first cohort before inviting students.",
      done: metrics.publishedCohorts > 0,
      actionHref: "/cohorts",
      actionLabel: "Manage Cohorts",
    },
    {
      id: "invites",
      title: "Send the first student invites",
      description: "Start with a small batch so onboarding failures surface before the school-wide rollout.",
      done: metrics.invitedStudents > 0,
      actionHref: "/cohorts",
      actionLabel: "Open Invitations",
    },
    {
      id: "joined",
      title: "Confirm at least one student joined",
      description: "A live pilot starts only after at least one student account is actually enrolled.",
      done: metrics.enrolledStudents > 0 || metrics.acceptedInvites > 0,
      actionHref: "/students",
      actionLabel: "View Students",
    },
    {
      id: "activity",
      title: "Confirm the first student activity",
      description: "Watch for the first pending or approved hours before scaling the rollout beyond the initial group.",
      done: metrics.studentsWithHours > 0,
      actionHref: "/launch",
      actionLabel: "Watch Monitoring",
    },
  ];
}

function buildSummary(metrics: LaunchMetrics): LaunchSummary {
  if (metrics.criticalBugCount > 0 || (metrics.enrolledStudents > 0 && metrics.studentsWithHours === 0)) {
    return {
      readiness: "ATTENTION",
      headline: "Pilot needs attention",
      detail:
        metrics.criticalBugCount > 0
          ? `${metrics.criticalBugCount} critical bug${metrics.criticalBugCount === 1 ? "" : "s"} are still open.`
          : "Students are enrolled but nobody has logged hours yet. Validate partner, invite, and submission flows before expanding rollout.",
    };
  }

  if (metrics.approvedPartners === 0 || metrics.publishedCohorts === 0 || metrics.invitedStudents === 0) {
    return {
      readiness: "NOT_READY",
      headline: "Rollout setup is incomplete",
      detail: "Finish partner approval, cohort publishing, and the first invite batch before treating this school as live.",
    };
  }

  if (metrics.studentsWithHours === 0) {
    return {
      readiness: "PILOTING",
      headline: "Pilot is staged but not proven yet",
      detail: "The launch plan exists, but the system still needs at least one student hour flow to complete before rollout expands.",
    };
  }

  return {
    readiness: "LIVE",
    headline: "First-user rollout is live",
    detail:
      metrics.pendingReviewCount > 0 || metrics.atRiskStudents > 0
        ? "Keep the review queue small and watch at-risk students closely during the first rollout window."
        : "The core flow is working. Continue monitoring invites, logged hours, and open bugs while adoption grows.",
  };
}

export async function buildLaunchWorkspace(schoolId: string): Promise<LaunchWorkspace | null> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      requiredHours: true,
      serviceStartDate: true,
      serviceEndDate: true,
      latitude: true,
      longitude: true,
      launchOnboardingConfig: true,
      launchSupportConfig: true,
      launchRollbackConfig: true,
      launchMonitoringConfig: true,
      staff: {
        where: { role: { in: ["SCHOOL_ADMIN", "TEACHER"] } },
        orderBy: { createdAt: "asc" },
        select: {
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });
  if (!school) return null;

  const [
    approvedPartners,
    pendingPartners,
    totalCohorts,
    publishedCohorts,
    invitedStudents,
    acceptedInvites,
    pendingInvites,
    students,
    pendingSelfSubmissions,
    pendingLegacyVerifications,
    bugs,
  ] = await Promise.all([
    prisma.schoolBeneficiaryApproval.count({ where: { schoolId, status: "APPROVED" } }),
    prisma.schoolBeneficiaryApproval.count({ where: { schoolId, status: "PENDING" } }),
    prisma.cohort.count({ where: { schoolId } }),
    prisma.cohort.count({ where: { schoolId, status: "PUBLISHED" } }),
    prisma.studentInvitation.count({ where: { cohort: { schoolId } } }),
    prisma.studentInvitation.count({ where: { cohort: { schoolId }, status: "ACCEPTED" } }),
    prisma.studentInvitation.count({ where: { cohort: { schoolId }, status: "PENDING" } }),
    prisma.user.findMany({
      where: {
        role: "STUDENT",
        isTestAccount: false,
        OR: [
          { classroom: { schoolId } },
          { cohort: { schoolId } },
          { cohortMemberships: { some: { isActive: true, cohort: { schoolId } } } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        grade: true,
        cohortId: true,
        cohort: {
          select: {
            id: true,
            name: true,
            requiredHours: true,
            serviceStartDate: true,
            serviceEndDate: true,
          },
        },
        cohortMemberships: {
          where: { isActive: true },
          orderBy: [{ createdAt: "asc" }],
          select: {
            cohortId: true,
            isActive: true,
            cohort: {
              select: {
                id: true,
                name: true,
                requiredHours: true,
                serviceStartDate: true,
                serviceEndDate: true,
              },
            },
          },
        },
      },
    }),
    prisma.selfSubmittedRequest.count({ where: { schoolId, status: "PENDING" } }),
    prisma.serviceSession.count({
      where: {
        status: "PENDING_VERIFICATION",
        verificationStatus: "PENDING",
        user: {
          OR: [
            { classroom: { schoolId } },
            { cohort: { schoolId } },
            { cohortMemberships: { some: { isActive: true, cohort: { schoolId } } } },
          ],
        },
      },
    }),
    prisma.schoolLaunchBug.findMany({
      where: { schoolId },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const progress = await buildStudentProgressRecords(students, {
    schoolId,
    requiredHours: school.requiredHours,
    serviceStartDate: school.serviceStartDate,
    serviceEndDate: school.serviceEndDate,
  });

  const studentsWithHours = progress.filter((student) => student.approvedHours > 0 || student.pendingHours > 0).length;
  const completedStudents = progress.filter((student) => student.status === "COMPLETED").length;
  const atRiskStudents = progress.filter((student) => student.status === "AT_RISK").length;
  const noShowCount = progress.reduce((sum, student) => sum + student.noShowCount, 0);
  const totalApprovedHours = progress.reduce((sum, student) => sum + student.approvedHours, 0);
  const totalPendingHours = progress.reduce((sum, student) => sum + student.pendingHours, 0);
  const openBugs = bugs.filter((bug) => bug.status !== "CLOSED");
  const criticalBugs = openBugs.filter((bug) => bug.severity === "CRITICAL");
  const pendingReviewCount = pendingSelfSubmissions + pendingLegacyVerifications;

  const metrics: LaunchMetrics = {
    approvedPartners,
    pendingPartners,
    totalCohorts,
    publishedCohorts,
    invitedStudents,
    acceptedInvites,
    pendingInvites,
    enrolledStudents: students.length,
    studentsWithHours,
    completedStudents,
    atRiskStudents,
    pendingReviewCount,
    pendingSelfSubmissions,
    pendingLegacyVerifications,
    noShowCount,
    totalApprovedHours: roundHours(totalApprovedHours),
    totalPendingHours: roundHours(totalPendingHours),
    openBugCount: openBugs.length,
    criticalBugCount: criticalBugs.length,
  };

  const source: LaunchPlanSource = {
    createdAt: school.createdAt,
    name: school.name,
    launchOnboardingConfig: school.launchOnboardingConfig,
    launchSupportConfig: school.launchSupportConfig,
    launchRollbackConfig: school.launchRollbackConfig,
    launchMonitoringConfig: school.launchMonitoringConfig,
    staff: school.staff,
  };

  return {
    school: {
      id: school.id,
      name: school.name,
      requiredHours: school.requiredHours,
      serviceStartDate: school.serviceStartDate?.toISOString() ?? null,
      serviceEndDate: school.serviceEndDate?.toISOString() ?? null,
      hasLocation: school.latitude != null && school.longitude != null,
    },
    plan: readLaunchPlan(source),
    summary: buildSummary(metrics),
    metrics,
    checklist: buildChecklist(metrics, school.latitude != null && school.longitude != null),
    bugs: bugs.map((bug) => ({
      id: bug.id,
      title: bug.title,
      description: bug.description ?? "",
      severity: bug.severity,
      status: bug.status,
      area: bug.area ?? "",
      source: bug.source ?? "",
      ownerName: bug.ownerName ?? "",
      workaround: bug.workaround ?? "",
      nextAction: bug.nextAction ?? "",
      createdById: bug.createdById,
      createdAt: bug.createdAt.toISOString(),
      updatedAt: bug.updatedAt.toISOString(),
    })),
  };
}
