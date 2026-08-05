import "./lib/env"; // Validate required env vars at startup
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { randomUUID } from "crypto";
import prisma from "./lib/prisma";
import path from "path";
import { geocodeAddress } from "./lib/geocode";
import authRoutes from "./routes/auth";
import googleAuthRoutes from "./routes/googleAuth";
import opportunityRoutes from "./routes/opportunities";
import signupRoutes from "./routes/signups";
import sessionRoutes from "./routes/sessions";
import verificationRoutes from "./routes/verification";
import organizationRoutes from "./routes/organizations";
import schoolRoutes from "./routes/schools";
import messageRoutes from "./routes/messages";
import reportRoutes from "./routes/reports";
import savedRoutes from "./routes/saved";
// New school-orchestrated architecture routes
import cohortRoutes from "./routes/cohorts";
import beneficiaryRoutes from "./routes/beneficiaries";
import invitationRoutes from "./routes/invitations";
import selfSubmissionRoutes from "./routes/selfSubmissions";
import classroomRoutes from "./routes/classrooms";
import internalRoutes from "./routes/internal";
import integrationRoutes from "./routes/integrations";
import billingRoutes from "./routes/billing";
import schoolProcurementRoutes from "./routes/schoolProcurement";
import schoolPartnerRoutes from "./routes/schoolPartners";
import stripeWebhookRoutes from "./routes/stripeWebhooks";
import { startReminderScheduler } from "./lib/reminders";
import { startUploadCleanupJob } from "./lib/uploadCleanup";
import { maybeRunEventReminderCycle, startEventReminderScheduler } from "./lib/eventReminders";
import { authenticate } from "./middleware/auth";
import { createHybridRateLimit } from "./middleware/rateLimit";
import { isProdLike } from "./lib/isProdLike";

const app = express();
const PORT = process.env.PORT || 3001;

// Attach a correlation ID to every request for log tracing
app.use((req: Request, res: Response, next: NextFunction) => {
  const id = (req.headers["x-request-id"] as string) || randomUUID();
  (req as any).requestId = id;
  res.setHeader("x-request-id", id);
  next();
});

// Structured request logger
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    if (req.path === "/api/health") return; // suppress health-check noise
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    console[level](JSON.stringify({
      type: "request",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms,
      ip: req.ip,
      userId: (req as any).user?.userId ?? null,
    }));
  });
  next();
});
// Trust Vercel/reverse-proxy X-Forwarded-For so express-rate-limit
// can identify real client IPs instead of always seeing the proxy IP.
app.set("trust proxy", 1);

// Security headers — sets X-Content-Type-Options, X-Frame-Options,
// Strict-Transport-Security, X-XSS-Protection, and others.
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // allow /uploads assets
}));

// Lock CORS to known origins. In dev any localhost port is fine;
// in production only the deployed frontend domain is permitted.
const EXPLICIT_ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

function isLocalDevOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no Origin (server-to-server, curl, mobile apps)
    if (!origin) return callback(null, true);
    // Exact-match only — wildcard subdomain matching risks subdomain-takeover attacks
    const PRODUCTION_GOODHOURS_ORIGINS = [
      "https://goodhours.app",
      "https://www.goodhours.app",
      "https://app.goodhours.app",
    ];
    if (
      EXPLICIT_ALLOWED_ORIGINS.includes(origin) ||
      (!isProdLike() && isLocalDevOrigin(origin)) ||
      PRODUCTION_GOODHOURS_ORIGINS.includes(origin)
    ) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(cookieParser());

// Stripe webhook needs raw body for signature verification
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookRoutes);

// Cohort roster imports post CSV data as JSON and can legitimately be large;
// everything else gets a tight limit so oversized payloads are rejected early.
app.use("/api/cohorts", express.json({ limit: "10mb" }));
app.use(express.json({ limit: "1mb" }));
// Uploaded evidence is served only through resource-specific, ownership-scoped routes.

app.use("/api", (req: Request, _res: Response, next: NextFunction) => {
  if (req.path !== "/health") {
    void maybeRunEventReminderCycle().catch((err) => {
      console.error("[eventReminders] Opportunistic run failed:", err);
    });
  }
  next();
});

// Baseline protection for every API route.
// Specialized route limiters below remain in place for sensitive workflows.
app.use(
  "/api",
  createHybridRateLimit({
    namespace: "api",
    windowMs: 5 * 60 * 1000,
    maxPerIp: 300,
    maxPerUser: 600,
    skip: (req) => !isProdLike() || req.path === "/health",
  })
);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/auth/google", googleAuthRoutes);
app.use("/api/internal", internalRoutes);
app.use("/api/integrations", integrationRoutes);

// New architecture routes
app.use("/api/billing/organizations", billingRoutes);
app.use("/api/school-procurement", schoolProcurementRoutes);
app.use("/api/school-partners", schoolPartnerRoutes);
app.use("/api/cohorts", cohortRoutes);
app.use("/api/beneficiaries", beneficiaryRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/self-submissions", selfSubmissionRoutes);
app.use("/api/classrooms", classroomRoutes);

// Legacy routes (kept for backward compat)
app.use("/api/opportunities", opportunityRoutes);
app.use("/api/signups", signupRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/schools", schoolRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/saved", savedRoutes);

// 30 geocode requests per IP per minute — Nominatim enforces 1 req/sec; this keeps us well under
const geocodeLimiter = createHybridRateLimit({
  namespace: "geocode",
  windowMs: 60 * 1000,
  maxPerIp: 30,
  maxPerUser: 60,
});

// Geocode endpoint — proxies Nominatim so the client never touches the external API directly.
// Authenticated: this was previously reachable by anonymous callers, turning it into an open
// proxy that could burn the app's Nominatim rate-limit budget for every authenticated caller.
// GET /api/geocode?address=123+Main+St,+Springfield,+IL
app.get("/api/geocode", authenticate, geocodeLimiter, async (req, res) => {
  const address =
    typeof req.query.address === "string" ? req.query.address.trim() : "";
  if (!address) {
    return res.status(400).json({ error: "address query param required" });
  }
  if (address.length > 300) {
    return res.status(400).json({ error: "address must be 300 characters or fewer" });
  }
  const coords = await geocodeAddress(address);
  if (!coords) {
    return res.status(404).json({ error: "Address not found" });
  }
  res.json(coords);
});

// Health check — includes DB connectivity
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "ok", timestamp: new Date().toISOString() });
  } catch {
    console.error(JSON.stringify({ type: "health_check_failed", db: "unreachable" }));
    res.status(503).json({ status: "degraded", db: "unreachable", timestamp: new Date().toISOString() });
  }
});

// JSON 404 handler — Express default returns HTML for unmatched routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Structured global error handler — catches any unhandled errors thrown in routes
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  console.error(JSON.stringify({
    type: "unhandled_error",
    requestId: (req as any).requestId,
    method: req.method,
    path: req.path,
    status,
    message: err.message,
    stack: isProdLike() ? undefined : err.stack,
  }));
  res.status(status).json({ error: status < 500 ? err.message : "Internal server error" });
});

const isDirectNodeEntry =
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module;

if (isDirectNodeEntry) {
  app.listen(PORT, () => {
    console.log(`GoodHours API running on http://localhost:${PORT}`);
    startReminderScheduler();
    startUploadCleanupJob();
    startEventReminderScheduler();
  });
}

export default app;
