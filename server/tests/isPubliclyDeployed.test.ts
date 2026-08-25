import test from "node:test";
import assert from "node:assert/strict";
import { isProdLike, isPubliclyDeployed } from "../src/lib/isProdLike";
import { isInternalAdminUser } from "../src/lib/internalAdmin";

function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
  const keys = ["APP_ENV", "NODE_ENV", "VERCEL_ENV"] as const;
  const original = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const key of keys) {
    if (overrides[key] === undefined) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  try {
    fn();
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
}

test("isPubliclyDeployed is true in production, same as isProdLike", () => {
  withEnv({ NODE_ENV: "production" }, () => {
    assert.equal(isProdLike(), true);
    assert.equal(isPubliclyDeployed(), true);
  });
});

test("isPubliclyDeployed is true on a Vercel preview deployment, unlike isProdLike", () => {
  withEnv({ VERCEL_ENV: "preview" }, () => {
    // This is the exact gap that let dev-only impersonation, the internal-admin
    // fallback, the test-email inbox reader, and LMS SSRF test-origin bypasses
    // all stay reachable on a publicly-URLed preview deployment: isProdLike()
    // only excludes "production", not "preview".
    assert.equal(isProdLike(), false, "isProdLike is only false here to document the gap this test guards against");
    assert.equal(isPubliclyDeployed(), true, "preview deployments must be treated as publicly reachable");
  });
});

test("isPubliclyDeployed is false for genuinely local dev (no VERCEL_ENV at all)", () => {
  withEnv({}, () => {
    assert.equal(isPubliclyDeployed(), false);
  });
});

test("isPubliclyDeployed is false when VERCEL_ENV=development (vercel dev locally)", () => {
  withEnv({ VERCEL_ENV: "development" }, () => {
    assert.equal(isPubliclyDeployed(), false);
  });
});

test("isInternalAdminUser's local SCHOOL_ADMIN fallback does not activate on a preview deployment", () => {
  withEnv({ VERCEL_ENV: "preview" }, () => {
    assert.equal(isInternalAdminUser({ email: "someone@school.edu", role: "SCHOOL_ADMIN" }), false);
  });
});

test("isInternalAdminUser's local SCHOOL_ADMIN fallback still works for genuinely local dev", () => {
  withEnv({}, () => {
    assert.equal(isInternalAdminUser({ email: "someone@school.edu", role: "SCHOOL_ADMIN" }), true);
  });
});
