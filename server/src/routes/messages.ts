import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";

const router = Router();

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
        sender: { select: { id: true, name: true, role: true, avatarUrl: true } },
        receiver: { select: { id: true, name: true, role: true, avatarUrl: true } },
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
router.post("/", authenticate, async (req: Request, res: Response) => {
  try {
    const { receiverId, subject, body, priority } = req.body;
    if (!receiverId || !body) {
      return res.status(400).json({ error: "receiverId and body are required" });
    }

    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) {
      return res.status(404).json({ error: "Recipient not found. Please check the User ID." });
    }

    const message = await prisma.message.create({
      data: {
        senderId: req.user!.userId,
        receiverId,
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
        userId: receiverId,
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

export default router;
