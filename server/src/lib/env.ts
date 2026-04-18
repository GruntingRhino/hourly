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
  "APP_URL",
  "CLIENT_URL",
  "PORT",
  "ALLOWED_ORIGINS",         // comma-separated list of allowed CORS origins
  "FIELD_ENCRYPTION_KEY",   // 64 hex chars — encrypts sensitive PII fields at rest
  "CRON_SECRET",            // shared secret for scheduled internal jobs (e.g. Vercel cron)
] as const;

type RequiredEnv = (typeof REQUIRED)[number];
type OptionalEnv = (typeof OPTIONAL)[number];

function validateEnv(): Record<RequiredEnv, string> & Partial<Record<OptionalEnv, string>> {
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

  const isProdLike = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
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
  }

  const optional = OPTIONAL.filter((k) => !process.env[k]);
  if (optional.length > 0) {
    console.warn("⚠️  Optional environment variables not set (some features may be disabled):");
    optional.forEach((k) => console.warn(`   - ${k}`));
  }

  return process.env as any;
}

export const env = validateEnv();
