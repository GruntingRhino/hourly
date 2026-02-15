import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "../lib/api";

type Role = "STUDENT" | "ORG_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "DISTRICT_ADMIN";

interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
  age?: number;
  grade?: string;
  organizationId?: string;
  organization?: { id: string; name: string; description?: string };
  schoolId?: string;
  school?: { id: string; name: string; domain?: string | null; verified: boolean };
  classroomId?: string;
  classroom?: { id: string; name: string; school: { id: string; name: string } };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

interface SignupData {
  email: string;
  password: string;
  name: string;
  role: string;
  age?: number;
  organizationName?: string;
  schoolName?: string;
  schoolDomain?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const data = await api.get<User>("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("hourly_token");
      setUser(null);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("hourly_token");
    if (token) {
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
    localStorage.setItem("hourly_token", data.token);
    setUser(data.user);
  };

  const signup = async (signupData: SignupData) => {
    const data = await api.post<{ token: string; user: User }>("/auth/signup", signupData);
    localStorage.setItem("hourly_token", data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("hourly_token");
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
