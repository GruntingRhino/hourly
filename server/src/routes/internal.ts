import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { runReminderCycle } from "../lib/reminders";
import { runEventReminderCycle } from "../lib/eventReminders";
import { runUploadCleanupCycle } from "../lib/uploadCleanup";
import { verifyGithubActionsOidcToken } from "../lib/githubActionsOidc";
import { getCanvasOperationalStatus } from "../services/canvasIntegration";
import { getGoogleClassroomOperationalStatus } from "../services/googleClassroomIntegration";
import { firstZodError, optionalTrimmedString, strictObject } from "../lib/validation";

const router = Router();

function isProdLike(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function hasValidCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = req.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return false;

  const expected = Buffer.from(secret, "utf8");
  const received = Buffer.from(token, "utf8");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

async function hasValidSchedulerAuth(req: Request): Promise<boolean> {
  if (hasValidCronSecret(req)) return true;

  const authHeader = req.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return false;

  try {
    return await verifyGithubActionsOidcToken(token);
  } catch (err) {
    console.warn("GitHub Actions OIDC verification failed:", err);
    return false;
  }
}

const internalQuerySchema = strictObject({
  schoolId: optionalTrimmedString(191),
});

async function handleReminderRun(req: Request, res: Response): Promise<void> {
  if (!await hasValidSchedulerAuth(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (isProdLike() && !process.env.CRON_SECRET) {
    res.status(503).json({ error: "CRON_SECRET is required in production" });
    return;
  }

  try {
    const { schoolId } = internalQuerySchema.parse({
      schoolId: typeof req.query.schoolId === "string" ? req.query.schoolId : undefined,
    });
    const summaries = await runReminderCycle(schoolId);
    res.json({
      ok: true,
      schoolId: schoolId ?? null,
      summaries,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: firstZodError(err) });
      return;
    }
    console.error("Internal reminder run error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

router.get("/reminders/run", (req, res) => {
  void handleReminderRun(req, res);
});

router.post("/reminders/run", (req, res) => {
  void handleReminderRun(req, res);
});

async function handleEventReminderRun(req: Request, res: Response): Promise<void> {
  if (!await hasValidSchedulerAuth(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (isProdLike() && !process.env.CRON_SECRET) {
    res.status(503).json({ error: "CRON_SECRET is required in production" });
    return;
  }

  try {
    await runEventReminderCycle();
    res.json({
      ok: true,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Internal event reminder run error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

router.get("/event-reminders/run", (req, res) => {
  void handleEventReminderRun(req, res);
});

router.post("/event-reminders/run", (req, res) => {
  void handleEventReminderRun(req, res);
});

async function handleUploadCleanupRun(req: Request, res: Response): Promise<void> {
  if (!await hasValidSchedulerAuth(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (isProdLike() && !process.env.CRON_SECRET) {
    res.status(503).json({ error: "CRON_SECRET is required in production" });
    return;
  }

  try {
    await runUploadCleanupCycle();
    res.json({
      ok: true,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Internal upload cleanup run error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

router.get("/upload-cleanup/run", (req, res) => {
  void handleUploadCleanupRun(req, res);
});

router.post("/upload-cleanup/run", (req, res) => {
  void handleUploadCleanupRun(req, res);
});

async function handleCanvasOps(req: Request, res: Response): Promise<void> {
  if (!await hasValidSchedulerAuth(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (isProdLike() && !process.env.CRON_SECRET) {
    res.status(503).json({ error: "CRON_SECRET is required in production" });
    return;
  }

  try {
    const { schoolId } = internalQuerySchema.parse({
      schoolId: typeof req.query.schoolId === "string" ? req.query.schoolId : undefined,
    });
    const status = await getCanvasOperationalStatus({ schoolId });
    res.json({ ok: true, ...status });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: firstZodError(err) });
      return;
    }
    console.error("Internal Canvas ops error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

router.get("/canvas/ops", (req, res) => {
  void handleCanvasOps(req, res);
});

async function handleGoogleClassroomOps(req: Request, res: Response): Promise<void> {
  if (!await hasValidSchedulerAuth(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (isProdLike() && !process.env.CRON_SECRET) {
    res.status(503).json({ error: "CRON_SECRET is required in production" });
    return;
  }

  try {
    const { schoolId } = internalQuerySchema.parse({
      schoolId: typeof req.query.schoolId === "string" ? req.query.schoolId : undefined,
    });
    const status = await getGoogleClassroomOperationalStatus({ schoolId });
    res.json({ ok: true, ...status });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: firstZodError(err) });
      return;
    }
    console.error("Internal Google Classroom ops error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

router.get("/googleClassroom/ops", (req, res) => {
  void handleGoogleClassroomOps(req, res);
});

export default router;
