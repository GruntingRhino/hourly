import test from "node:test";
import assert from "node:assert/strict";
import { isProdLike } from "../src/lib/isProdLike";

test("isProdLike is true when only APP_ENV is set to production", () => {
  const original = { APP_ENV: process.env.APP_ENV, NODE_ENV: process.env.NODE_ENV, VERCEL_ENV: process.env.VERCEL_ENV };
  delete process.env.NODE_ENV;
  delete process.env.VERCEL_ENV;
  process.env.APP_ENV = "production";
  try {
    // This is the exact case that used to be missed by the copy of this
    // check in routes/schools.ts, which tested only NODE_ENV/VERCEL_ENV and
    // would have leaked a newly created teacher's temp password in the
    // create-staff API response under an APP_ENV-only production config.
    assert.equal(isProdLike(), true);
  } finally {
    if (original.APP_ENV === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = original.APP_ENV;
    if (original.NODE_ENV === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original.NODE_ENV;
    if (original.VERCEL_ENV === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = original.VERCEL_ENV;
  }
});

test("isProdLike is false when no production env vars are set", () => {
  const original = { APP_ENV: process.env.APP_ENV, NODE_ENV: process.env.NODE_ENV, VERCEL_ENV: process.env.VERCEL_ENV };
  delete process.env.APP_ENV;
  delete process.env.NODE_ENV;
  delete process.env.VERCEL_ENV;
  try {
    assert.equal(isProdLike(), false);
  } finally {
    if (original.APP_ENV === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = original.APP_ENV;
    if (original.NODE_ENV === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original.NODE_ENV;
    if (original.VERCEL_ENV === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = original.VERCEL_ENV;
  }
});
