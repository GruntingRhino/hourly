const TOKEN_KEY = "goodhours_token";
const USER_KEY = "goodhours_user";
const SYNC_REQUEST_KEY = "goodhours_auth_sync_request";
const SYNC_RESPONSE_PREFIX = "goodhours_auth_sync_response:";
const TAB_ID_KEY = "goodhours_tab_id";

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
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getCachedUser<T>(): T | null {
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setAuthSession(token: string, user?: CachedUser): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  if (user === undefined) return;
  if (user === null) {
    sessionStorage.removeItem(USER_KEY);
    return;
  }
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export async function requestAuthSession<T>(timeoutMs = 350): Promise<{ token: string; user: T | null } | null> {
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
