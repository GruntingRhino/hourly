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

  assert.deepEqual(result, { allowed: true, setupOnly: true });
});

test("approved staff and verified non-staff users can receive sessions", () => {
  assert.equal(evaluateSessionEligibility({
    email: "admin@school.edu",
    emailVerified: true,
    role: "SCHOOL_ADMIN",
    status: "ACTIVE",
    school: { verified: true, ownershipStatus: "APPROVED" },
  }).allowed, true);

  assert.equal(evaluateSessionEligibility({
    email: "student@school.edu",
    emailVerified: true,
    role: "STUDENT",
    status: "ACTIVE",
    school: null,
  }).allowed, true);
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
