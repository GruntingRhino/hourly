import { Router, Request, Response } from "express";
import { z } from "zod";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { buildStudentProgressRecords } from "../lib/studentProgress";
import { runReminderCycle } from "../lib/reminders";
import { resolveSchoolIdFromUserAssociations } from "../lib/userAssociations";

const router = Router();
const SYSTEM_NOTIFICATION_PREFIX = "_SYSTEM_";

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch (err) {
    console.warn("[messages] Failed to parse JSON metadata:", err);
    return null;
  }
}

const SCHOOL_ROLES = new Set(["SCHOOL_ADMIN", "TEACHER", "STUDENT"]);

function buildBodyPreview(body: string): string {
  return body.trim().replace(/\s+/g, " ").slice(0, 280);
}

function inferCasePriority(queueType?: string | null, priority?: boolean): string {
  if (priority || queueType === "URGENT" || queueType === "OVERDUE") return "URGENT";
  if (queueType === "NO_SHOWS") return "HIGH";
  if (queueType === "PENDING_APPROVAL") return "MEDIUM";
  return "MEDIUM";
}

function inferCaseReason(queueType?: string | null, audienceType?: string): string {
  switch (queueType) {
    case "OVERDUE":
      return "Student is past the service deadline and still has hours remaining.";
    case "PENDING_APPROVAL":
      return "Student has pending hours awaiting approval and may be blocked from progress.";
    case "NO_SHOWS":
      return "Student has no-show history and may need attendance follow-up.";
    case "URGENT":
      return "Student surfaced in the urgent triage queue and needs immediate attention.";
    default:
      return audienceType === "DIRECT_STUDENT"
        ? "Student received direct outreach and needs follow-up tracking."
        : "Student was included in staff outreach and should be tracked until resolved.";
  }
}

function inferStudentNextStep(queueType?: string | null): string {
  switch (queueType) {
    case "PENDING_APPROVAL":
      return "Check your submitted hours and message your school if anything still needs approval details.";
    case "NO_SHOWS":
      return "Review upcoming commitments and contact your school if you need help getting back on track.";
    case "OVERDUE":
      return "Message your school administrator today and ask what path remains to complete your requirement.";
    default:
      return "Review your remaining hours, then either sign up for an opportunity or submit eligible hours this week.";
  }
}

function inferStaffNextStep(queueType?: string | null): string {
  switch (queueType) {
    case "PENDING_APPROVAL":
      return "Clear approval blockers or request missing evidence so hours can convert quickly.";
    case "NO_SHOWS":
      return "Confirm attendance context and decide whether behavior or scheduling intervention is needed.";
    case "OVERDUE":
      return "Escalate with a deadline recovery plan and document whether an extension or exception is needed.";
    default:
      return "Monitor student response and update the case after the next follow-up or progress change.";
  }
}

async function upsertInterventionCasesFromCampaign(input: {
  schoolId: string;
  actorId: string;
  queueType?: string | null;
  audienceType: string;
  subject?: string | null;
  body: string;
  priority?: boolean;
  recipients: Array<{ studentId: string }>;
  createdAt: Date;
}) {
  if (!input.recipients.length) return;
  const reason = inferCaseReason(input.queueType, input.audienceType);
  const priority = inferCasePriority(input.queueType, input.priority);
  const summary = input.subject?.trim() || "Staff outreach sent";
  const studentMessage = buildBodyPreview(input.body);
  const nextStepForStudent = inferStudentNextStep(input.queueType);
  const nextStepForStaff = inferStaffNextStep(input.queueType);

  await prisma.$transaction(
    input.recipients.map((recipient) => prisma.interventionCase.upsert({
      where: { schoolId_studentId: { schoolId: input.schoolId, studentId: recipient.studentId } },
      create: {
        schoolId: input.schoolId,
        studentId: recipient.studentId,
        ownerId: input.actorId,
        status: "WAITING_ON_STUDENT",
        priority,
        reason,
        summary,
        nextStepForStudent,
        nextStepForStaff,
        studentMessage,
        lastContactedAt: input.createdAt,
      },
      update: {
        ownerId: input.actorId,
        status: "WAITING_ON_STUDENT",
        priority,
        reason,
        summary,
        nextStepForStudent,
        nextStepForStaff,
        studentMessage,
        lastContactedAt: input.createdAt,
        resolvedAt: null,
      },
    }))
  );
}

async function logInterventionCampaign(input: {
  schoolId: string;
  actorId: string;
  actionType: string;
  audienceType: string;
  subject?: string | null;
  body: string;
  priority?: boolean;
  queueType?: string | null;
  savedView?: string | null;
  metadata?: Record<string, unknown> | null;
  recipients: Array<{ studentId: string; messageId?: string | null }>;
}) {
  if (!input.recipients.length) return null;
  const campaign = await prisma.interventionCampaign.create({
    data: {
      schoolId: input.schoolId,
      actorId: input.actorId,
      actionType: input.actionType,
      audienceType: input.audienceType,
      queueType: input.queueType ?? null,
      savedView: input.savedView ?? null,
      subject: input.subject?.trim() || null,
      bodyPreview: buildBodyPreview(input.body),
      priority: Boolean(input.priority),
      recipientCount: input.recipients.length,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      recipients: {
        create: input.recipients.map((recipient) => ({
          studentId: recipient.studentId,
          messageId: recipient.messageId ?? null,
        })),
      },
    },
    select: { id: true, createdAt: true },
  });

  await upsertInterventionCasesFromCampaign({
    schoolId: input.schoolId,
    actorId: input.actorId,
    queueType: input.queueType,
    audienceType: input.audienceType,
    subject: input.subject,
    body: input.body,
    priority: input.priority,
    recipients: input.recipients,
    createdAt: campaign.createdAt,
  });

  return campaign;
}

/** Returns the school ID for any user regardless of how they're enrolled. */
function resolveSchoolId(u: {
  schoolId: string | null;
  cohort?: { schoolId: string } | null;
  classroom?: { schoolId: string } | null;
  cohortMemberships?: Array<{ cohort: { schoolId: string } }>;
}): string | null {
  return resolveSchoolIdFromUserAssociations(u);
}

async function canSendMessage(senderId: string, receiverId: string): Promise<boolean> {
  const [sender, receiver] = await Promise.all([
    prisma.user.findUnique({
      where: { id: senderId },
      select: {
        role: true,
        schoolId: true,
        beneficiaryId: true,
        cohort: { select: { schoolId: true } },
        classroom: { select: { schoolId: true } },
        cohortMemberships: {
          where: { isActive: true },
          orderBy: [{ updatedAt: "desc" }],
          select: { cohort: { select: { schoolId: true } } },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: receiverId },
      select: {
        role: true,
        schoolId: true,
        beneficiaryId: true,
        messagePreferences: true,
        cohort: { select: { schoolId: true } },
        classroom: { select: { schoolId: true } },
        cohortMemberships: {
          where: { isActive: true },
          orderBy: [{ updatedAt: "desc" }],
          select: { cohort: { select: { schoolId: true } } },
        },
      },
    }),
  ]);
  if (!sender || !receiver) return false;

  const sSchool = resolveSchoolId(sender);
  const rSchool = resolveSchoolId(receiver);

  const receiverPrefs = (() => {
    if (!receiver.messagePreferences) return null;
    try {
      return JSON.parse(receiver.messagePreferences) as {
        allowFrom?: "EVERYONE" | "ORGS_ONLY" | "ADMINS_ONLY";
      };
    } catch {
      return null;
    }
  })();

  const senderAllowedByPrefs = (() => {
    switch (receiverPrefs?.allowFrom) {
      case "ORGS_ONLY":
        return ["ORG_ADMIN", "BENEFICIARY_ADMIN"].includes(sender.role);
      case "ADMINS_ONLY":
        return ["SCHOOL_ADMIN", "TEACHER"].includes(sender.role);
      default:
        return true;
    }
  })();

  const isSameSchoolAllowed =
    sSchool && rSchool && sSchool === rSchool && SCHOOL_ROLES.has(sender.role) && SCHOOL_ROLES.has(receiver.role)
      ? sender.role !== "STUDENT" || receiver.role !== "STUDENT"
      : false;

  // School staff or student → BENEFICIARY_ADMIN: requires approved school↔beneficiary relationship
  const canMessageBeneficiary =
    SCHOOL_ROLES.has(sender.role) && sSchool && receiver.role === "BENEFICIARY_ADMIN" && receiver.beneficiaryId;
  if (canMessageBeneficiary) {
    const approval = await prisma.schoolBeneficiaryApproval.findFirst({
      where: { schoolId: sSchool, beneficiaryId: receiver.beneficiaryId, status: "APPROVED" },
      select: { id: true },
    });
    if (!approval) return false;
    return senderAllowedByPrefs;
  }

  // BENEFICIARY_ADMIN → school staff (not students): requires approved relationship
  const canBeneficiaryMessageSchoolStaff =
    sender.role === "BENEFICIARY_ADMIN" && sender.beneficiaryId && rSchool && ["SCHOOL_ADMIN", "TEACHER"].includes(receiver.role);
  if (canBeneficiaryMessageSchoolStaff) {
    const approval = await prisma.schoolBeneficiaryApproval.findFirst({
      where: { schoolId: rSchool, beneficiaryId: sender.beneficiaryId, status: "APPROVED" },
      select: { id: true },
    });
    if (!approval) return false;
    return senderAllowedByPrefs;
  }
  if (isSameSchoolAllowed) {
    return senderAllowedByPrefs;
  }

  return false;
}

// 1 manual reminder run per user per hour — prevents staff from spamming students with reminder emails
// Keyed by userId synchronously (express-rate-limit does not support async keyGenerator)
const reminderRunLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1,
  keyGenerator: (req) => `reminder-run:${(req as any).user?.userId ?? ipKeyGenerator(req.ip || "")}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Reminder cycle already triggered this hour. Please wait before running again." },
});

// 20 messages per user per hour — prevents inbox-flooding another user
const sendMessageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => `msg-send:${(req as any).user?.userId ?? ipKeyGenerator(req.ip || "")}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages sent. Please wait before sending more." },
});

// GET /api/messages — get user's messages
router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const { folder } = req.query; // inbox or sent
    const where = folder === "sent"
      ? { senderId: req.user!.userId }
      : { receiverId: req.user!.userId };

    const messages = await prisma.message.findMany({
      where,
      include: {
        sender: { select: { id: true, name: true, role: true } },
        receiver: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(messages);
  } catch (err) {
    console.error("Messages error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/messages — send a message
router.post("/", authenticate, sendMessageLimiter, async (req: Request, res: Response) => {
  try {
    const { receiverId, receiverEmail, subject, body, priority, queueType, savedView, actionSource } = req.body;
    if ((!receiverId && !receiverEmail) || !body) {
      return res.status(400).json({ error: "Recipient and body are required" });
    }

    const receiver = receiverEmail
      ? await prisma.user.findUnique({ where: { email: receiverEmail } })
      : await prisma.user.findUnique({ where: { id: receiverId } });

    // Return the same error whether the user doesn't exist or is out of scope —
    // distinguishing the two would let callers enumerate registered emails.
    if (!receiver || !(await canSendMessage(req.user!.userId, receiver.id))) {
      return res.status(404).json({ error: "Recipient not found or not eligible to receive messages from you." });
    }

    const message = await prisma.message.create({
      data: {
        senderId: req.user!.userId,
        receiverId: receiver.id,
        subject,
        body,
        priority: priority || false,
      },
      include: {
        sender: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } },
      },
    });

    // Create notification for receiver
    await prisma.notification.create({
      data: {
        userId: receiver.id,
        type: "NEW_MESSAGE",
        title: "New Message",
        body: subject || "You have a new message",
        data: JSON.stringify({ href: "/messages?tab=inbox" }),
      },
    });

    const actorProfile = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        schoolId: true,
        cohort: { select: { schoolId: true } },
        classroom: { select: { schoolId: true } },
        cohortMemberships: {
          where: { isActive: true },
          orderBy: [{ updatedAt: "desc" }],
          select: { cohort: { select: { schoolId: true } } },
        },
      },
    });
    const actorSchoolId = actorProfile ? resolveSchoolId(actorProfile) : null;
    if (actorSchoolId && receiver.role === "STUDENT") {
      await logInterventionCampaign({
        schoolId: actorSchoolId,
        actorId: req.user!.userId,
        actionType: actionSource === "QUEUE_REMINDER" ? "QUEUE_REMINDER" : "DIRECT_MESSAGE",
        audienceType: "DIRECT_STUDENT",
        queueType: queueType || null,
        savedView: savedView || null,
        subject,
        body,
        priority,
        metadata: { receiverId: receiver.id },
        recipients: [{ studentId: receiver.id, messageId: message.id }],
      });
    }

    res.status(201).json(message);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/messages/:id/read — mark as read
router.put("/:id/read", authenticate, async (req: Request, res: Response) => {
  try {
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!message || message.receiverId !== req.user!.userId) {
      return res.status(403).json({ error: "Cannot modify this message" });
    }

    const updated = await prisma.message.update({
      where: { id: req.params.id },
      data: { read: true },
    });
    res.json(updated);
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/notifications — get user's notifications
router.get("/notifications", authenticate, async (req: Request, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user!.userId,
        NOT: { type: { startsWith: SYSTEM_NOTIFICATION_PREFIX } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(notifications);
  } catch (err) {
    console.error("Notifications error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/notifications/unread-count", authenticate, async (req: Request, res: Response) => {
  try {
    const unread = await prisma.notification.count({
      where: {
        userId: req.user!.userId,
        read: false,
        NOT: { type: { startsWith: SYSTEM_NOTIFICATION_PREFIX } },
      },
    });
    res.json({ unread });
  } catch (err) {
    console.error("Notification unread count error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/notifications/:id/read
router.put("/notifications/:id/read", authenticate, async (req: Request, res: Response) => {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification || notification.userId !== req.user!.userId) {
      return res.status(403).json({ error: "Cannot modify this notification" });
    }
    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true },
    });
    res.json(updated);
  } catch (err) {
    console.error("Read notification error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/interventions/cases", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const query = z.object({
      studentId: z.string().optional(),
      status: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).parse(req.query);

    const actor = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        schoolId: true,
        cohort: { select: { schoolId: true } },
        classroom: { select: { schoolId: true } },
        cohortMemberships: {
          where: { isActive: true },
          orderBy: [{ updatedAt: "desc" }],
          select: { cohort: { select: { schoolId: true } } },
        },
      },
    });
    const actorSchoolId = actor ? resolveSchoolId(actor) : null;
    if (!actorSchoolId) return res.status(400).json({ error: "Not associated with a school" });

    const school = await prisma.school.findUnique({
      where: { id: actorSchoolId },
      select: { id: true, requiredHours: true, serviceStartDate: true, serviceEndDate: true },
    });
    if (!school) return res.status(404).json({ error: "School not found" });

    const cases = await prisma.interventionCase.findMany({
      where: {
        schoolId: actorSchoolId,
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        owner: { select: { id: true, name: true, role: true, email: true } },
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            grade: true,
            cohortId: true,
            cohort: { select: { id: true, name: true, requiredHours: true, serviceStartDate: true, serviceEndDate: true } },
            cohortMemberships: {
              where: { isActive: true },
              orderBy: [{ updatedAt: "desc" }],
              select: { cohortId: true, isActive: true, cohort: { select: { id: true, name: true, requiredHours: true, serviceStartDate: true, serviceEndDate: true } } },
            },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: query.limit ?? 50,
    });

    const progress = await buildStudentProgressRecords(cases.map((item) => item.student), {
      requiredHours: school.requiredHours,
      serviceStartDate: school.serviceStartDate,
      serviceEndDate: school.serviceEndDate,
    });
    const progressById = new Map(progress.map((item) => [item.id, item]));

    const followUpSessions = cases.length
      ? await prisma.serviceSession.findMany({
          where: {
            userId: { in: cases.map((item) => item.studentId) },
          },
          select: { userId: true, submittedAt: true, checkInTime: true, checkOutTime: true },
          orderBy: { updatedAt: "desc" },
        })
      : [];

    const latestActionByStudent = new Map<string, Date>();
    for (const session of followUpSessions) {
      const candidate = [session.submittedAt, session.checkInTime, session.checkOutTime]
        .filter((value): value is Date => value instanceof Date)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      if (!candidate) continue;
      const prior = latestActionByStudent.get(session.userId);
      if (!prior || candidate.getTime() > prior.getTime()) {
        latestActionByStudent.set(session.userId, candidate);
      }
    }

    res.json({
      cases: cases.map((item) => {
        const studentProgress = progressById.get(item.studentId);
        const lastStudentActionAt = latestActionByStudent.get(item.studentId) ?? item.lastStudentActionAt ?? null;
        const followUpSeen = !!(lastStudentActionAt && item.lastContactedAt && lastStudentActionAt.getTime() > item.lastContactedAt.getTime());
        return {
          id: item.id,
          studentId: item.studentId,
          schoolId: item.schoolId,
          status: item.status,
          priority: item.priority,
          reason: item.reason,
          summary: item.summary,
          nextStepForStudent: item.nextStepForStudent,
          nextStepForStaff: item.nextStepForStaff,
          staffNote: item.staffNote,
          studentMessage: item.studentMessage,
          dueDate: item.dueDate,
          lastContactedAt: item.lastContactedAt,
          lastStudentActionAt,
          resolvedAt: item.resolvedAt,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          followUpSeen,
          owner: item.owner,
          student: {
            id: item.student.id,
            name: item.student.name,
            email: item.student.email,
            grade: item.student.grade,
            approvedHours: studentProgress?.approvedHours ?? 0,
            pendingHours: studentProgress?.pendingHours ?? 0,
            requiredHours: studentProgress?.requiredHours ?? school.requiredHours,
            remainingHours: studentProgress?.remainingHours ?? Math.max(0, school.requiredHours - (studentProgress?.approvedHours ?? 0)),
            percentComplete: studentProgress?.percentComplete ?? 0,
            status: studentProgress?.status ?? "ON_TRACK",
            riskLevel: studentProgress?.riskLevel ?? "NONE",
            riskReasons: studentProgress?.riskReasons ?? [],
            noShowCount: studentProgress?.noShowCount ?? 0,
            daysToDeadline: studentProgress?.daysToDeadline ?? null,
            cohortName: studentProgress?.cohortName ?? item.student.cohort?.name ?? null,
          },
        };
      }),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    console.error("Intervention cases error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/interventions/cases/:studentId", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const body = z.object({
      status: z.enum(["OPEN", "WAITING_ON_STUDENT", "WAITING_ON_SCHOOL", "MONITORING", "RESOLVED"]),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
      reason: z.string().max(500).optional().or(z.literal("")),
      summary: z.string().max(500).optional().or(z.literal("")),
      nextStepForStudent: z.string().max(1000).optional().or(z.literal("")),
      nextStepForStaff: z.string().max(1000).optional().or(z.literal("")),
      staffNote: z.string().max(4000).optional().or(z.literal("")),
      studentMessage: z.string().max(1000).optional().or(z.literal("")),
      dueDate: z.string().datetime().optional().or(z.literal("")),
      ownerId: z.string().optional().or(z.literal("")),
    }).parse(req.body);

    const actor = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        schoolId: true,
        cohort: { select: { schoolId: true } },
        classroom: { select: { schoolId: true } },
        cohortMemberships: {
          where: { isActive: true },
          orderBy: [{ updatedAt: "desc" }],
          select: { cohort: { select: { schoolId: true } } },
        },
      },
    });
    const actorSchoolId = actor ? resolveSchoolId(actor) : null;
    if (!actorSchoolId) return res.status(400).json({ error: "Not associated with a school" });

    const student = await prisma.user.findFirst({
      where: {
        id: req.params.studentId,
        role: "STUDENT",
        OR: [
          { schoolId: actorSchoolId },
          { cohort: { schoolId: actorSchoolId } },
          { classroom: { schoolId: actorSchoolId } },
          { cohortMemberships: { some: { isActive: true, cohort: { schoolId: actorSchoolId } } } },
        ],
      },
      select: { id: true },
    });
    if (!student) return res.status(404).json({ error: "Student not found for this school" });

    if (body.ownerId) {
      const owner = await prisma.user.findFirst({
        where: { id: body.ownerId, schoolId: actorSchoolId, role: { in: ["SCHOOL_ADMIN", "TEACHER"] } },
        select: { id: true },
      });
      if (!owner) return res.status(404).json({ error: "Owner not found for this school" });
    }

    const interventionCase = await prisma.interventionCase.upsert({
      where: { schoolId_studentId: { schoolId: actorSchoolId, studentId: student.id } },
      create: {
        schoolId: actorSchoolId,
        studentId: student.id,
        ownerId: body.ownerId || req.user!.userId,
        status: body.status,
        priority: body.priority,
        reason: body.reason || null,
        summary: body.summary || null,
        nextStepForStudent: body.nextStepForStudent || null,
        nextStepForStaff: body.nextStepForStaff || null,
        staffNote: body.staffNote || null,
        studentMessage: body.studentMessage || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        resolvedAt: body.status === "RESOLVED" ? new Date() : null,
      },
      update: {
        ownerId: body.ownerId || req.user!.userId,
        status: body.status,
        priority: body.priority,
        reason: body.reason || null,
        summary: body.summary || null,
        nextStepForStudent: body.nextStepForStudent || null,
        nextStepForStaff: body.nextStepForStaff || null,
        staffNote: body.staffNote || null,
        studentMessage: body.studentMessage || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        resolvedAt: body.status === "RESOLVED" ? new Date() : null,
      },
      include: {
        owner: { select: { id: true, name: true, role: true, email: true } },
      },
    });

    res.json(interventionCase);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    console.error("Update intervention case error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/interventions/history", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const query = z.object({
      studentId: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).parse(req.query);

    const actor = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { schoolId: true },
    });
    if (!actor?.schoolId) {
      return res.status(400).json({ error: "Not associated with a school" });
    }

    let campaigns;
    try {
      campaigns = await prisma.interventionCampaign.findMany({
        where: {
          schoolId: actor.schoolId,
          ...(query.studentId ? { recipients: { some: { studentId: query.studentId } } } : {}),
        },
        include: {
          actor: { select: { id: true, name: true, role: true } },
          recipients: {
            include: {
              student: { select: { id: true, name: true, email: true } },
              message: { select: { id: true, createdAt: true, subject: true, priority: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: query.limit ?? 25,
      });
    } catch (err) {
      console.warn("[messages] Campaign history lookup failed; returning empty list:", err);
      campaigns = [];
    }

    const summaries = await Promise.all(campaigns.map(async (campaign) => {
      const recipientIds = campaign.recipients.map((recipient) => recipient.studentId);
      let followUpIds = new Set<string>();
      if (recipientIds.length) {
        try {
          const followUpSessions = await prisma.serviceSession.findMany({
            where: {
              userId: { in: recipientIds },
              OR: [
                { updatedAt: { gt: campaign.createdAt } },
                { submittedAt: { gt: campaign.createdAt } },
                { verifiedAt: { gt: campaign.createdAt } },
                { checkInTime: { gt: campaign.createdAt } },
                { checkOutTime: { gt: campaign.createdAt } },
              ],
            },
            select: { userId: true },
            distinct: ["userId"],
          });
          followUpIds = new Set(followUpSessions.map((session) => session.userId));
        } catch (err) {
          console.warn("[messages] Follow-up session lookup failed; skipping follow-up flag:", err);
        }
      }
      const recipients = campaign.recipients.map((recipient) => ({
        id: recipient.id,
        studentId: recipient.student.id,
        studentName: recipient.student.name,
        studentEmail: recipient.student.email,
        messageId: recipient.message?.id ?? null,
        messagedAt: recipient.message?.createdAt ?? recipient.createdAt,
        followUpAfterSend: followUpIds.has(recipient.student.id),
      }));
      return {
        id: campaign.id,
        actionType: campaign.actionType,
        audienceType: campaign.audienceType,
        queueType: campaign.queueType,
        savedView: campaign.savedView,
        subject: campaign.subject,
        bodyPreview: campaign.bodyPreview,
        priority: campaign.priority,
        recipientCount: campaign.recipientCount,
        metadata: safeJsonParse<Record<string, unknown>>(campaign.metadata),
        createdAt: campaign.createdAt,
        actor: campaign.actor,
        followUpCount: recipients.filter((recipient) => recipient.followUpAfterSend).length,
        recipients,
      };
    }));

    res.json({ campaigns: summaries });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    console.error("Intervention history error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/messages/bulk — school-wide announcements and mass reminders
router.post("/bulk", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const body = z.object({
      audience: z.enum(["ALL_STUDENTS", "AT_RISK_STUDENTS", "COHORT_STUDENTS"]).optional(),
      cohortId: z.string().optional(),
      receiverIds: z.array(z.string()).max(500).optional(),
      subject: z.string().max(255).optional(),
      body: z.string().min(1).max(5000),
      priority: z.boolean().optional(),
      queueType: z.string().max(100).optional(),
      savedView: z.string().max(100).optional(),
    }).parse(req.body);

    if (!body.audience && (!body.receiverIds || body.receiverIds.length === 0)) {
      return res.status(400).json({ error: "Either audience or receiverIds is required" });
    }

    const actor = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, schoolId: true, name: true },
    });
    if (!actor?.schoolId) {
      return res.status(400).json({ error: "Not associated with a school" });
    }

    const school = await prisma.school.findUnique({
      where: { id: actor.schoolId },
      select: {
        id: true,
        name: true,
        requiredHours: true,
        serviceStartDate: true,
        serviceEndDate: true,
      },
    });
    if (!school) return res.status(404).json({ error: "School not found" });

    if (body.audience === "COHORT_STUDENTS" && !body.cohortId) {
      return res.status(400).json({ error: "cohortId is required for cohort announcements" });
    }

    if (body.cohortId) {
      const cohort = await prisma.cohort.findFirst({
        where: { id: body.cohortId, schoolId: school.id },
        select: { id: true },
      });
      if (!cohort) {
        return res.status(404).json({ error: "Cohort not found for this school" });
      }
    }

    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        OR: [
          { classroom: { schoolId: school.id } },
          { cohort: { schoolId: school.id } },
          { cohortMemberships: { some: { isActive: true, cohort: { schoolId: school.id } } } },
        ],
        ...(body.cohortId ? {
          AND: [{
            OR: [
              { cohortId: body.cohortId },
              { cohortMemberships: { some: { isActive: true, cohortId: body.cohortId } } },
            ],
          }],
        } : {}),
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
          orderBy: [{ updatedAt: "desc" }],
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
      orderBy: { name: "asc" },
    });

    const recipientPool = new Map(students.map((student) => [student.id, student]));

    const recipients = body.receiverIds?.length
      ? body.receiverIds
          .filter((id, index, arr) => arr.indexOf(id) === index)
          .filter((id) => recipientPool.has(id))
          .map((id) => ({ id }))
      : body.audience === "AT_RISK_STUDENTS"
        ? (await buildStudentProgressRecords(students, {
            requiredHours: school.requiredHours,
            serviceStartDate: school.serviceStartDate,
            serviceEndDate: school.serviceEndDate,
          }))
            .filter((student) => student.status === "AT_RISK")
            .map((student) => ({ id: student.id }))
        : students.map((student) => ({ id: student.id }));

    if (recipients.length === 0) {
      return res.json({ recipientCount: 0, message: "No matching recipients found" });
    }

    const subject = body.subject?.trim() || (
      body.audience === "AT_RISK_STUDENTS"
        ? `${school.name}: reminder to review your service hours`
        : body.receiverIds?.length
          ? `${school.name}: staff follow-up`
          : `${school.name} announcement`
    );

    const createdMessages = await prisma.$transaction(
      recipients.map((recipient) => prisma.message.create({
        data: {
          senderId: actor.id,
          receiverId: recipient.id,
          subject,
          body: body.body,
          priority: Boolean(body.priority),
        },
        select: { id: true, receiverId: true },
      }))
    );

    await prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        userId: recipient.id,
        type: "SCHOOL_ANNOUNCEMENT",
        title: subject,
        body: body.body,
        data: JSON.stringify({ href: "/messages?tab=notifications" }),
      })),
    });

    await logInterventionCampaign({
      schoolId: school.id,
      actorId: actor.id,
      actionType: "BULK_MESSAGE",
      audienceType: body.audience ?? "CUSTOM_SELECTION",
      queueType: body.queueType ?? null,
      savedView: body.savedView ?? null,
      subject,
      body: body.body,
      priority: body.priority,
      metadata: body.cohortId ? { cohortId: body.cohortId } : null,
      recipients: createdMessages.map((message) => ({ studentId: message.receiverId, messageId: message.id })),
    });

    res.status(201).json({
      recipientCount: recipients.length,
      subject,
      audience: body.audience ?? "CUSTOM_SELECTION",
      sender: actor.name,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    console.error("Bulk message error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/messages/reminders/run — manually run the reminder cycle for the caller's school
router.post("/reminders/run", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), reminderRunLimiter, async (req: Request, res: Response) => {
  try {
    const actor = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { schoolId: true },
    });
    if (!actor?.schoolId) {
      return res.status(400).json({ error: "Not associated with a school" });
    }

    const summaries = await runReminderCycle(actor.schoolId);
    res.json(summaries[0] ?? null);
  } catch (err) {
    console.error("Reminder run error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
