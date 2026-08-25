import { createHash } from "crypto";
import type { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { verifyToken } from "./auth";

type Bucket = {
  count: number;
  resetAt: number;
};

type HybridRateLimitOptions = {
  namespace: string;
  windowMs: number;
  maxPerIp: number;
  maxPerUser?: number;
  maxPerKey?: number;
  keySuffix?: (req: Request) => string;
  keyGenerator?: (req: Request) => string | null | undefined;
  message?: string;
  skip?: (req: Request) => boolean;
  /** When true, only count requests whose response status indicates failure (>= 400). */
  skipSuccessfulRequests?: boolean;
  /** When true, only count requests whose response status indicates success (< 400). */
  skipFailedRequests?: boolean;
  /** When true, store errors return 429 instead of failing open. */
  failClosed?: boolean;
};

const buckets = new Map<string, Bucket>();
const cleanupWindowMs = 5 * 60 * 1000;
let lastCleanupAt = 0;
let lastDatabaseCleanupAt = 0;

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim() || "";
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || "";
const hasSharedStore = Boolean(upstashUrl && upstashToken);
const shouldUseDatabaseStore =
  !hasSharedStore &&
  (process.env.APP_ENV === "production" || process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production");

if (hasSharedStore) {
  console.info("[RateLimit] Using Upstash Redis shared bucket store.");
} else if (shouldUseDatabaseStore) {
  console.info("[RateLimit] Using PostgreSQL shared bucket store.");
} else {
  console.warn(
    "[RateLimit] Using in-memory bucket store. On Vercel serverless, rate limits reset on every cold start. " +
    "Configure shared production rate limiting with PostgreSQL or Upstash."
  );
}

function cleanupExpiredBuckets(now: number) {
  if (now - lastCleanupAt < cleanupWindowMs) return;
  lastCleanupAt = now;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function scheduleDatabaseBucketCleanup(now: number) {
  if (now - lastDatabaseCleanupAt < cleanupWindowMs) return;
  lastDatabaseCleanupAt = now;
  void prisma.$executeRawUnsafe('DELETE FROM "RateLimitBucket" WHERE "resetAt" < NOW()')
    .catch((err) => console.error("[RateLimit] Expired bucket cleanup failed:", err));
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

type RateLimitBucketResult = {
  count: number;
  resetAt: number;
};

async function takeSharedBucket(key: string, windowMs: number): Promise<RateLimitBucketResult> {
  const now = Date.now();
  const windowId = Math.floor(now / windowMs);
  const windowStart = windowId * windowMs;
  const resetAt = windowStart + windowMs;
  const ttlSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000) + 60);
  const bucketKey = `${key}:${windowId}`;

  const response = await fetch(`${upstashUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${upstashToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", bucketKey],
      ["EXPIRE", bucketKey, String(ttlSeconds)],
    ]),
  });

  if (!response.ok) {
    throw new Error(`Upstash rate limit pipeline failed with ${response.status}`);
  }

  const payload = await response.json() as Array<{ result?: number | string; error?: string }>;
  const incrementResult = payload?.[0];
  if (!incrementResult || incrementResult.error) {
    throw new Error(incrementResult?.error || "Upstash rate limit increment failed");
  }

  const count = Number(incrementResult.result);
  if (!Number.isFinite(count) || count < 1) {
    throw new Error("Upstash rate limit returned invalid count");
  }

  return { count, resetAt };
}

async function takeDatabaseBucket(key: string, windowMs: number): Promise<RateLimitBucketResult> {
  scheduleDatabaseBucketCleanup(Date.now());

  // Fixed windows are aligned to the epoch, exactly like the in-memory store,
  // so every process agrees on when the current window ends no matter which
  // process created the bucket row. Storing and returning this same boundary
  // keeps Retry-After honest (previously every request after the first in a
  // window reported a full window of remaining time).
  const now = Date.now();
  const windowId = Math.floor(now / windowMs);
  const windowEnd = new Date((windowId + 1) * windowMs);

  const rows = await prisma.$queryRawUnsafe(
    `INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "createdAt", "updatedAt")
     VALUES ($1, 1, $2, NOW(), NOW())
     ON CONFLICT ("key") DO UPDATE
     SET
       "count" = CASE
         WHEN "RateLimitBucket"."resetAt" <= NOW() THEN 1
         ELSE "RateLimitBucket"."count" + 1
       END,
       "resetAt" = CASE
         WHEN "RateLimitBucket"."resetAt" <= NOW() THEN $2
         ELSE "RateLimitBucket"."resetAt"
       END,
       "updatedAt" = NOW()
     RETURNING "count"`,
    key,
    windowEnd
  ) as Array<{ count: number }>;

  const row = rows[0];
  if (!row) {
    throw new Error("Database rate limit upsert returned no row");
  }

  return {
    count: Number(row.count),
    // The epoch-aligned boundary computed from this process clock — never
    // reserialize the database's timestamp-without-time-zone value through
    // the driver's session-timezone conversion.
    resetAt: (windowId + 1) * windowMs,
  };
}

async function takeRateLimitBucket(key: string, windowMs: number): Promise<RateLimitBucketResult> {
  if (hasSharedStore) {
    return takeSharedBucket(key, windowMs);
  }

  if (shouldUseDatabaseStore) {
    return takeDatabaseBucket(key, windowMs);
  }

  const local = takeBucket(key, windowMs);
  return {
    count: local.count,
    resetAt: local.resetAt,
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

  try {
    const payload = verifyToken(token);
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

/**
 * Decrement a bucket counter after a request completes, used when
 * skipSuccessfulRequests or skipFailedRequests is active and the response
 * status doesn't match the filter (i.e., the request shouldn't have counted).
 *
 * In-memory buckets decrement synchronously. For the PostgreSQL store we run
 * a guarded decrement ("count" > 0, so under-count is impossible) and the
 * middleware awaits it inside the wrapped res.end — otherwise the release
 * would silently do nothing on the durable path and successful logins would
 * erode auth quotas.
 */
function releaseInMemoryBucket(key: string, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (bucket && bucket.resetAt > now && bucket.count > 0) {
    bucket.count -= 1;
  }
}

async function releaseSharedBuckets(keys: string[]) {
  await Promise.all(
    keys.map((key) =>
      prisma
        .$executeRawUnsafe(
          `UPDATE "RateLimitBucket" SET "count" = "count" - 1, "updatedAt" = NOW()
           WHERE "key" = $1 AND "count" > 0`,
          key
        )
        .catch(() => {
          // Best-effort release: over-count is the safe failure mode.
        })
    )
  );
}

function isErrorResponse(statusCode: number): boolean {
  return statusCode >= 400 || statusCode === 0; // 0 = no status set yet
}

export function createHybridRateLimit(options: HybridRateLimitOptions) {
  const hasResponseFilter = options.skipSuccessfulRequests || options.skipFailedRequests;
  const failClosed = options.failClosed === true;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (options.skip?.(req)) {
      next();
      return;
    }

    try {
      const ip = getClientIp(req);
      const userId = getAuthenticatedUserId(req);
      const now = Date.now();
      const keySuffix = options.keySuffix?.(req)?.trim();
      const suffix = keySuffix ? `:${hashKey(keySuffix)}` : "";

      const ipBucket = await takeRateLimitBucket(
        `${options.namespace}:ip:${hashKey(ip)}${suffix}`,
        options.windowMs
      );
      const ipRemaining = Math.max(0, options.maxPerIp - ipBucket.count);

      let userRemaining: number | null = null;
      let userResetAt: number | null = null;
      let keyRemaining: number | null = null;
      let keyResetAt: number | null = null;
      let blockedRetryAfterMs: number | null = null;

      if (ipBucket.count > options.maxPerIp) {
        blockedRetryAfterMs = ipBucket.resetAt - now;
      }

      if (userId && options.maxPerUser) {
        const userBucket = await takeRateLimitBucket(
          `${options.namespace}:user:${hashKey(userId)}${suffix}`,
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

      const rateLimitKey = options.keyGenerator?.(req)?.trim();
      if (rateLimitKey && options.maxPerKey) {
        const keyBucket = await takeRateLimitBucket(
          `${options.namespace}:key:${hashKey(rateLimitKey)}`,
          options.windowMs
        );
        keyRemaining = Math.max(0, options.maxPerKey - keyBucket.count);
        keyResetAt = keyBucket.resetAt;

        if (keyBucket.count > options.maxPerKey) {
          blockedRetryAfterMs = Math.max(blockedRetryAfterMs ?? 0, keyBucket.resetAt - now);
        }
      }

      const resetAt = Math.max(ipBucket.resetAt, userResetAt ?? 0, keyResetAt ?? 0);
      const configuredLimits = [options.maxPerIp, options.maxPerUser, options.maxPerKey]
        .filter((limit): limit is number => typeof limit === "number");
      const remainingLimits = [ipRemaining, userRemaining, keyRemaining]
        .filter((remaining): remaining is number => remaining !== null);
      res.setHeader("RateLimit-Policy", `${options.maxPerIp};w=${Math.ceil(options.windowMs / 1000)}`);
      res.setHeader(
        "RateLimit-Limit",
        String(Math.min(...configuredLimits))
      );
      res.setHeader(
        "RateLimit-Remaining",
        String(Math.min(...remainingLimits))
      );
      res.setHeader("RateLimit-Reset", String(Math.max(1, Math.ceil((resetAt - now) / 1000))));

      if (blockedRetryAfterMs !== null && blockedRetryAfterMs > 0) {
        buildRateLimitResponse(
          res,
          options.message ?? "Too many requests. Please wait before trying again.",
          blockedRetryAfterMs
        );
        return;
      }

      // When skipSuccessfulRequests or skipFailedRequests is active, we need
      // to check the final response status AFTER the handler runs and release
      // the bucket if the request shouldn't have been counted.
      if (hasResponseFilter && typeof (res as any).end === "function") {
        const originalEnd = res.end.bind(res);
        const ipKey = `${options.namespace}:ip:${hashKey(ip)}${suffix}`;
        const userKey = userId && options.maxPerUser
          ? `${options.namespace}:user:${hashKey(userId)}${suffix}`
          : null;
        const keyBucketKey = rateLimitKey && options.maxPerKey
          ? `${options.namespace}:key:${hashKey(rateLimitKey)}`
          : null;

        (res as any).end = async function (this: Response, ...args: any[]) {
          const statusCode = this.statusCode || 200;
          const isError = isErrorResponse(statusCode);

          // Determine whether this response should NOT count toward the quota
          const shouldRelease =
            (options.skipSuccessfulRequests && !isError) ||
            (options.skipFailedRequests && isError);

          try {
            if (shouldRelease) {
              releaseInMemoryBucket(ipKey, options.windowMs);
              if (userKey) releaseInMemoryBucket(userKey, options.windowMs);
              if (keyBucketKey) releaseInMemoryBucket(keyBucketKey, options.windowMs);
              const sharedKeys = [ipKey, userKey, keyBucketKey].filter(
                (k): k is string => typeof k === "string"
              );
              if (sharedKeys.length > 0) {
                await releaseSharedBuckets(sharedKeys);
              }
            }
          } finally {
            return originalEnd.apply(this, args as any);
          }
        };
      }

      next();
    } catch (err) {
      if (failClosed) {
        console.error("[RateLimit] Store error (fail-closed):", err);
        buildRateLimitResponse(
          res,
          options.message ?? "Too many requests. Please wait before trying again.",
          options.windowMs
        );
        return;
      }
      console.error("[RateLimit] Falling back to open on store error:", err);
      next();
    }
  };
}

type EmailSendRateLimitOptions = {
  namespace: string;
  recipientKey: (req: Request) => string | null | undefined;
  suspiciousIpNamespace?: string;
};

// Sensitive email links are limited per recipient, regardless of source IP.
// A second bucket detects a single IP cycling through recipients (inbox bombing).
export function createEmailSendRateLimit(options: EmailSendRateLimitOptions) {
  const recipientLimiter = createHybridRateLimit({
    namespace: `${options.namespace}:recipient`,
    windowMs: 60 * 1000,
    maxPerIp: Number.MAX_SAFE_INTEGER,
    maxPerKey: 1,
    keyGenerator: options.recipientKey,
    message: "Please wait 60 seconds before requesting another email.",
  });
  const suspiciousIpLimiter = createHybridRateLimit({
    namespace: options.suspiciousIpNamespace ?? "email-send:ip",
    windowMs: 15 * 60 * 1000,
    maxPerIp: 10,
    message: "Too many email requests from this IP. Please try again later.",
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    let recipientAllowed = false;
    await recipientLimiter(req, res, (() => { recipientAllowed = true; }) as NextFunction);
    if (!recipientAllowed) return;
    await suspiciousIpLimiter(req, res, next);
  };
}
