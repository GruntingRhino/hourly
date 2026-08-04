import prisma from "./prisma";
import { calculateStudentHours } from "./hoursCalculator";

const DAY_MS = 24 * 60 * 60 * 1000;

export type StudentProgressStatus = "COMPLETED" | "ON_TRACK" | "AT_RISK";
export type RiskLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH";

export interface StudentProgressRecord {
  id: string;
  name: string;
  email: string;
  grade: string | null;
  cohortId: string | null;
  cohortName: string | null;
  approvedHours: number;
  pendingHours: number;
  requiredHours: number;
  remainingHours: number;
  percentComplete: number;
  serviceStartDate: Date | null;
  serviceEndDate: Date | null;
  daysToDeadline: number | null;
  noShowCount: number;
  status: StudentProgressStatus;
  riskLevel: RiskLevel;
  riskReasons: string[];
}

type StudentForProgress = {
  id: string;
  name: string;
  email: string;
  grade: string | null;
  cohortId: string | null;
  cohort:
    | {
        id: string;
        name: string;
        requiredHours: number | null;
        serviceStartDate: Date | null;
        serviceEndDate: Date | null;
      }
    | null;
  cohortMemberships?: Array<{
    cohortId: string;
    isActive: boolean;
    cohort: {
      id: string;
      name: string;
      requiredHours: number | null;
      serviceStartDate: Date | null;
      serviceEndDate: Date | null;
    };
  }>;
};

type SchoolDefaults = {
  schoolId: string;
  requiredHours: number;
  serviceStartDate: Date | null;
  serviceEndDate: Date | null;
};

function startOfDay(input: Date): Date {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toRoundedHours(value: number): number {
  return Math.round(value * 100) / 100;
}

function pluralize(label: string, count: number): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function getEffectiveCohort(student: StudentForProgress) {
  if (student.cohort) return student.cohort;
  return student.cohortMemberships?.find((membership) => membership.isActive)?.cohort ?? null;
}

function assessStudentProgress(
  student: StudentForProgress,
  schoolDefaults: SchoolDefaults,
  approvedHours: number,
  pendingHours: number,
  noShowCount: number
): StudentProgressRecord {
  const effectiveCohort = getEffectiveCohort(student);
  const requiredHours = Math.max(1, effectiveCohort?.requiredHours ?? schoolDefaults.requiredHours ?? 40);
  const serviceStartDate = effectiveCohort?.serviceStartDate ?? schoolDefaults.serviceStartDate ?? null;
  const serviceEndDate = effectiveCohort?.serviceEndDate ?? schoolDefaults.serviceEndDate ?? null;
  const approved = toRoundedHours(approvedHours);
  const pending = toRoundedHours(pendingHours);
  const remainingHours = Math.max(0, toRoundedHours(requiredHours - approved));
  const percentComplete = Math.min(100, Math.round((approved / requiredHours) * 100));

  const today = startOfDay(new Date());
  const deadline = serviceEndDate ? startOfDay(serviceEndDate) : null;
  const daysToDeadline = deadline ? Math.ceil((deadline.getTime() - today.getTime()) / DAY_MS) : null;

  const riskReasons: string[] = [];

  if (approved < requiredHours && percentComplete < 50) {
    riskReasons.push("Below 50% of required hours");
  }

  if (pending >= Math.max(remainingHours, requiredHours * 0.25) && remainingHours > 0) {
    riskReasons.push(`${pending.toFixed(1)}h still pending approval`);
  }

  if (noShowCount > 0) {
    riskReasons.push(`${pluralize("no-show", noShowCount)} recorded`);
  }

  if (serviceStartDate && deadline && approved < requiredHours) {
    const start = startOfDay(serviceStartDate);
    const totalSpanDays = Math.max(1, Math.ceil((deadline.getTime() - start.getTime()) / DAY_MS));
    const elapsedDays = Math.max(0, Math.min(totalSpanDays, Math.ceil((today.getTime() - start.getTime()) / DAY_MS)));
    const expectedCompletion = elapsedDays / totalSpanDays;
    const currentCompletion = (approved + pending * 0.5) / requiredHours;
    if (elapsedDays > 0 && currentCompletion + 0.15 < expectedCompletion) {
      riskReasons.push("Behind expected pace for the service period");
    }
  }

  if (daysToDeadline != null && approved < requiredHours) {
    if (daysToDeadline < 0) {
      riskReasons.push(`Overdue by ${Math.abs(daysToDeadline)} day${Math.abs(daysToDeadline) === 1 ? "" : "s"}`);
    } else if (daysToDeadline <= 14) {
      riskReasons.push(`Deadline in ${daysToDeadline} day${daysToDeadline === 1 ? "" : "s"}`);
    }
  }

  let riskLevel: RiskLevel = "NONE";
  if (approved < requiredHours) {
    if (
      (daysToDeadline != null && daysToDeadline < 0) ||
      noShowCount >= 2 ||
      percentComplete < 35 ||
      (daysToDeadline != null && daysToDeadline <= 14 && percentComplete < 75)
    ) {
      riskLevel = "HIGH";
    } else if (riskReasons.length > 0) {
      riskLevel = "MEDIUM";
    } else if (percentComplete < 75) {
      riskLevel = "LOW";
    }
  }

  const status: StudentProgressStatus =
    approved >= requiredHours
      ? "COMPLETED"
      : riskLevel === "NONE"
      ? "ON_TRACK"
      : "AT_RISK";

  return {
    id: student.id,
    name: student.name,
    email: student.email,
    grade: student.grade,
    cohortId: student.cohortId ?? effectiveCohort?.id ?? null,
    cohortName: effectiveCohort?.name ?? null,
    approvedHours: approved,
    pendingHours: pending,
    requiredHours,
    remainingHours,
    percentComplete,
    serviceStartDate,
    serviceEndDate,
    daysToDeadline,
    noShowCount,
    status,
    riskLevel,
    riskReasons,
  };
}

export async function buildStudentProgressRecords(
  students: StudentForProgress[],
  schoolDefaults: SchoolDefaults
): Promise<StudentProgressRecord[]> {
  if (students.length === 0) return [];

  const studentIds = students.map((student) => student.id);

  let hoursMap = new Map<string, { approved: number; pending: number }>();
  let noShowRows: Array<{ studentId: string }> = [];

  try {
    [hoursMap, noShowRows] = await Promise.all([
      calculateStudentHours(studentIds, schoolDefaults.schoolId),
      prisma.beneficiarySignup.findMany({
        where: {
          studentId: { in: studentIds },
          schoolId: schoolDefaults.schoolId,
          status: "NO_SHOW",
        },
        select: { studentId: true },
      }),
    ]);
  } catch (err) {
    console.warn("[studentProgress] Falling back to zero-hour progress due to lookup error:", err);
  }

  const noShowCounts = new Map<string, number>();
  for (const row of noShowRows) {
    noShowCounts.set(row.studentId, (noShowCounts.get(row.studentId) ?? 0) + 1);
  }

  return students.map((student) => {
    const hours = hoursMap.get(student.id) ?? { approved: 0, pending: 0 };
    return assessStudentProgress(
      student,
      schoolDefaults,
      hours.approved,
      hours.pending,
      noShowCounts.get(student.id) ?? 0
    );
  });
}
