/**
 * Runtime environment variable validator.
 * Called at server startup — crashes fast if required vars are missing.
 */

const REQUIRED = [
  "DATABASE_URL",
  "JWT_SECRET",
] as const;

const OPTIONAL = [
  "JWT_SECRET_PREVIOUS",    // previous signing secret — kept during rotation so old sessions stay valid
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_CALLBACK_URL",
  "APP_URL",
  "CLIENT_URL",
  "PORT",
  "ALLOWED_ORIGINS",         // comma-separated list of allowed CORS origins
  "FIELD_ENCRYPTION_KEY",   // 64 hex chars — encrypts sensitive PII fields at rest
  "CRON_SECRET",            // shared secret for scheduled internal jobs (e.g. Vercel cron)
  "QR_ATTENDANCE_SECRET",   // optional separate HMAC secret for event attendance QR tokens
  "APP_ENV",                // "production" | "development" — set explicitly per Vercel project
  "DEV_DATABASE_URL",       // explicit development-only database URL; overrides DATABASE_URL when APP_ENV=development
  "ALLOW_SHARED_DEV_DATABASE", // set true only if you intentionally want dev to use a shared remote database
  "CANVAS_CLIENT_ID",
  "CANVAS_CLIENT_SECRET",
  "CANVAS_CALLBACK_URL",
  "CANVAS_ALLOWED_HOSTS", // comma-separated production Canvas tenant host allowlist
  "CANVAS_ENABLE_MOCK",
  "CANVAS_REQUEST_TIMEOUT_MS",
  "CANVAS_PAGE_SIZE",
  "GOOGLE_CLASSROOM_CLIENT_ID",
  "GOOGLE_CLASSROOM_CLIENT_SECRET",
  "GOOGLE_CLASSROOM_CALLBACK_URL",
  "GOOGLE_CLASSROOM_ENABLE_MOCK",
  "GOOGLE_CLASSROOM_REQUEST_TIMEOUT_MS",
  "GOOGLE_CLASSROOM_PAGE_SIZE",
  "GOOGLE_CLASSROOM_API_BASE_URL",
  "GOOGLE_CLASSROOM_AUTH_BASE_URL",
  "GOOGLE_CLASSROOM_TOKEN_BASE_URL",
  "GOOGLE_CLASSROOM_ALLOWED_HOSTS",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

type RequiredEnv = (typeof REQUIRED)[number];
type OptionalEnv = (typeof OPTIONAL)[number];

function validateEnv(): Record<RequiredEnv, string> & Partial<Record<OptionalEnv, string>> {
  const isDevelopmentLike =
    process.env.APP_ENV === "development" ||
    (process.env.APP_ENV !== "production" &&
      process.env.NODE_ENV !== "production" &&
      process.env.VERCEL_ENV !== "production");

  if (isDevelopmentLike && process.env.DEV_DATABASE_URL?.trim()) {
    process.env.DATABASE_URL = process.env.DEV_DATABASE_URL.trim();
  }

  const missing: string[] = [];

  for (const key of REQUIRED) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((k) => console.error(`   - ${k}`));
    console.error("\nSee .env.example for setup instructions.");
    process.exit(1);
  }

  // APP_ENV takes precedence; fall back to runtime env signals.
  const isProdLike =
    process.env.APP_ENV === "production" ||
    (process.env.APP_ENV !== "development" &&
      (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production"));

  if (isDevelopmentLike) {
    const dbUrl = process.env.DATABASE_URL || "";
    const allowSharedDevDatabase = process.env.ALLOW_SHARED_DEV_DATABASE === "true";
    const pointsToRemoteHostedDb = /neon\.tech|aws\.neon\.tech|pooler\./i.test(dbUrl);
    const looksNonProdDbName = /(?:\/|=)(?:[^/?#]*?(dev|test|local|staging|preview|sandbox)[^/?#]*)(?:\?|$)/i.test(dbUrl);
    const pointsToLocalDb = /localhost|127\.0\.0\.1/i.test(dbUrl);

    if (!allowSharedDevDatabase && pointsToRemoteHostedDb && !looksNonProdDbName && !pointsToLocalDb) {
      console.error("❌ Development environment is pointing at a remote shared database.");
      console.error("   Set DEV_DATABASE_URL to a separate development database/branch.");
      console.error("   If this is intentional, set ALLOW_SHARED_DEV_DATABASE=true.");
      process.exit(1);
    }
  }

  if (isProdLike) {
    const fieldKey = process.env.FIELD_ENCRYPTION_KEY;
    if (!fieldKey) {
      console.error("❌ FIELD_ENCRYPTION_KEY is required in production.");
      process.exit(1);
    }
    if (fieldKey.length !== 64 || !/^[0-9a-fA-F]+$/.test(fieldKey)) {
      console.error("❌ FIELD_ENCRYPTION_KEY must be exactly 64 hex characters in production.");
      process.exit(1);
    }

    if (!process.env.CRON_SECRET) {
      console.error("❌ CRON_SECRET is required in production to secure internal scheduled endpoints.");
      process.exit(1);
    }

    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      console.warn("⚠️  Shared Redis rate limiting is not configured in production.");
      console.warn("   Falling back to per-instance in-memory buckets until UPSTASH_REDIS_REST_URL and");
      console.warn("   UPSTASH_REDIS_REST_TOKEN are added.");
    }

    const canvasMockEnabled = process.env.CANVAS_ENABLE_MOCK === "true";
    if (canvasMockEnabled) {
      console.error("❌ CANVAS_ENABLE_MOCK=true is not allowed in production.");
      process.exit(1);
    }

    const hasAnyCanvasOAuthConfig = Boolean(
      process.env.CANVAS_CLIENT_ID || process.env.CANVAS_CLIENT_SECRET || process.env.CANVAS_CALLBACK_URL
    );
    if (hasAnyCanvasOAuthConfig) {
      if (!process.env.CANVAS_CLIENT_ID || !process.env.CANVAS_CLIENT_SECRET || !process.env.CANVAS_CALLBACK_URL) {
        console.error("❌ Canvas production configuration is incomplete. Set CANVAS_CLIENT_ID, CANVAS_CLIENT_SECRET, and CANVAS_CALLBACK_URL together.");
        process.exit(1);
      }
      if (!/^https:\/\//i.test(process.env.CANVAS_CALLBACK_URL)) {
        console.error("❌ CANVAS_CALLBACK_URL must use HTTPS in production.");
        process.exit(1);
      }
    }

    const classroomMockEnabled = process.env.GOOGLE_CLASSROOM_ENABLE_MOCK === "true";
    if (classroomMockEnabled) {
      console.error("❌ GOOGLE_CLASSROOM_ENABLE_MOCK=true is not allowed in production.");
      process.exit(1);
    }

    const hasAnyGoogleClassroomOAuthConfig = Boolean(
      process.env.GOOGLE_CLASSROOM_CLIENT_ID || process.env.GOOGLE_CLASSROOM_CLIENT_SECRET || process.env.GOOGLE_CLASSROOM_CALLBACK_URL
    );
    if (hasAnyGoogleClassroomOAuthConfig) {
      if (!process.env.GOOGLE_CLASSROOM_CLIENT_ID || !process.env.GOOGLE_CLASSROOM_CLIENT_SECRET || !process.env.GOOGLE_CLASSROOM_CALLBACK_URL) {
        console.error("❌ Google Classroom production configuration is incomplete. Set GOOGLE_CLASSROOM_CLIENT_ID, GOOGLE_CLASSROOM_CLIENT_SECRET, and GOOGLE_CLASSROOM_CALLBACK_URL together.");
        process.exit(1);
      }
      if (!/^https:\/\//i.test(process.env.GOOGLE_CLASSROOM_CALLBACK_URL)) {
        console.error("❌ GOOGLE_CLASSROOM_CALLBACK_URL must use HTTPS in production.");
        process.exit(1);
      }
      if (!process.env.GOOGLE_CLASSROOM_ALLOWED_HOSTS?.trim()) {
        console.error("❌ GOOGLE_CLASSROOM_ALLOWED_HOSTS is required in production when Google Classroom OAuth is configured.");
        process.exit(1);
      }
    }
  }

  const optional = OPTIONAL.filter((k) => !process.env[k]);
  if (optional.length > 0) {
    console.warn("⚠️  Optional environment variables not set (some features may be disabled):");
    optional.forEach((k) => console.warn(`   - ${k}`));
  }

  return process.env as any;
}

export const env = validateEnv();

export function isDevMode(): boolean {
  return !(
    process.env.APP_ENV === "production" ||
    (process.env.APP_ENV !== "development" &&
      (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production"))
  );
}
