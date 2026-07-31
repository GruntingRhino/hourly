import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { api, ApiError } from "../lib/api";
import { clearAuthSession, markAuthSyncOptOut, getAuthToken, getCachedUser, registerAuthSessionResponder, requestAuthSession, setAuthSession } from "../lib/authSession";
import { AuthContext } from "./authContext";
import type { User, SignupData, SignupResult } from "./authTypes";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getCachedUser<User>());
  const [loading, setLoading] = useState(() => Boolean(getAuthToken() && !getCachedUser<User>()));

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.get<User>("/auth/me");
      setUser(data);
      const token = getAuthToken();
      if (token) setAuthSession(token, data);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) { clearAuthSession(); setUser(null); }
    }
  }, []);

  useEffect(() => {
    const unregister = registerAuthSessionResponder<User>(() => ({ token: getAuthToken(), user: getCachedUser<User>() }));
    void (async () => {
      let token = getAuthToken();
      if (!token) { const synced = await requestAuthSession<User>(); if (synced?.token) { setAuthSession(synced.token, synced.user); token = synced.token; if (synced.user) setUser(synced.user); } }
      if (token) await refreshUser();
      setLoading(false);
    })();
    return unregister;
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => { const data = await api.post<{ token: string; user: User }>("/auth/login", { email, password }); setAuthSession(data.token, data.user); setUser(data.user); }, []);
  const loginWithToken = useCallback((token: string, u: User) => { setAuthSession(token, u); setUser(u); }, []);
  const signup = useCallback(async (signupData: SignupData): Promise<SignupResult> => { const data = await api.post<SignupResult>("/auth/signup", signupData); setAuthSession(data.token, data.user); setUser(data.user); return data; }, []);
  const logout = useCallback(() => { markAuthSyncOptOut(); clearAuthSession(); setUser(null); }, []);

  return <AuthContext.Provider value={{ user, loading, login, loginWithToken, signup, logout, refreshUser }}>{children}</AuthContext.Provider>;
}
