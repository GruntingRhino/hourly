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

/**
 * True whenever this process is reachable at a real, non-local URL — a
 * production deployment OR a Vercel preview deployment. Preview
 * deployments are NOT production-like by isProdLike()'s definition (mock
 * data, QA bypasses, etc. are intentionally allowed there), but they ARE
 * externally reachable, often at a guessable/shared URL. Use this instead
 * of isProdLike() to gate anything that must be impossible to reach from
 * outside a developer's own machine — dev-only auth bypasses,
 * impersonation, and similar — where "preview" must be treated the same
 * as "production", not the same as "local dev".
 */
export function isPubliclyDeployed(): boolean {
  return isProdLike() || process.env.VERCEL_ENV === "preview";
}

/**
 * True only on the real production GoodHours deployment (goodhours.app or a
 * subdomain of it). Gates the outbound business-owner school-ownership
 * approval email: every other environment logs a bypass instead of mailing a
 * real person.
 *
 * Canonical here for the same reason as isProdLike(): three call sites
 * (auth signup, auth ownership-approval resend, google register-school) each
 * inlined their own `/(^|\.)goodhours\.app$/i` literal, and the resend copy
 * drifted to `/(^|\\.)goodhours\\.app$/i` — doubled backslashes, which
 * requires a literal backslash in the hostname and so never matched. That made
 * the production resend endpoint silently answer HTTP 200 `delivery: "bypass"`
 * while sending nothing, after it had already burned the 15-minute cooldown
 * and rotated the approval token. Import this instead of rewriting the regex.
 */
export function isProductionOwnerApprovalTarget(clientUrl: string): boolean {
  // Vercel sets NODE_ENV=production on preview deployments too, so isProdLike()
  // alone is true there. A preview must never mail the real business owner —
  // environment variables are shared across environments unless explicitly
  // scoped, so CLIENT_URL is not a reliable second gate on its own.
  if (process.env.VERCEL_ENV === "preview") return false;
  if (!isProdLike()) return false;
  try {
    return /(^|\.)goodhours\.app$/i.test(new URL(clientUrl).hostname);
  } catch {
    return false;
  }
}
