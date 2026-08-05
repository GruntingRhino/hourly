import type { Response } from "express";
import { isPubliclyDeployed } from "./isProdLike";

/**
 * HttpOnly session cookie — the primary auth channel (see §15 of the
 * remediation goal). The JSON `token` field on login/signup-adjacent
 * responses is kept alongside this for backward compatibility with
 * existing callers/tests during the migration; `middleware/auth.ts`
 * accepts either, preferring the cookie.
 */
export const AUTH_COOKIE_NAME = "gh_session";

// Matches signUserToken's default JWT expiresIn ("7d") — the cookie and the
// token it carries should expire together.
const PERSISTENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const BASE_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  // Preview deployments are also served over HTTPS, so marking the cookie
  // secure there is strictly safer, not just production — same reasoning
  // as the existing OAuth state cookie in routes/googleAuth.ts.
  secure: isPubliclyDeployed(),
  path: "/",
};

/**
 * Set the HttpOnly auth cookie. `persistent: true` gives it a 7-day
 * Max-Age (survives browser restarts, matching "remember me"); omitted or
 * false makes it a session cookie (cleared when the browser closes).
 */
export function setAuthCookie(res: Response, token: string, options: { persistent: boolean }): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...BASE_COOKIE_OPTS,
    ...(options.persistent ? { maxAge: PERSISTENT_MAX_AGE_MS } : {}),
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, BASE_COOKIE_OPTS);
}
