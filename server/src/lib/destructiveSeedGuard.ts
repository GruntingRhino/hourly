import { isProdLike } from "./isProdLike";

/**
 * Refuse to let a destructive seed script (one that TRUNCATEs or otherwise
 * irreversibly replaces core tables) run unless every one of these holds:
 *   - not a production-like environment (APP_ENV/NODE_ENV/VERCEL_ENV)
 *   - an explicit, deliberate opt-in env var is set
 *   - DATABASE_URL points at something that looks like a local or
 *     clearly-disposable test/QA database, not an arbitrary/production host
 * Throws with a specific reason instead of returning a boolean, so a script
 * can let the error propagate and exit non-zero with a clear message.
 */
export function assertSafeToRunDestructiveSeed(env: NodeJS.ProcessEnv = process.env): void {
  if (isProdLike()) {
    throw new Error(
      "[seed] Refusing to run: this looks like a production-like environment " +
      "(APP_ENV/NODE_ENV/VERCEL_ENV). This script truncates all core tables."
    );
  }

  if (env.ALLOW_DESTRUCTIVE_TEST_SEED !== "yes") {
    throw new Error(
      "[seed] Refusing to run: set ALLOW_DESTRUCTIVE_TEST_SEED=yes to confirm you intend to " +
      "irreversibly truncate every core table in the database this DATABASE_URL points at."
    );
  }

  const rawUrl = env.DATABASE_URL ?? "";
  let host = "";
  let dbName = "";
  try {
    const parsed = new URL(rawUrl);
    host = parsed.hostname.toLowerCase();
    dbName = parsed.pathname.replace(/^\//, "").toLowerCase();
  } catch {
    throw new Error("[seed] Refusing to run: DATABASE_URL is missing or not a valid connection string.");
  }

  const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const looksDisposable = /(test|qa|dev|local|disposable|staging|sandbox)/.test(dbName);
  if (!isLocalHost && !looksDisposable) {
    throw new Error(
      `[seed] Refusing to run: DATABASE_URL host "${host}" and database name "${dbName}" ` +
      "don't look like a local or clearly-disposable test/QA database. If this really is safe " +
      "to seed, rename the database to include test/qa/dev/local/disposable/staging/sandbox, " +
      "or point DATABASE_URL at localhost."
    );
  }
}
