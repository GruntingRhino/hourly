import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { api, ApiError } from "../lib/api";
import { clearAuthSession, getCachedUser, setCachedUser } from "../lib/authSession";
import { AuthContext } from "./authContext";
import type { User, SignupData, SignupResult } from "./authTypes";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getCachedUser<User>());
  // The session cookie is HttpOnly — this app has no way to check for its
  // presence without asking the server, so a real GET /auth/me call always
  // runs on mount. If a cached user exists we still render it immediately
  // (optimistic — matches the previous token-based UX, avoiding a loading
  // flash on repeat visits) while that confirmation happens in the
  // background; otherwise we show the loading state until it resolves.
  const [loading, setLoading] = useState(() => !getCachedUser<User>());

  // Deliberately never rejects — a dozen call sites `await refreshUser()` in
  // the middle of other work and would otherwise need their own guards. It
  // returns the refreshed user (or null) so a caller that needs to know
  // whether the refresh actually succeeded can check, instead of assuming it.
  const refreshUser = useCallback(async (): Promise<User | null> => {
    try {
      const data = await api.get<User>("/auth/me");
      setUser(data);
      setCachedUser(data);
      return data;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) { clearAuthSession(); setUser(null); }
      return null;
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refreshUser();
      setLoading(false);
    })();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
    setCachedUser(data.user);
    setUser(data.user);
  }, []);
  const loginWithToken = useCallback((_token: string, u: User) => { setCachedUser(u); setUser(u); }, []);
  const signup = useCallback(async (signupData: SignupData): Promise<SignupResult> => api.post<SignupResult>("/auth/signup", signupData), []);
  const logout = useCallback(() => {
    void api.post("/auth/logout").catch(() => {
      // Best-effort — even if this fails, clearing the cached user below
      // logs the client out visually; the cookie (if it survives) will
      // simply fail the next authenticate() call once it's genuinely
      // invalid, or the user can log out again.
    });
    clearAuthSession();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, loginWithToken, signup, logout, refreshUser }}>{children}</AuthContext.Provider>;
}
