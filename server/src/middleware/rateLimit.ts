import { createHash } from "crypto";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { AuthPayload } from "./auth";

type Bucket = {
  count: number;
  resetAt: number;
};

type HybridRateLimitOptions = {
  namespace: string;
  windowMs: number;
  maxPerIp: number;
  maxPerUser?: number;
  skip?: (req: Request) => boolean;
};

const buckets = new Map<string, Bucket>();
console.warn(
  "[RateLimit] Using in-memory bucket store. On Vercel serverless, rate limits reset on every cold start. " +
  "For production multi-instance deployments, configure an external store like Upstash Redis."
);
const cleanupWindowMs = 5 * 60 * 1000;
let lastCleanupAt = 0;

function cleanupExpiredBuckets(now: number) {
  if (now - lastCleanupAt < cleanupWindowMs) return;
  lastCleanupAt = now;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function takeBucket(key: string, windowMs: number) {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowMs };
    buckets.set(key, fresh);
    return {
      allowed: true,
      remaining: 0,
      resetAt: fresh.resetAt,
      count: fresh.count,
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: 0,
    resetAt: existing.resetAt,
    count: existing.count,
  };
}

function getClientIp(req: Request): string {
  const candidate =
    req.ip ||
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";

  return candidate.trim().toLowerCase();
}

function getAuthenticatedUserId(req: Request): string | null {
  if (req.user?.userId) return req.user.userId;

  const authHeader = req.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    const payload = jwt.verify(token, secret) as AuthPayload;
    return typeof payload.userId === "string" && payload.userId.trim()
      ? payload.userId.trim()
      : null;
  } catch {
    return null;
  }
}

function buildRateLimitResponse(res: Response, message: string, retryAfterMs: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  res.setHeader("Retry-After", String(retryAfterSeconds));
  res.status(429).json({
    error: message,
    code: "RATE_LIMITED",
    retryAfterSeconds,
  });
}

export function createHybridRateLimit(options: HybridRateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (options.skip?.(req)) {
      next();
      return;
    }

    const ip = getClientIp(req);
    const userId = getAuthenticatedUserId(req);
    const now = Date.now();

    const ipBucket = takeBucket(
      `${options.namespace}:ip:${hashKey(ip)}`,
      options.windowMs
    );
    const ipRemaining = Math.max(0, options.maxPerIp - ipBucket.count);

    let userRemaining: number | null = null;
    let userResetAt: number | null = null;
    let blockedRetryAfterMs: number | null = null;

    if (ipBucket.count > options.maxPerIp) {
      blockedRetryAfterMs = ipBucket.resetAt - now;
    }

    if (userId && options.maxPerUser) {
      const userBucket = takeBucket(
        `${options.namespace}:user:${hashKey(userId)}`,
        options.windowMs
      );
      userRemaining = Math.max(0, options.maxPerUser - userBucket.count);
      userResetAt = userBucket.resetAt;

      if (userBucket.count > options.maxPerUser) {
        blockedRetryAfterMs = Math.max(
          blockedRetryAfterMs ?? 0,
          userBucket.resetAt - now
        );
      }
    }

    const resetAt = Math.max(ipBucket.resetAt, userResetAt ?? 0);
    res.setHeader("RateLimit-Policy", `${options.maxPerIp};w=${Math.ceil(options.windowMs / 1000)}`);
    res.setHeader(
      "RateLimit-Limit",
      String(userId && options.maxPerUser ? Math.min(options.maxPerIp, options.maxPerUser) : options.maxPerIp)
    );
    res.setHeader(
      "RateLimit-Remaining",
      String(userRemaining === null ? ipRemaining : Math.min(ipRemaining, userRemaining))
    );
    res.setHeader("RateLimit-Reset", String(Math.max(1, Math.ceil((resetAt - now) / 1000))));

    if (blockedRetryAfterMs !== null && blockedRetryAfterMs > 0) {
      buildRateLimitResponse(
        res,
        "Too many requests. Please wait before trying again.",
        blockedRetryAfterMs
      );
      return;
    }

    next();
  };
}
