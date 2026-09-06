import type { ReactNode } from "react";

export type Role = "STUDENT" | "ORG_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "BENEFICIARY_ADMIN";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isInternalAdmin?: boolean;
  requiresEligibilityAttestation?: boolean;
  emailVerified?: boolean;
  grade?: string;
  house?: string;
  schoolId?: string;
  school?: { id: string; name: string; domain?: string | null; verified: boolean; ownershipStatus?: "PENDING" | "APPROVED" | "REJECTED"; requiredHours?: number; zipCodes?: string | null; onboardingComplete?: boolean; serviceStartDate?: string | null; serviceEndDate?: string | null; allowSelfSubmission?: boolean };
  cohortId?: string;
  cohort?: { id: string; name: string; requiredHours?: number; serviceStartDate?: string | null; serviceEndDate?: string | null; allowSelfSubmission?: boolean | null; school?: { serviceEndDate?: string | null } };
  cohorts?: Array<{ id: string; name: string; source?: string; serviceEndDate?: string | null }>;
  beneficiaryId?: string;
  beneficiary?: { id: string; name: string };
  organizationId?: string;
  organization?: { id: string; name: string; description?: string; zipCodes?: string | null };
  classroomId?: string;
  classroom?: { id: string; name: string; inviteCode?: string; school: { id: string; name: string } };
  phone?: string;
  bio?: string;
  avatarUrl?: string | null;
  socialLinks?: { instagram?: string; tiktok?: string; twitter?: string; youtube?: string } | null;
  notificationPreferences?: Record<string, { email?: boolean; inApp?: boolean }> | null;
  messagePreferences?: { allowFrom?: string; profileVisibility?: string } | null;
}

export interface SignupData { email: string; password: string; name: string; role: string; schoolName?: string; schoolDomain?: string; directorySchoolId?: string; eligible13Plus: true }
export interface SignupResult { email: string; requiresEmailVerification: true; requiresSchoolOwnershipReview: true; ownershipApprovalDelivery?: "sent" | "bypass" | "failed" }
export interface AuthContextType { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<void>; loginWithToken: (token: string, user: User) => void; signup: (data: SignupData) => Promise<SignupResult>; logout: () => void; refreshUser: () => Promise<void> }
export type AuthChildren = { children: ReactNode };
