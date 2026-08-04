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
};

export type SessionEligibility =
  | { allowed: true }
  | {
      allowed: false;
      status: 401 | 403;
      error: string;
      code: string;
    };

const SCHOOL_PRIVILEGED_ROLES = new Set(["SCHOOL_ADMIN", "TEACHER"]);

/**
 * Central session-issuance and request-authentication policy.
 *
 * A verified mailbox is required for every account. School staff additionally
 * need an independently approved school ownership record. Internal operators
 * are identified by the production allowlist and may review pending schools,
 * but are still required to control a verified mailbox and an active account.
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
