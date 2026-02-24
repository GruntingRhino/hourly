import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { api, ApiError } from "../lib/api";

type Role = "STUDENT" | "ORG_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "DISTRICT_ADMIN";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
  age?: number;
  grade?: string;
  emailVerified?: boolean;
  socialLinks?: { instagram?: string; tiktok?: string; twitter?: string; youtube?: string } | null;
  organizationId?: string;
  organization?: { id: string; name: string; description?: string; zipCodes?: string | null };
  schoolId?: string;
  school?: { id: string; name: string; domain?: string | null; verified: boolean; requiredHours?: number; zipCodes?: string | null };
  classroomId?: string;
  classroom?: { id: string; name: string; inviteCode?: string; school: { id: string; name: string } };
  notificationPreferences?: Record<string, any> | null;
  messagePreferences?: Record<string, any> | null;
}

interface SignupResult {
  token: string;
  user: User;
  requiresEmailVerification?: boolean;
  verificationUrl?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<SignupResult>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
  role: string;
  age?: number;
  organizationName?: string;
  schoolName?: string;
  schoolDomain?: string;
  zipCodes?: string[];
}

const AuthContext = createContext<AuthContextType | null>(null);

const USER_CACHE_KEY = "goodhours_user";

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null): void {
  try {
    if (!user) {
      localStorage.removeItem(USER_CACHE_KEY);
      return;
    }
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    // ignore cache write failures
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readCachedUser());
  const [loading, setLoading] = useState(() => {
    const token = localStorage.getItem("goodhours_token");
    return Boolean(token && !readCachedUser());
  });

  const refreshUser = async () => {
    try {
      const data = await api.get<User>("/auth/me");
      setUser(data);
      writeCachedUser(data);
    } catch (err) {
      // Only clear auth state on true auth failures; transient abort/network
      // errors should not force-log the user out.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        localStorage.removeItem("goodhours_token");
        writeCachedUser(null);
        setUser(null);
      }
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("goodhours_token");
    if (token) {
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
    localStorage.setItem("goodhours_token", data.token);
    setUser(data.user);
    writeCachedUser(data.user);
  };

  const signup = async (signupData: SignupData): Promise<SignupResult> => {
    const data = await api.post<SignupResult>("/auth/signup", signupData);
    localStorage.setItem("goodhours_token", data.token);
    setUser(data.user);
    writeCachedUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("goodhours_token");
    writeCachedUser(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
