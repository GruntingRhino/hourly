import { Router, Request, Response } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { buildStudentProgressRecords } from "../lib/studentProgress";
import { runReminderCycle } from "../lib/reminders";

const router = Router();

// 20 messages per user per hour — prevents inbox-flooding another user
const sendMessageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => `msg-send:${(req as any).user?.userId ?? req.ip}`,
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
    const { receiverId, receiverEmail, subject, body, priority } = req.body;
    if ((!receiverId && !receiverEmail) || !body) {
      return res.status(400).json({ error: "Recipient and body are required" });
    }

    const receiver = receiverEmail
      ? await prisma.user.findUnique({ where: { email: receiverEmail } })
      : await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) {
      return res.status(404).json({ error: "Recipient not found. Please check the email address." });
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
      },
    });

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
      where: { userId: req.user!.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(notifications);
  } catch (err) {
    console.error("Notifications error:", err);
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

// POST /api/messages/bulk — school-wide announcements and mass reminders
router.post("/bulk", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const body = z.object({
      audience: z.enum(["ALL_STUDENTS", "AT_RISK_STUDENTS", "COHORT_STUDENTS"]),
      cohortId: z.string().optional(),
      subject: z.string().max(255).optional(),
      body: z.string().min(1).max(5000),
      priority: z.boolean().optional(),
    }).parse(req.body);

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
        ],
        ...(body.cohortId ? { cohortId: body.cohortId } : {}),
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
      orderBy: { name: "asc" },
    });

    const recipients = body.audience === "AT_RISK_STUDENTS"
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
        : `${school.name} announcement`
    );

    await prisma.message.createMany({
      data: recipients.map((recipient) => ({
        senderId: actor.id,
        receiverId: recipient.id,
        subject,
        body: body.body,
        priority: Boolean(body.priority),
      })),
    });

    await prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        userId: recipient.id,
        type: "SCHOOL_ANNOUNCEMENT",
        title: subject,
        body: body.body,
      })),
    });

    res.status(201).json({
      recipientCount: recipients.length,
      subject,
      audience: body.audience,
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
router.post("/reminders/run", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
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
