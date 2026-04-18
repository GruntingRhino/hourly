import { Router, Request, Response } from "express";
import { runReminderCycle } from "../lib/reminders";

const router = Router();

function isProdLike(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function hasValidCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return !isProdLike();

  const authHeader = req.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  return token === secret;
}

async function handleReminderRun(req: Request, res: Response): Promise<void> {
  if (!hasValidCronSecret(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (isProdLike() && !process.env.CRON_SECRET) {
    res.status(503).json({ error: "CRON_SECRET is required in production" });
    return;
  }

  try {
    const schoolId = typeof req.query.schoolId === "string" ? req.query.schoolId : undefined;
    const summaries = await runReminderCycle(schoolId);
    res.json({
      ok: true,
      schoolId: schoolId ?? null,
      summaries,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
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

export default router;
