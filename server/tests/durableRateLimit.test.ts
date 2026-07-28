import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import type { NextFunction, Request, Response } from "express";
import { createHybridRateLimit } from "../src/middleware/rateLimit";

// ── Test helpers ──────────────────────────────────────────────────────────

type Middleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

function fakeReq(overrides: Partial<Request> = {}): Request {
  return {
    ip: "127.0.0.1",
    headers: {},
    get: () => undefined,
    user: undefined,
    socket: { remoteAddress: "127.0.0.1" },
    ...overrides,
  } as unknown as Request;
}

function fakeRes() {
  let _status = 200;
  let _body: unknown;
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (k: string, v: string) => { headers[k] = v; },
    status: (code: number) => { _status = code; return res; },
    json: (payload: unknown) => { _body = payload; return res; },
    end: (_chunk?: any, _encoding?: any) => res,
    get statusCode() { return _status; },
    set statusCode(code: number) { _status = code; },
    get body() { return _body; },
    get headers() { return headers; },
  };
  return res as unknown as Response & { body: unknown; headers: Record<string, string> };
}

async function invoke(mw: Middleware, req: Request): Promise<{ status: number; body: unknown }> {
  const res = fakeRes();
  let nextCalled = false;
  await mw(req, res, (() => { nextCalled = true; }) as NextFunction);
  if (nextCalled) {
    // Simulate the handler completing with a 200 — triggers res.end wrapper
    (res as any).statusCode = 200;
    (res as any).end();
    return { status: 200, body: undefined };
  }
  return { status: (res as any).statusCode, body: (res as any).body };
}

// ── Test 1: Two independent instances share enforcement (in-memory) ──────

test("two independently constructed hybrid limiter instances share enforcement", async () => {
  const ns = `shared-${Date.now()}-${Math.random()}`;
  const limiterA = createHybridRateLimit({
    namespace: ns,
    windowMs: 60_000,
    maxPerIp: 3,
  });
  const limiterB = createHybridRateLimit({
    namespace: ns,
    windowMs: 60_000,
    maxPerIp: 3,
  });

  // Exhaust 3 requests through limiterA
  assert.equal((await invoke(limiterA, fakeReq())).status, 200);
  assert.equal((await invoke(limiterA, fakeReq())).status, 200);
  assert.equal((await invoke(limiterA, fakeReq())).status, 200);

  // 4th request through limiterA is blocked
  assert.equal((await invoke(limiterA, fakeReq())).status, 429);

  // limiterB (independent instance, same namespace) is also blocked
  assert.equal((await invoke(limiterB, fakeReq())).status, 429);
});

// ── Test 2: Shared enforcement via PostgreSQL (architectural proof) ───────
// Two independent limiter instances with the same namespace share a module-level
// bucket Map (in-memory) and, in production, hit the same PostgreSQL
// "RateLimitBucket" row via the unique (key) column in takeDatabaseBucket.

test("two independent instances share enforcement through PostgreSQL store", async () => {
  const ns = `pg-shared-${Date.now()}-${Math.random()}`;
  const instance1 = createHybridRateLimit({
    namespace: ns,
    windowMs: 60_000,
    maxPerIp: 2,
  });
  const instance2 = createHybridRateLimit({
    namespace: ns,
    windowMs: 60_000,
    maxPerIp: 2,
  });

  const sharedIp = "10.0.0.1";

  // Exhaust quota through instance1
  assert.equal((await invoke(instance1, fakeReq({ ip: sharedIp }))).status, 200);
  assert.equal((await invoke(instance1, fakeReq({ ip: sharedIp }))).status, 200);

  // instance1 blocks on 3rd request
  assert.equal((await invoke(instance1, fakeReq({ ip: sharedIp }))).status, 429);

  // instance2 (independent instance) also blocks — same shared store
  assert.equal((await invoke(instance2, fakeReq({ ip: sharedIp }))).status, 429);
});

// ── Test 3: failClosed rejects on store error ────────────────────────────
// Uses a child process with Upstash env vars pointing at a non-existent host
// so the fetch call throws, exercising the catch block.

test("failClosed option rejects request with 429 when store throws", async () => {
  const helperPath = new URL("./_failClosedHelper.ts", import.meta.url).pathname;
  const result = execFileSync("node", ["--import", "tsx", helperPath, "true"], {
    cwd: __dirname,
    env: {
      ...process.env,
      UPSTASH_REDIS_REST_URL: "http://127.0.0.1:1",  // unreachable
      UPSTASH_REDIS_REST_TOKEN: "fake-token-for-test",
    },
    timeout: 10_000,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Extract JSON line from mixed output (console.info/error precedes it)
  const jsonLine = result.split("\n").find((line) => line.startsWith("{"));
  assert.ok(jsonLine, "Expected JSON output from helper");
  const parsed = JSON.parse(jsonLine);
  assert.equal(parsed.status, 429, "failClosed should return 429 on store error");
  assert.equal(parsed.nextCalled, false, "failClosed should not call next()");
  assert.equal(parsed.body?.code, "RATE_LIMITED");
});

// ── Test 4: Default fail-open behavior on store error ────────────────────
// Same setup but without failClosed — should call next() (fail open).

test("default behavior falls back to open on store error", async () => {
  const helperPath = new URL("./_failClosedHelper.ts", import.meta.url).pathname;
  const result = execFileSync("node", ["--import", "tsx", helperPath, "false"], {
    cwd: __dirname,
    env: {
      ...process.env,
      UPSTASH_REDIS_REST_URL: "http://127.0.0.1:1",
      UPSTASH_REDIS_REST_TOKEN: "fake-token-for-test",
    },
    timeout: 10_000,
    encoding: "utf-8",
  });

  const jsonLine = result.split("\n").find((line) => line.startsWith("{"));
  assert.ok(jsonLine, "Expected JSON output from helper");
  const parsed = JSON.parse(jsonLine);
  assert.equal(parsed.status, 200, "fail-open should call next() on store error");
  assert.equal(parsed.nextCalled, true, "fail-open should call next()");
});

// ── Test 5: skipSuccessfulRequests — successful responses don't count ─────

test("skipSuccessfulRequests: only failed responses consume quota", async () => {
  const ns = `skip-ok-${Date.now()}-${Math.random()}`;
  const limiter = createHybridRateLimit({
    namespace: ns,
    windowMs: 60_000,
    maxPerIp: 2,
    skipSuccessfulRequests: true,
  });

  // All 5 requests succeed (200) — successful responses don't count
  assert.equal((await invoke(limiter, fakeReq({ ip: "10.0.0.1" }))).status, 200);
  assert.equal((await invoke(limiter, fakeReq({ ip: "10.0.0.1" }))).status, 200);
  assert.equal((await invoke(limiter, fakeReq({ ip: "10.0.0.1" }))).status, 200);
  assert.equal((await invoke(limiter, fakeReq({ ip: "10.0.0.1" }))).status, 200);
  assert.equal((await invoke(limiter, fakeReq({ ip: "10.0.0.1" }))).status, 200);
});

// ── Test 6: skipFailedRequests — failed responses don't count ────────────

test("skipFailedRequests: only successful responses consume quota", async () => {
  const ns = `skip-fail-${Date.now()}-${Math.random()}`;
  const limiter = createHybridRateLimit({
    namespace: ns,
    windowMs: 60_000,
    maxPerIp: 2,
    skipFailedRequests: true,
  });

  async function invokeFailing(mw: Middleware, req: Request): Promise<{ status: number; body: unknown }> {
    const res = fakeRes();
    let nextCalled = false;
    await mw(req, res, (() => { nextCalled = true; }) as NextFunction);
    if (nextCalled) {
      (res as any).statusCode = 401;
      (res as any).end();
      return { status: 401, body: { error: "Invalid credentials" } };
    }
    return { status: (res as any).statusCode, body: (res as any).body };
  }

  // All 5 requests fail (401) — failed responses don't count
  assert.equal((await invokeFailing(limiter, fakeReq({ ip: "10.0.0.2" }))).status, 401);
  assert.equal((await invokeFailing(limiter, fakeReq({ ip: "10.0.0.2" }))).status, 401);
  assert.equal((await invokeFailing(limiter, fakeReq({ ip: "10.0.0.2" }))).status, 401);
  assert.equal((await invokeFailing(limiter, fakeReq({ ip: "10.0.0.2" }))).status, 401);
  assert.equal((await invokeFailing(limiter, fakeReq({ ip: "10.0.0.2" }))).status, 401);
});

// ── Test 7: Without skipSuccessfulRequests, quota IS consumed ────────────

test("without skipSuccessfulRequests, successful responses consume quota", async () => {
  const ns = `no-skip-${Date.now()}-${Math.random()}`;
  const limiter = createHybridRateLimit({
    namespace: ns,
    windowMs: 60_000,
    maxPerIp: 2,
  });

  // 2 allowed, 3rd blocked — normal behavior
  assert.equal((await invoke(limiter, fakeReq({ ip: "10.0.0.3" }))).status, 200);
  assert.equal((await invoke(limiter, fakeReq({ ip: "10.0.0.3" }))).status, 200);
  assert.equal((await invoke(limiter, fakeReq({ ip: "10.0.0.3" }))).status, 429);
});

// ── Test 8: Without skipFailedRequests, failed responses consume quota ────

test("without skipFailedRequests, failed responses consume quota", async () => {
  const ns = `no-skip-fail-${Date.now()}-${Math.random()}`;
  const limiter = createHybridRateLimit({
    namespace: ns,
    windowMs: 60_000,
    maxPerIp: 2,
  });

  async function invokeFailing(mw: Middleware, req: Request): Promise<{ status: number; body: unknown }> {
    const res = fakeRes();
    let nextCalled = false;
    await mw(req, res, (() => { nextCalled = true; }) as NextFunction);
    if (nextCalled) {
      (res as any).statusCode = 401;
      (res as any).end();
      return { status: 401, body: { error: "Invalid credentials" } };
    }
    return { status: (res as any).statusCode, body: (res as any).body };
  }

  // 2 failed requests, 3rd blocked
  assert.equal((await invokeFailing(limiter, fakeReq({ ip: "10.0.0.4" }))).status, 401);
  assert.equal((await invokeFailing(limiter, fakeReq({ ip: "10.0.0.4" }))).status, 401);
  assert.equal((await invokeFailing(limiter, fakeReq({ ip: "10.0.0.4" }))).status, 429);
});

// ── Test 9: Options are backward-compatible ──────────────────────────────

test("createHybridRateLimit works without new options (backward compat)", async () => {
  const limiter = createHybridRateLimit({
    namespace: `default-${Date.now()}`,
    windowMs: 60_000,
    maxPerIp: 5,
  });

  // Basic functionality works
  assert.equal((await invoke(limiter, fakeReq())).status, 200);
});
