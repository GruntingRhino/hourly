/**
 * Canonical "are we running somewhere production-like" check.
 *
 * Deliberately a standalone, zero-dependency module: several files used to
 * redefine this check independently, and one copy (routes/schools.ts)
 * drifted to test only NODE_ENV/VERCEL_ENV and missed APP_ENV — a deployment
 * that sets only APP_ENV=production would have been treated as
 * non-production there, leaking a newly created teacher's temp password in
 * the create-staff API response. Import this instead of redefining the
 * check locally.
 *
 * This intentionally does NOT live in env.ts: env.ts runs full startup
 * validation (including `process.exit(1)` on missing required vars) as a
 * side effect of being imported, which is correct for the server entrypoint
 * but breaks anything — including isolated unit tests — that imports a
 * lower-level module expecting no such side effect.
 */
export function isProdLike(): boolean {
  return (
    process.env.APP_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}
