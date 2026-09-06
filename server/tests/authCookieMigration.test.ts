import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME, setAuthCookie, clearAuthCookie } from "../src/lib/authCookies";

// §15 HttpOnly cookie migration, phase 1 (dual-mode): the server now sets
// an HttpOnly session cookie alongside the existing JSON `token` field, and
// authenticate() accepts either. These tests cover the new cookie
// primitives directly (attribute correctness) and the new /logout and
// /session-pref endpoints end-to-end, without depending on the full
// login flow's DB/bcrypt dependencies.

process.env.JWT_SECRET = "auth-cookie-migration-test-secret";

function makeMockRes() {
  const calls: { cookie?: [string, string, Record<string, unknown>]; clearCookie?: [string, Record<string, unknown>] } = {};
  const res = {
    cookie(name: string, value: string, opts: Record<string, unknown>) {
      calls.cookie = [name, value, opts];
      return res;
    },
    clearCookie(name: string, opts: Record<string, unknown>) {
      calls.clearCookie = [name, opts];
      return res;
    },
  } as any;
  return { res, calls };
}

test("setAuthCookie sets an HttpOnly, SameSite=Lax cookie", () => {
  const { res, calls } = makeMockRes();
  setAuthCookie(res, "jwt-value", { persistent: true });
  assert.ok(calls.cookie);
  const [name, value, opts] = calls.cookie!;
  assert.equal(name, AUTH_COOKIE_NAME);
  assert.equal(value, "jwt-value");
  assert.equal(opts.httpOnly, true);
  assert.equal(opts.sameSite, "lax");
  assert.equal(opts.path, "/");
});

test("setAuthCookie sets a 7-day Max-Age when persistent, and none when session-only", () => {
  const { res: persistentRes, calls: persistentCalls } = makeMockRes();
  setAuthCookie(persistentRes, "jwt-value", { persistent: true });
  assert.equal(persistentCalls.cookie![2].maxAge, 7 * 24 * 60 * 60 * 1000);

  const { res: sessionRes, calls: sessionCalls } = makeMockRes();
  setAuthCookie(sessionRes, "jwt-value", { persistent: false });
  assert.equal(sessionCalls.cookie![2].maxAge, undefined);
});

test("clearAuthCookie clears the same cookie name with matching attributes", () => {
  const { res, calls } = makeMockRes();
  clearAuthCookie(res);
  assert.ok(calls.clearCookie);
  const [name, opts] = calls.clearCookie!;
  assert.equal(name, AUTH_COOKIE_NAME);
  assert.equal(opts.httpOnly, true);
  assert.equal(opts.path, "/");
});

const prisma = require("../src/lib/prisma").default as typeof import("../src/lib/prisma").default;
const prismaClient = prisma as any;
const authRoutes = require("../src/routes/auth").default as typeof import("../src/routes/auth").default;

async function startApp(): Promise<{ app: express.Express; baseUrl: string; close: () => Promise<void> }> {
  const app = express();
  app.use(express.json());
  const cookieParser = require("cookie-parser");
  app.use(cookieParser());
  app.use("/api/auth", authRoutes);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    app,
    baseUrl: `http://127.0.0.1:${(address as any).port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())),
  };
}

function parseSetCookie(headers: Headers, name: string): { value: string; attrs: string } | null {
  const raw = headers.get("set-cookie");
  if (!raw) return null;
  // Node's fetch folds multiple Set-Cookie headers into one comma-joined
  // string in older runtimes; in this test we only ever set one cookie per
  // response so a direct match is sufficient.
  const match = raw.match(new RegExp(`${name}=([^;]*)(.*)`));
  if (!match) return null;
  return { value: match[1], attrs: match[2] };
}

test("POST /api/auth/logout clears the session cookie", async () => {
  const { baseUrl, close } = await startApp();
  try {
    const response = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST" });
    assert.equal(response.status, 204);
    const cookie = parseSetCookie(response.headers, AUTH_COOKIE_NAME);
    assert.ok(cookie, "expected a Set-Cookie header clearing the session cookie");
    // express's res.clearCookie sets an already-expired cookie
    assert.match(cookie!.attrs, /Expires=/i);
  } finally {
    await close();
  }
});

test("POST /api/auth/session-pref re-issues the cookie with the requested persistence, authenticated via the cookie itself", async () => {
  const { baseUrl, close } = await startApp();
  const user = {
    id: "session-pref-user-1",
    email: "pref@example.test",
    role: "STUDENT",
    status: "ACTIVE",
    tokenVersion: 0,
    emailVerified: true,
    eligibilityAttestation: { eligible13Plus: true },
    school: null,
  };
  const original = prismaClient.user.findUnique;
  prismaClient.user.findUnique = async () => user;
  try {
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role, tv: 0 }, process.env.JWT_SECRET!);

    const response = await fetch(`${baseUrl}/api/auth/session-pref`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Deliberately no Authorization header — proves the cookie alone
        // authenticates this request.
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({ persistent: false }),
    });
    assert.equal(response.status, 204);
    const cookie = parseSetCookie(response.headers, AUTH_COOKIE_NAME);
    assert.ok(cookie);
    assert.doesNotMatch(cookie!.attrs, /Max-Age/i, "session-only request should not set a Max-Age");
  } finally {
    prismaClient.user.findUnique = original;
    await close();
  }
});

test("an Authorization Bearer header still authenticates when no cookie is present (backward compatibility)", async () => {
  const { baseUrl, close } = await startApp();
  const user = {
    id: "session-pref-user-2",
    email: "bearer-only@example.test",
    role: "STUDENT",
    status: "ACTIVE",
    tokenVersion: 0,
    emailVerified: true,
    eligibilityAttestation: { eligible13Plus: true },
    school: null,
  };
  const original = prismaClient.user.findUnique;
  prismaClient.user.findUnique = async () => user;
  try {
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role, tv: 0 }, process.env.JWT_SECRET!);
    const response = await fetch(`${baseUrl}/api/auth/session-pref`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ persistent: true }),
    });
    assert.equal(response.status, 204);
  } finally {
    prismaClient.user.findUnique = original;
    await close();
  }
});

test("the session cookie takes precedence over a mismatched Authorization header when both are present", async () => {
  const { baseUrl, close } = await startApp();
  const cookieUser = {
    id: "cookie-user",
    email: "cookie-user@example.test",
    role: "STUDENT",
    status: "ACTIVE",
    tokenVersion: 0,
    emailVerified: true,
    eligibilityAttestation: { eligible13Plus: true },
    school: null,
  };
  const original = prismaClient.user.findUnique;
  prismaClient.user.findUnique = async ({ where }: any) =>
    where.id === cookieUser.id ? cookieUser : null;
  try {
    const cookieToken = jwt.sign(
      { userId: cookieUser.id, email: cookieUser.email, role: cookieUser.role, tv: 0 },
      process.env.JWT_SECRET!,
    );
    // A syntactically valid but unrelated/expired-looking Bearer token for
    // a user that doesn't exist — if the header were consulted first this
    // would 401.
    const staleBearerToken = jwt.sign(
      { userId: "nonexistent-user", email: "gone@example.test", role: "STUDENT", tv: 0 },
      process.env.JWT_SECRET!,
    );

    const response = await fetch(`${baseUrl}/api/auth/session-pref`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${staleBearerToken}`,
        cookie: `${AUTH_COOKIE_NAME}=${cookieToken}`,
      },
      body: JSON.stringify({ persistent: true }),
    });
    assert.equal(response.status, 204, "expected the cookie's identity to win over the mismatched header");
  } finally {
    prismaClient.user.findUnique = original;
    await close();
  }
});

test("session-pref request with neither cookie nor Authorization header is rejected", async () => {
  const { baseUrl, close } = await startApp();
  try {
    const response = await fetch(`${baseUrl}/api/auth/session-pref`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ persistent: true }),
    });
    assert.equal(response.status, 401);
  } finally {
    await close();
  }
});
