import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import prisma from "../lib/prisma";
import {
  applyCanvasSyncForSchool,
  connectCanvasForSchool,
  disconnectCanvasForSchool,
  getCanvasErrorsForSchool,
  getCanvasOAuthUrlForSchool,
  getCanvasOperationalStatus,
  getCanvasStatusForSchool,
  handleCanvasOAuthCallback,
  previewCanvasSyncForSchool,
} from "../services/canvasIntegration";
import {
  applyGoogleClassroomSyncForSchool,
  connectGoogleClassroomForSchool,
  disconnectGoogleClassroomForSchool,
  getGoogleClassroomErrorsForSchool,
  getGoogleClassroomOAuthUrlForSchool,
  getGoogleClassroomOperationalStatus,
  getGoogleClassroomStatusForSchool,
  handleGoogleClassroomOAuthCallback,
  previewGoogleClassroomSyncForSchool,
} from "../services/googleClassroomIntegration";

const router = Router();

async function getSchoolIdForAdmin(req: Request, res: Response): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { schoolId: true },
  });
  const schoolId = user?.schoolId ?? null;
  if (!schoolId) {
    res.status(400).json({ error: "School administrator is not associated with a school" });
    return null;
  }
  return schoolId;
}

router.post("/canvas/connect", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req, res);
    if (!schoolId) return;
    const connection = await connectCanvasForSchool({
      schoolId,
      actorId: req.user!.userId,
      input: req.body,
    });
    res.status(201).json(connection);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = /production-like environments/i.test(message) ? 403 : 500;
    res.status(status).json({ error: message });
  }
});

router.get("/canvas/oauth/url", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req, res);
    if (!schoolId) return;
    const baseUrl = String(req.query.baseUrl || "").trim();
    const displayName = typeof req.query.displayName === "string" ? req.query.displayName : undefined;
    const result = await getCanvasOAuthUrlForSchool({
      schoolId,
      actorId: req.user!.userId,
      baseUrl,
      displayName,
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(400).json({ error: message });
  }
});

router.get("/canvas/oauth/callback", async (req: Request, res: Response) => {
  const redirectUrl = await handleCanvasOAuthCallback({
    code: typeof req.query.code === "string" ? req.query.code : undefined,
    state: typeof req.query.state === "string" ? req.query.state : undefined,
    error: typeof req.query.error === "string" ? req.query.error : undefined,
  });
  res.redirect(redirectUrl);
});

router.post("/canvas/disconnect", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req, res);
    if (!schoolId) return;
    const connection = await disconnectCanvasForSchool({
      schoolId,
      actorId: req.user!.userId,
    });
    res.json({ connection });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = /production-like environments/i.test(message) ? 403 : 500;
    res.status(status).json({ error: message });
  }
});

router.get("/canvas/status", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req, res);
    if (!schoolId) return;
    const status = await getCanvasStatusForSchool(schoolId);
    res.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = /production-like environments/i.test(message) ? 403 : 500;
    res.status(status).json({ error: message });
  }
});

router.get("/canvas/errors", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req, res);
    if (!schoolId) return;
    const errors = await getCanvasErrorsForSchool(schoolId);
    res.json(errors);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = /production-like environments/i.test(message) ? 403 : 500;
    res.status(status).json({ error: message });
  }
});

router.post("/canvas/preview", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req, res);
    if (!schoolId) return;
    const result = await previewCanvasSyncForSchool({
      schoolId,
      actorId: req.user!.userId,
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = /not connected/i.test(message) ? 400 : /production-like environments/i.test(message) ? 403 : 500;
    res.status(status).json({ error: message });
  }
});

router.post("/canvas/apply", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req, res);
    if (!schoolId) return;
    const result = await applyCanvasSyncForSchool({
      schoolId,
      actorId: req.user!.userId,
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = /not connected/i.test(message) ? 400 : /production-like environments/i.test(message) ? 403 : 500;
    res.status(status).json({ error: message });
  }
});

router.get("/canvas/ops", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req, res);
    if (!schoolId) return;
    const result = await getCanvasOperationalStatus({ schoolId });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.post("/googleClassroom/connect", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req, res);
    if (!schoolId) return;
    const connection = await connectGoogleClassroomForSchool({
      schoolId,
      actorId: req.user!.userId,
      input: req.body,
    });
    res.status(201).json(connection);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = /production-like environments/i.test(message) ? 403 : 500;
    res.status(status).json({ error: message });
  }
});

router.get("/googleClassroom/oauth/url", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req, res);
    if (!schoolId) return;
    const baseUrl = typeof req.query.baseUrl === "string" ? req.query.baseUrl.trim() : undefined;
    const displayName = typeof req.query.displayName === "string" ? req.query.displayName : undefined;
    const result = await getGoogleClassroomOAuthUrlForSchool({
      schoolId,
      actorId: req.user!.userId,
      baseUrl,
      displayName,
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(400).json({ error: message });
  }
});

router.get("/googleClassroom/oauth/callback", async (req: Request, res: Response) => {
  const redirectUrl = await handleGoogleClassroomOAuthCallback({
    code: typeof req.query.code === "string" ? req.query.code : undefined,
    state: typeof req.query.state === "string" ? req.query.state : undefined,
    error: typeof req.query.error === "string" ? req.query.error : undefined,
  });
  res.redirect(redirectUrl);
});

router.post("/googleClassroom/disconnect", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req, res);
    if (!schoolId) return;
    const connection = await disconnectGoogleClassroomForSchool({
      schoolId,
      actorId: req.user!.userId,
    });
    res.json({ connection });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = /production-like environments/i.test(message) ? 403 : 500;
    res.status(status).json({ error: message });
  }
});

router.get("/googleClassroom/status", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req, res);
    if (!schoolId) return;
    const status = await getGoogleClassroomStatusForSchool(schoolId);
    res.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = /production-like environments/i.test(message) ? 403 : 500;
    res.status(status).json({ error: message });
  }
});

router.get("/googleClassroom/errors", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req, res);
    if (!schoolId) return;
    const errors = await getGoogleClassroomErrorsForSchool(schoolId);
    res.json(errors);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = /production-like environments/i.test(message) ? 403 : 500;
    res.status(status).json({ error: message });
  }
});

router.post("/googleClassroom/preview", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req, res);
    if (!schoolId) return;
    const result = await previewGoogleClassroomSyncForSchool({
      schoolId,
      actorId: req.user!.userId,
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = /not connected/i.test(message) ? 400 : /production-like environments/i.test(message) ? 403 : 500;
    res.status(status).json({ error: message });
  }
});

router.post("/googleClassroom/apply", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req, res);
    if (!schoolId) return;
    const result = await applyGoogleClassroomSyncForSchool({
      schoolId,
      actorId: req.user!.userId,
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = /not connected/i.test(message) ? 400 : /production-like environments/i.test(message) ? 403 : 500;
    res.status(status).json({ error: message });
  }
});

router.get("/googleClassroom/ops", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req, res);
    if (!schoolId) return;
    const result = await getGoogleClassroomOperationalStatus({ schoolId });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

export default router;
