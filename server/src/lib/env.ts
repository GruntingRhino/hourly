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

  const optional = OPTIONAL.filter((k) => !process.env[k]);
  if (optional.length > 0) {
    console.warn("⚠️  Optional environment variables not set (some features may be disabled):");
    optional.forEach((k) => console.warn(`   - ${k}`));
  }

  return process.env as any;
}

export const env = validateEnv();
