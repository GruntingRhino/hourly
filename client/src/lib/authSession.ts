// §15 cookie migration: the JWT itself now lives only in an HttpOnly
// session cookie set by the server (never readable by client JS — that's
// the whole point, it closes the XSS-token-theft surface a
// localStorage/sessionStorage-held token has). This module now only
// caches the non-sensitive `user` profile object, purely to avoid a
// loading-spinner flash on repeat visits: AuthProvider optimistically
// renders the cached user while it confirms the real session with the
// server via GET /auth/me (the cookie is sent automatically).
//
// Cross-tab sync used to be necessary here because each tab held its own
// copy of the token in JS-readable storage. Cookies are shared natively by
// the browser across every tab for the same origin, so that entire
// mechanism (requestAuthSession/registerAuthSessionResponder) is gone —
// there's nothing left to sync.

const LEGACY_TOKEN_KEY = "goodhours_token";
const USER_KEY = "goodhours_user";
const PREF_KEY = "goodhours_session_pref";

export type SessionPref = "persistent" | "session";

export function getSessionPref(): SessionPref | null {
  return localStorage.getItem(PREF_KEY) as SessionPref | null;
}

/**
 * Tell the server whether this session's cookie should persist across
 * browser restarts ("remember me") or be cleared when the browser closes.
 * Requires an already-authenticated session (the cookie itself), so this
 * re-issues the cookie rather than requiring a fresh login.
 */
export async function setSessionPref(pref: SessionPref): Promise<void> {
  localStorage.setItem(PREF_KEY, pref);
  try {
    await fetch("/api/auth/session-pref", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persistent: pref === "persistent" }),
    });
  } catch {
    // Best-effort — the local preference is still recorded, and the
    // existing cookie (set persistent by default at login) keeps working
    // either way; this only affects whether it outlives the browser
    // session.
  }
}

export function getCachedUser<T>(): T | null {
  const raw = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setCachedUser(user: unknown | null): void {
  if (user === null) {
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
    return;
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(USER_KEY);
  // Clean up a token that may still be sitting in storage from before this
  // migration shipped — inert now (nothing reads it), but no reason to
  // leave a stale credential-shaped value lying around.
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  sessionStorage.removeItem(LEGACY_TOKEN_KEY);
}
