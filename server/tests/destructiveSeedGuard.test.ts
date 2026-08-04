import test from "node:test";
import assert from "node:assert/strict";
import { assertSafeToRunDestructiveSeed } from "../src/lib/destructiveSeedGuard";

const SAFE_ENV = {
  APP_ENV: "development",
  NODE_ENV: "development",
  VERCEL_ENV: "",
  ALLOW_DESTRUCTIVE_TEST_SEED: "yes",
  DATABASE_URL: "postgresql://user@localhost:5432/goodhours_local_disposable_accounts",
};

test("allows a local, opted-in, non-production run", () => {
  assert.doesNotThrow(() => assertSafeToRunDestructiveSeed(SAFE_ENV as NodeJS.ProcessEnv));
});

// isProdLike() (used internally) reads the real process.env directly, not
// the env object passed to assertSafeToRunDestructiveSeed — so these two
// tests must actually mutate and restore process.env rather than injecting
// a fake env, matching the pattern in isProdLike.test.ts.
test("blocks a production-like environment even with the opt-in set", () => {
  const original = { NODE_ENV: process.env.NODE_ENV, APP_ENV: process.env.APP_ENV };
  process.env.NODE_ENV = "production";
  delete process.env.APP_ENV;
  try {
    assert.throws(() => assertSafeToRunDestructiveSeed(SAFE_ENV as NodeJS.ProcessEnv), /production-like environment/);
  } finally {
    if (original.NODE_ENV === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original.NODE_ENV;
    if (original.APP_ENV === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = original.APP_ENV;
  }
});

test("blocks a production-like environment via APP_ENV specifically", () => {
  const original = { NODE_ENV: process.env.NODE_ENV, APP_ENV: process.env.APP_ENV };
  delete process.env.NODE_ENV;
  process.env.APP_ENV = "production";
  try {
    assert.throws(() => assertSafeToRunDestructiveSeed(SAFE_ENV as NodeJS.ProcessEnv), /production-like environment/);
  } finally {
    if (original.NODE_ENV === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original.NODE_ENV;
    if (original.APP_ENV === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = original.APP_ENV;
  }
});

test("blocks when ALLOW_DESTRUCTIVE_TEST_SEED is missing", () => {
  const env = { ...SAFE_ENV, ALLOW_DESTRUCTIVE_TEST_SEED: undefined };
  assert.throws(() => assertSafeToRunDestructiveSeed(env as unknown as NodeJS.ProcessEnv), /ALLOW_DESTRUCTIVE_TEST_SEED=yes/);
});

test("blocks when ALLOW_DESTRUCTIVE_TEST_SEED is not exactly 'yes'", () => {
  assert.throws(
    () => assertSafeToRunDestructiveSeed({ ...SAFE_ENV, ALLOW_DESTRUCTIVE_TEST_SEED: "true" } as NodeJS.ProcessEnv),
    /ALLOW_DESTRUCTIVE_TEST_SEED=yes/,
  );
});

test("blocks a DATABASE_URL with no valid connection string", () => {
  assert.throws(
    () => assertSafeToRunDestructiveSeed({ ...SAFE_ENV, DATABASE_URL: "" } as NodeJS.ProcessEnv),
    /not a valid connection string/,
  );
});

test("blocks a production-sounding remote host and database name", () => {
  assert.throws(
    () => assertSafeToRunDestructiveSeed({
      ...SAFE_ENV,
      DATABASE_URL: "postgresql://user@prod-db.example.com:5432/goodhours_production",
    } as NodeJS.ProcessEnv),
    /don't look like a local or clearly-disposable/,
  );
});

test("allows a non-localhost host if the database name looks clearly disposable", () => {
  assert.doesNotThrow(() =>
    assertSafeToRunDestructiveSeed({
      ...SAFE_ENV,
      DATABASE_URL: "postgresql://user@some-managed-host.example.com:5432/goodhours_qa_latest",
    } as NodeJS.ProcessEnv)
  );
});

test("allows localhost even if the database name doesn't look disposable", () => {
  assert.doesNotThrow(() =>
    assertSafeToRunDestructiveSeed({
      ...SAFE_ENV,
      DATABASE_URL: "postgresql://user@localhost:5432/goodhours",
    } as NodeJS.ProcessEnv)
  );
});
