/**
 * Runtime environment variable validator.
 * Called at server startup — crashes fast if required vars are missing.
 */

const REQUIRED = [
  "DATABASE_URL",
  "JWT_SECRET",
] as const;

const OPTIONAL = [
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
  "APP_ENV",                // "production" | "development" — set explicitly per Vercel project
  "DEV_DATABASE_URL",       // explicit development-only database URL; overrides DATABASE_URL when APP_ENV=development
  "ALLOW_SHARED_DEV_DATABASE", // set true only if you intentionally want dev to use a shared remote database
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
  }

  const optional = OPTIONAL.filter((k) => !process.env[k]);
  if (optional.length > 0) {
    console.warn("⚠️  Optional environment variables not set (some features may be disabled):");
    optional.forEach((k) => console.warn(`   - ${k}`));
  }

  return process.env as any;
}

export const env = validateEnv();
