import prisma from "./prisma";
import { buildStudentProgressRecords } from "./studentProgress";
import {
  sendAdminPendingReviewAlertEmail,
  sendBehindScheduleEmail,
  sendServiceDeadlineReminderEmail,
} from "../services/email";

const DAY_MS = 24 * 60 * 60 * 1000;
const QUARTER_MS = 90 * DAY_MS;
const SYSTEM_AT_RISK_EMAIL_SENT = "_SYSTEM_AT_RISK_EMAIL_SENT";

export interface ReminderSummary {
  schoolId: string;
  schoolName: string;
  deadlineReminders: number;
  behindAlerts: number;
  adminAlerts: number;
  pendingReviewCount: number;
  atRiskStudents: number;
}

async function hasRecentNotification(userId: string, type: string, withinMs: number): Promise<boolean> {
  const since = new Date(Date.now() - withinMs);
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type,
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

async function createNotificationIfFresh(userId: string, type: string, title: string, body: string): Promise<boolean> {
  const fresh = !(await hasRecentNotification(userId, type, DAY_MS));
  if (!fresh) return false;

  await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
    },
  });
  return true;
}

async function hasRecentHiddenNotification(userId: string, type: string, withinMs: number): Promise<boolean> {
  const since = new Date(Date.now() - withinMs);
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type,
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

async function markHiddenNotification(userId: string, type: string): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      type,
      title: "system",
      body: "system",
    },
  });
}

async function getPendingReviewCount(schoolId: string): Promise<number> {
  const [selfPending, legacyPending, benSignupPending] = await Promise.all([
    prisma.selfSubmittedRequest.count({
      where: { schoolId, status: "PENDING" },
    }),
    prisma.serviceSession.count({
      where: {
        status: "PENDING_VERIFICATION",
        verificationStatus: "PENDING",
        user: {
          OR: [
            { classroom: { schoolId } },
            { cohort: { schoolId } },
          ],
        },
      },
    }),
    prisma.user.findMany({
      where: {
        role: "STUDENT",
        OR: [
          { classroom: { schoolId } },
          { cohort: { schoolId } },
        ],
      },
      select: { id: true },
    }).then((rows) =>
      prisma.beneficiarySignup.count({
        where: {
          verificationStatus: "PENDING",
          status: "CONFIRMED",
          studentId: { in: rows.map((r) => r.id) },
        },
      })
    ),
  ]);

  return selfPending + legacyPending + benSignupPending;
}

async function runSchoolReminderCycle(schoolId: string): Promise<ReminderSummary | null> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      name: true,
      requiredHours: true,
      serviceStartDate: true,
      serviceEndDate: true,
      staff: {
        where: { role: { in: ["SCHOOL_ADMIN"] } },
        select: { id: true, name: true, email: true },
      },
    },
  });
  if (!school) return null;

  const students = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      OR: [
        { classroom: { schoolId } },
        { cohort: { schoolId } },
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
    },
  });

  const progress = await buildStudentProgressRecords(students, {
    requiredHours: school.requiredHours,
    serviceStartDate: school.serviceStartDate,
    serviceEndDate: school.serviceEndDate,
  });

  let deadlineReminders = 0;
  let behindAlerts = 0;
  const atRiskStudents = progress.filter((student) => student.status === "AT_RISK").length;

  for (const student of progress) {
    if (student.status === "COMPLETED") continue;

    if (student.daysToDeadline != null && student.daysToDeadline <= 14) {
      const created = await createNotificationIfFresh(
        student.id,
        "DEADLINE_REMINDER",
        "Service deadline approaching",
        `${student.remainingHours.toFixed(1)}h remaining before ${school.name}'s deadline.`
      );
      if (created) {
        deadlineReminders += 1;
        await prisma.notification.updateMany({
          where: {
            userId: student.id,
            type: "DEADLINE_REMINDER",
            createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
          },
          data: { data: JSON.stringify({ href: "/dashboard" }) },
        });
        sendServiceDeadlineReminderEmail(
          student.email,
          student.name,
          school.name,
          student.remainingHours,
          student.daysToDeadline,
          student.serviceEndDate
        ).catch(() => {});
      }
    }

    if (student.status === "AT_RISK") {
      const created = await createNotificationIfFresh(
        student.id,
        "AT_RISK_ALERT",
        "You are behind on service hours",
        `${student.approvedHours.toFixed(1)}h approved, ${student.pendingHours.toFixed(1)}h pending, ${student.remainingHours.toFixed(1)}h still remaining.`
      );
      if (created) {
        behindAlerts += 1;
        await prisma.notification.updateMany({
          where: {
            userId: student.id,
            type: "AT_RISK_ALERT",
            createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
          },
          data: { data: JSON.stringify({ href: "/dashboard" }) },
        });
        const sentRecently = await hasRecentHiddenNotification(student.id, SYSTEM_AT_RISK_EMAIL_SENT, QUARTER_MS);
        if (!sentRecently) {
          sendBehindScheduleEmail(
            student.email,
            student.name,
            school.name,
            student.approvedHours,
            student.requiredHours,
            student.riskReasons
          ).catch(() => {});
          await markHiddenNotification(student.id, SYSTEM_AT_RISK_EMAIL_SENT);
        }
      }
    }
  }

  const pendingReviewCount = await getPendingReviewCount(schoolId);
  let adminAlerts = 0;

  if (pendingReviewCount > 0) {
    for (const admin of school.staff) {
      const created = await createNotificationIfFresh(
        admin.id,
        "ADMIN_PENDING_REVIEW_ALERT",
        "Items waiting for review",
        `${pendingReviewCount} review item${pendingReviewCount === 1 ? "" : "s"} are waiting in ${school.name}.`
      );
      if (created) {
        adminAlerts += 1;
        await prisma.notification.updateMany({
          where: {
            userId: admin.id,
            type: "ADMIN_PENDING_REVIEW_ALERT",
            createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
          },
          data: { data: JSON.stringify({ href: "/submissions" }) },
        });
        sendAdminPendingReviewAlertEmail(
          admin.email,
          admin.name,
          school.name,
          pendingReviewCount,
          atRiskStudents
        ).catch(() => {});
      }
    }
  }

  return {
    schoolId: school.id,
    schoolName: school.name,
    deadlineReminders,
    behindAlerts,
    adminAlerts,
    pendingReviewCount,
    atRiskStudents,
  };
}

export async function runReminderCycle(targetSchoolId?: string): Promise<ReminderSummary[]> {
  const schoolIds = targetSchoolId
    ? [targetSchoolId]
    : (
        await prisma.school.findMany({
          select: { id: true },
        })
      ).map((school) => school.id);

  const summaries: ReminderSummary[] = [];
  for (const schoolId of schoolIds) {
    const summary = await runSchoolReminderCycle(schoolId);
    if (summary) summaries.push(summary);
  }
  return summaries;
}

let reminderTimer: NodeJS.Timeout | null = null;

export function startReminderScheduler(): void {
  if (reminderTimer) return;
  if (process.env.NODE_ENV === "test" || process.env.DISABLE_REMINDER_SCHEDULER === "true") return;
  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV) {
    console.info("Reminder scheduler disabled in serverless/runtime-managed environment.");
    return;
  }

  const intervalMinutes = Math.max(15, Number(process.env.REMINDER_INTERVAL_MINUTES || 60));

  const run = () => {
    void runReminderCycle().catch((err) => {
      console.error("Reminder cycle error:", err);
    });
  };

  setTimeout(run, 10_000);
  reminderTimer = setInterval(run, intervalMinutes * 60 * 1000);
  console.info(`Reminder scheduler active (${intervalMinutes} minute interval)`);
}
