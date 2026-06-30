import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { api, ApiError } from "../lib/api";
import {
  clearAuthSession,
  markAuthSyncOptOut,
  getAuthToken,
  getCachedUser,
  registerAuthSessionResponder,
  requestAuthSession,
  setAuthSession,
} from "../lib/authSession";

type Role = "STUDENT" | "ORG_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "BENEFICIARY_ADMIN";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isInternalAdmin?: boolean;
  emailVerified?: boolean;
  grade?: string;
  house?: string;
  schoolId?: string;
  school?: {
    id: string;
    name: string;
    domain?: string | null;
    verified: boolean;
    requiredHours?: number;
    zipCodes?: string | null;
    onboardingComplete?: boolean;
    serviceStartDate?: string | null;
    serviceEndDate?: string | null;
    allowSelfSubmission?: boolean;
  };
  cohortId?: string;
  cohort?: {
    id: string;
    name: string;
    requiredHours?: number;
    serviceStartDate?: string | null;
    serviceEndDate?: string | null;
    allowSelfSubmission?: boolean | null;
  };
  cohorts?: Array<{
    id: string;
    name: string;
    source?: string;
    serviceEndDate?: string | null;
  }>;
  beneficiaryId?: string;
  beneficiary?: { id: string; name: string };
  // Legacy fields (kept for compatibility with existing settings/browse pages)
  organizationId?: string;
  organization?: { id: string; name: string; description?: string; zipCodes?: string | null };
  classroomId?: string;
  classroom?: { id: string; name: string; inviteCode?: string; school: { id: string; name: string } };
  phone?: string;
  bio?: string;
  avatarUrl?: string | null;
  socialLinks?: { instagram?: string; tiktok?: string; twitter?: string; youtube?: string } | null;
}

interface SignupResult {
  token: string;
  user: User;
  requiresEmailVerification?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithToken: (token: string, user: User) => void;
  signup: (data: SignupData) => Promise<SignupResult>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
  role: string;
  schoolName?: string;
  schoolDomain?: string;
  directorySchoolId?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getCachedUser<User>());
  const [loading, setLoading] = useState(() => {
    const token = getAuthToken();
    return Boolean(token && !getCachedUser<User>());
  });

  const refreshUser = async () => {
    try {
      const data = await api.get<User>("/auth/me");
      setUser(data);
      const token = getAuthToken();
      if (token) setAuthSession(token, data);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearAuthSession();
        setUser(null);
      }
    }
  };

  useEffect(() => {
    const unregister = registerAuthSessionResponder<User>(() => ({
      token: getAuthToken(),
      user: getCachedUser<User>(),
    }));

    void (async () => {
      let token = getAuthToken();

      if (!token) {
        const synced = await requestAuthSession<User>();
        if (synced?.token) {
          setAuthSession(synced.token, synced.user);
          token = synced.token;
          if (synced.user) setUser(synced.user);
        }
      }

      if (token) {
        await refreshUser();
      }

      setLoading(false);
    })();

    return unregister;
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
    setAuthSession(data.token, data.user);
    setUser(data.user);
  };

  const loginWithToken = (token: string, u: User) => {
    setAuthSession(token, u);
    setUser(u);
  };

  const signup = async (signupData: SignupData): Promise<SignupResult> => {
    const data = await api.post<SignupResult>("/auth/signup", signupData);
    setAuthSession(data.token, data.user);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    markAuthSyncOptOut();
    clearAuthSession();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithToken, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
