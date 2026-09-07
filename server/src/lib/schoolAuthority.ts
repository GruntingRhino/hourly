export type SessionEligibilityInput = {
  email: string;
  emailVerified: boolean;
  role: string;
  status: string;
  school?: {
    verified: boolean;
    ownershipStatus?: string | null;
  } | null;
  isInternalAdmin?: boolean;
  eligibilityAttestation?: { eligible13Plus: boolean } | null;
};

/**
 * Why a session is restricted to setup routes. Age eligibility is a STUDENT-only
 * requirement, so the reason must come from this evaluator rather than being
 * re-derived from the attestation at each call site: school staff no longer
 * carry an attestation at all, and inferring "no attestation ⇒ age gate" would
 * report a pending school admin as age-blocked.
 */
export type SessionSetupReason = "AGE_ELIGIBILITY" | "SCHOOL_OWNERSHIP";

export type SessionEligibility =
  | { allowed: true; setupOnly?: boolean; setupReason?: SessionSetupReason }
  | {
      allowed: false;
      status: 401 | 403;
      error: string;
      code: string;
    };

const SCHOOL_PRIVILEGED_ROLES = new Set(["SCHOOL_ADMIN", "TEACHER"]);
export const ELIGIBILITY_POLICY_VERSION = "13-plus-v1";

/**
 * Central session-issuance and request-authentication policy.
 *
 * A verified mailbox is required for every account. Pending school admins may
 * receive a restricted setup-only session; privileged school access still
 * requires an approved school ownership record. Internal operators may review
 * pending schools, but are still required to control a verified mailbox and an
 * active account.
 */
export function evaluateSessionEligibility(
  user: SessionEligibilityInput,
): SessionEligibility {
  if (user.status !== "ACTIVE") {
    return {
      allowed: false,
      status: 403,
      error: `Account is ${user.status.toLowerCase()}`,
      code: "ACCOUNT_NOT_ACTIVE",
    };
  }

  if (!user.emailVerified) {
    return {
      allowed: false,
      status: 403,
      error: "Email verification required",
      code: "EMAIL_VERIFICATION_REQUIRED",
    };
  }

  if (
    SCHOOL_PRIVILEGED_ROLES.has(user.role) &&
    !user.isInternalAdmin &&
    user.role === "SCHOOL_ADMIN" &&
    user.school?.ownershipStatus === "REJECTED"
  ) {
    return { allowed: false, status: 403, error: "School ownership request was rejected", code: "SCHOOL_OWNERSHIP_REJECTED" };
  }

  if (user.role === "STUDENT" && !user.eligibilityAttestation?.eligible13Plus) {
    return { allowed: true, setupOnly: true, setupReason: "AGE_ELIGIBILITY" };
  }

  if (
    SCHOOL_PRIVILEGED_ROLES.has(user.role) &&
    !user.isInternalAdmin &&
    user.role === "SCHOOL_ADMIN" &&
    user.school?.ownershipStatus === "PENDING"
  ) {
    return {
      allowed: true,
      setupOnly: true,
      setupReason: "SCHOOL_OWNERSHIP",
    };
  }

  if (
    SCHOOL_PRIVILEGED_ROLES.has(user.role) &&
    !user.isInternalAdmin &&
    (!user.school?.verified || user.school.ownershipStatus !== "APPROVED")
  ) {
    return {
      allowed: false,
      status: 403,
      error: "School ownership review is pending",
      code: "SCHOOL_OWNERSHIP_PENDING",
    };
  }

  return { allowed: true };
}

function normalizedDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
}

/** Affiliation check only. This never substitutes for ownership approval. */
export function assertExactSchoolDomain(email: string, expectedDomain: string): void {
  const actual = normalizedDomain(email.split("@")[1] ?? "");
  const expected = normalizedDomain(expectedDomain);
  if (!actual || !expected || actual !== expected) {
    throw Object.assign(new Error("School identity could not be verified"), {
      status: 403,
      code: "SCHOOL_DOMAIN_MISMATCH",
    });
  }
}
