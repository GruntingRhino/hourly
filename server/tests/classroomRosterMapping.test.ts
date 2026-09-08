import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveClassroomUserDisplayName,
  resolveClassroomUserEmail,
  type GoogleClassroomApiUser,
} from "../src/services/googleClassroomIntegration.js";

/**
 * Regression: the live Classroom API returns roster entries shaped as
 * { userId, profile: { id, name: { givenName, familyName, fullName },
 * emailAddress } } — there is NO top-level `profileEmail`. The old mapper
 * read only `profileEmail`, so every real teacher/student resolved to an
 * empty email and was silently dropped from the sync dataset (Preview showed
 * zero students with zero errors).
 */
const REAL_API_STUDENT = {
  courseId: "878137660743",
  userId: "100691289086751282132",
  profile: {
    id: "100691289086751282132",
    name: {
      givenName: "Abhay",
      familyName: "Sivaram",
      fullName: "Abhay Sivaram",
    },
    emailAddress: "abhaysivaram31@gmail.com",
    photoUrl: "//lh3.googleusercontent.com/a/ACg8ocK-XU3H2rnLjGxLK4lytZFk4UA6Hgeb1ZyjduKIHh4h1DWd_Q=mo",
  },
} satisfies GoogleClassroomApiUser & { courseId: string };

test("real API roster shape resolves email (was silently dropped)", () => {
  assert.equal(resolveClassroomUserEmail(REAL_API_STUDENT), "abhaysivaram31@gmail.com");
});

test("real API roster shape resolves full name (was [object Object])", () => {
  assert.equal(resolveClassroomUserDisplayName(REAL_API_STUDENT, "fallback"), "Abhay Sivaram");
});

test("given+family names combine when fullName is absent", () => {
  const user: GoogleClassroomApiUser = {
    userId: "u2",
    profile: { id: "u2", name: { givenName: "Jane", familyName: "Doe" }, emailAddress: "Jane.Doe@Example.com" },
  };
  assert.equal(resolveClassroomUserDisplayName(user, "fallback"), "Jane Doe");
  assert.equal(resolveClassroomUserEmail(user), "jane.doe@example.com");
});

test("legacy flat name shape still resolves", () => {
  const user: GoogleClassroomApiUser = {
    userId: "u3",
    profile: { id: "u3", name: "Flat Name" } as GoogleClassroomApiUser["profile"],
    profileEmail: "flat@example.com",
  };
  assert.equal(resolveClassroomUserDisplayName(user, "fallback"), "Flat Name");
  assert.equal(resolveClassroomUserEmail(user), "flat@example.com");
});

test("entries without any email still resolve empty (dropped downstream)", () => {
  const user: GoogleClassroomApiUser = { userId: "u4", profile: { id: "u4" } };
  assert.equal(resolveClassroomUserEmail(user), "");
});
