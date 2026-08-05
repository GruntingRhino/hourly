import test from "node:test";
import assert from "node:assert/strict";
import { encryptField } from "../src/lib/fieldEncryption";

// Regression test: lib/fieldEncryption.ts independently redefined
// isProdLike() as `NODE_ENV === "production" || VERCEL_ENV === "production"`,
// missing the APP_ENV check — the same drift already found and fixed in
// routes/schools.ts and routes/internal.ts. Here the consequence is worse
// than either of those: getKey() uses isProdLike() to decide whether a
// missing/malformed FIELD_ENCRYPTION_KEY should throw (refuse to run) or
// silently fall through to storing sensitive PII (phone numbers, per
// routes/auth.ts) in PLAINTEXT with only a console warning. A deployment
// configured via APP_ENV alone (no NODE_ENV/VERCEL_ENV) would have hit the
// plaintext-storage fallback instead of failing loudly.

test("encryptField throws instead of silently storing plaintext when APP_ENV=production and no key is configured", () => {
  const original = {
    APP_ENV: process.env.APP_ENV,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    FIELD_ENCRYPTION_KEY: process.env.FIELD_ENCRYPTION_KEY,
  };
  delete process.env.NODE_ENV;
  delete process.env.VERCEL_ENV;
  delete process.env.FIELD_ENCRYPTION_KEY;
  process.env.APP_ENV = "production";
  try {
    assert.throws(() => encryptField("555-0100"), /FIELD_ENCRYPTION_KEY is required in production/);
  } finally {
    if (original.APP_ENV === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = original.APP_ENV;
    if (original.NODE_ENV === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original.NODE_ENV;
    if (original.VERCEL_ENV === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = original.VERCEL_ENV;
    if (original.FIELD_ENCRYPTION_KEY === undefined) delete process.env.FIELD_ENCRYPTION_KEY; else process.env.FIELD_ENCRYPTION_KEY = original.FIELD_ENCRYPTION_KEY;
  }
});

test("encryptField passes through as plaintext (with a warning, not a throw) outside production-like environments", () => {
  const original = {
    APP_ENV: process.env.APP_ENV,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    FIELD_ENCRYPTION_KEY: process.env.FIELD_ENCRYPTION_KEY,
  };
  delete process.env.APP_ENV;
  delete process.env.NODE_ENV;
  delete process.env.VERCEL_ENV;
  delete process.env.FIELD_ENCRYPTION_KEY;
  try {
    assert.equal(encryptField("555-0100"), "555-0100");
  } finally {
    if (original.APP_ENV === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = original.APP_ENV;
    if (original.NODE_ENV === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original.NODE_ENV;
    if (original.VERCEL_ENV === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = original.VERCEL_ENV;
    if (original.FIELD_ENCRYPTION_KEY === undefined) delete process.env.FIELD_ENCRYPTION_KEY; else process.env.FIELD_ENCRYPTION_KEY = original.FIELD_ENCRYPTION_KEY;
  }
});
