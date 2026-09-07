import assert from "node:assert/strict";
import test from "node:test";
import {
  assertExactSchoolDomain,
  evaluateSessionEligibility,
} from "../src/lib/schoolAuthority";

test("unverified users cannot receive an application session", () => {
  const result = evaluateSessionEligibility({
    email: "admin@school.edu",
    emailVerified: false,
    role: "SCHOOL_ADMIN",
    status: "ACTIVE",
    school: { verified: true, ownershipStatus: "APPROVED" },
  });

  assert.deepEqual(result, {
    allowed: false,
    status: 403,
    error: "Email verification required",
    code: "EMAIL_VERIFICATION_REQUIRED",
  });
});

test("pending school ownership receives a setup-only session", () => {
  const result = evaluateSessionEligibility({
    email: "admin@school.edu",
    emailVerified: true,
    role: "SCHOOL_ADMIN",
    status: "ACTIVE",
    school: { verified: false, ownershipStatus: "PENDING" },
  });

  assert.deepEqual(result, { allowed: true, setupOnly: true, setupReason: "SCHOOL_OWNERSHIP" });
});

test("school staff do not need a 13+ eligibility attestation", () => {
  assert.deepEqual(evaluateSessionEligibility({
    email: "admin@school.edu",
    emailVerified: true,
    role: "SCHOOL_ADMIN",
    status: "ACTIVE",
    school: { verified: true, ownershipStatus: "APPROVED" },
  }), { allowed: true });

  assert.deepEqual(evaluateSessionEligibility({
    email: "teacher@school.edu",
    emailVerified: true,
    role: "TEACHER",
    status: "ACTIVE",
    school: { verified: true, ownershipStatus: "APPROVED" },
  }), { allowed: true });

  assert.deepEqual(evaluateSessionEligibility({
    email: "partner@example.org",
    emailVerified: true,
    role: "BENEFICIARY_ADMIN",
    status: "ACTIVE",
    school: null,
  }), { allowed: true });
});

test("students without a 13+ eligibility attestation receive setup-only access", () => {
  assert.deepEqual(evaluateSessionEligibility({
    email: "student@school.edu",
    emailVerified: true,
    role: "STUDENT",
    status: "ACTIVE",
    school: null,
  }), { allowed: true, setupOnly: true, setupReason: "AGE_ELIGIBILITY" });
});

test("school-domain validation requires an exact normalized domain", () => {
  assert.doesNotThrow(() => assertExactSchoolDomain("Admin@School.EDU", "school.edu"));
  assert.throws(
    () => assertExactSchoolDomain("attacker@other.edu", "school.edu"),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 403);
      assert.equal((error as { code?: string }).code, "SCHOOL_DOMAIN_MISMATCH");
      return true;
    },
  );
  assert.throws(() => assertExactSchoolDomain("attacker@fake.school.edu", "school.edu"));
});
