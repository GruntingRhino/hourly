const TOKEN_KEY = "goodhours_token";
const USER_KEY = "goodhours_user";
const SYNC_REQUEST_KEY = "goodhours_auth_sync_request";
const SYNC_RESPONSE_PREFIX = "goodhours_auth_sync_response:";
const TAB_ID_KEY = "goodhours_tab_id";
const PREF_KEY = "goodhours_session_pref";
const LOGOUT_OPT_OUT_KEY = "goodhours_auth_logout_opt_out";

export type SessionPref = "persistent" | "session";

export function getSessionPref(): SessionPref | null {
  return localStorage.getItem(PREF_KEY) as SessionPref | null;
}

export function setSessionPref(pref: SessionPref): void {
  localStorage.setItem(PREF_KEY, pref);
  // Migrate token to the appropriate storage backend
  const token = localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  const user = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  if (pref === "session") {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    if (user) sessionStorage.setItem(USER_KEY, user);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } else {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, user);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }
}

function getStorage(): Storage {
  return getSessionPref() === "session" ? sessionStorage : localStorage;
}

function isSyncOptedOut(): boolean {
  return sessionStorage.getItem(LOGOUT_OPT_OUT_KEY) === "1";
}

export function markAuthSyncOptOut(): void {
  sessionStorage.setItem(LOGOUT_OPT_OUT_KEY, "1");
}

export function clearAuthSyncOptOut(): void {
  sessionStorage.removeItem(LOGOUT_OPT_OUT_KEY);
}

type CachedUser = unknown;

function getTabId(): string {
  let tabId = sessionStorage.getItem(TAB_ID_KEY);
  if (!tabId) {
    tabId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(TAB_ID_KEY, tabId);
  }
  return tabId;
}

export function getAuthToken(): string | null {
  return getStorage().getItem(TOKEN_KEY);
}

export function getCachedUser<T>(): T | null {
  const raw = getStorage().getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setAuthSession(token: string, user?: CachedUser): void {
  clearAuthSyncOptOut();
  getStorage().setItem(TOKEN_KEY, token);
  if (user === undefined) return;
  if (user === null) {
    getStorage().removeItem(USER_KEY);
    return;
  }
  getStorage().setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export async function requestAuthSession<T>(timeoutMs = 350): Promise<{ token: string; user: T | null } | null> {
  if (isSyncOptedOut()) {
    return null;
  }
  const requestId = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const responseKey = `${SYNC_RESPONSE_PREFIX}${requestId}`;

  return new Promise((resolve) => {
    let settled = false;

    const cleanup = () => {
      window.removeEventListener("storage", handleStorage);
      clearTimeout(timeoutId);
      localStorage.removeItem(responseKey);
    };

    const finish = (value: { token: string; user: T | null } | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== responseKey || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue) as { token?: string; user?: T | null };
        if (!payload.token) {
          finish(null);
          return;
        }
        finish({ token: payload.token, user: payload.user ?? null });
      } catch {
        finish(null);
      }
    };

    const timeoutId = window.setTimeout(() => finish(null), timeoutMs);
    window.addEventListener("storage", handleStorage);

    localStorage.setItem(
      SYNC_REQUEST_KEY,
      JSON.stringify({
        requestId,
        requesterTabId: getTabId(),
        ts: Date.now(),
      }),
    );
  });
}

export function registerAuthSessionResponder<T>(getSession: () => { token: string | null; user: T | null }) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== SYNC_REQUEST_KEY || !event.newValue) return;

    try {
      const payload = JSON.parse(event.newValue) as { requestId?: string; requesterTabId?: string };
      if (!payload.requestId || payload.requesterTabId === getTabId()) return;

      const session = getSession();
      if (!session.token) return;

      if (document.visibilityState !== "visible") return;

      localStorage.setItem(
        `${SYNC_RESPONSE_PREFIX}${payload.requestId}`,
        JSON.stringify({
          token: session.token,
          user: session.user,
          responderTabId: getTabId(),
          ts: Date.now(),
        }),
      );
    } catch {
      // ignore malformed sync payloads
    }
  };

  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}
