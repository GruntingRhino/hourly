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

const SCHOOL_ROLES = new Set(["SCHOOL_ADMIN", "TEACHER", "STUDENT"]);

function buildBodyPreview(body: string): string {
  return body.trim().replace(/\s+/g, " ").slice(0, 280);
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
  return prisma.interventionCampaign.create({
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
  });
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

  // Same school: staff<->student, staff<->staff — no student<->student
  if (sSchool && rSchool && sSchool === rSchool && SCHOOL_ROLES.has(sender.role) && SCHOOL_ROLES.has(receiver.role)) {
    if (sender.role === "STUDENT" && receiver.role === "STUDENT") return false;
    return true;
  }

  // School staff or student → BENEFICIARY_ADMIN: requires approved school↔beneficiary relationship
  if (SCHOOL_ROLES.has(sender.role) && sSchool && receiver.role === "BENEFICIARY_ADMIN" && receiver.beneficiaryId) {
    const approval = await prisma.schoolBeneficiaryApproval.findFirst({
      where: { schoolId: sSchool, beneficiaryId: receiver.beneficiaryId, status: "APPROVED" },
      select: { id: true },
    });
    return !!approval;
  }

  // BENEFICIARY_ADMIN → school staff (not students): requires approved relationship
  if (sender.role === "BENEFICIARY_ADMIN" && sender.beneficiaryId && rSchool && ["SCHOOL_ADMIN", "TEACHER"].includes(receiver.role)) {
    const approval = await prisma.schoolBeneficiaryApproval.findFirst({
      where: { schoolId: rSchool, beneficiaryId: sender.beneficiaryId, status: "APPROVED" },
      select: { id: true },
    });
    return !!approval;
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

    // Message preferences removed in new architecture

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
    if (actorSchoolId) {
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

    const campaigns = await prisma.interventionCampaign.findMany({
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

    const summaries = await Promise.all(campaigns.map(async (campaign) => {
      const recipientIds = campaign.recipients.map((recipient) => recipient.studentId);
      const followUpSessions = recipientIds.length
        ? await prisma.serviceSession.findMany({
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
          })
        : [];
      const followUpIds = new Set(followUpSessions.map((session) => session.userId));
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
        metadata: campaign.metadata ? JSON.parse(campaign.metadata) : null,
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
