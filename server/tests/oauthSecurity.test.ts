import assert from "node:assert/strict";
import test from "node:test";
import { assertOAuthAdministrator, claimOAuthState, createOAuthState, storeOAuthState } from "../src/lib/oauthState";
import { hashToken } from "../src/lib/tokenHash";
import { signUserToken } from "../src/middleware/auth";

test("OAuth state is opaque, browser-bound, expires, and is single-use", async () => {
  const rows = new Map<string, any>();
  const db = {
    canvasOAuthState: {
      create: async ({ data }: any) => { const row = { id: "state-1", consumedAt: null, ...data }; rows.set(data.stateHash, row); return row; },
      findUnique: async ({ where }: any) => rows.get(where.stateHash) ?? null,
      updateMany: async ({ where, data }: any) => {
        const row = [...rows.values()].find((candidate) => candidate.id === where.id && candidate.consumedAt === null && candidate.expiresAt > new Date());
        if (!row) return { count: 0 };
        row.consumedAt = data.consumedAt;
        return { count: 1 };
      },
    },
  };
  const { state, browserBinding } = createOAuthState();
  await storeOAuthState("canvasOAuthState", state, browserBinding, { schoolId: "school-1", actorId: "admin-1", baseUrl: "https://canvas.example", displayName: "Canvas" }, db);
  assert.match(state, /^[0-9a-f]{64}$/);
  await assert.rejects(() => claimOAuthState("canvasOAuthState", state, "wrong-browser", db), /browser mismatch/);
  const claimed = await claimOAuthState("canvasOAuthState", state, browserBinding, db);
  assert.equal((claimed as any).schoolId, "school-1");
  await assert.rejects(() => claimOAuthState("canvasOAuthState", state, browserBinding, db), /expired OAuth state/);
  const expired = createOAuthState();
  await storeOAuthState("canvasOAuthState", expired.state, expired.browserBinding, { schoolId: "school-1", actorId: "admin-1", baseUrl: "https://canvas.example", displayName: "Canvas" }, db);
  rows.get(hashToken(expired.state)).expiresAt = new Date(Date.now() - 1);
  await assert.rejects(() => claimOAuthState("canvasOAuthState", expired.state, expired.browserBinding, db), /expired OAuth state/);
});

test("OAuth callback authorization re-check rejects revoked or non-admin actors", async () => {
  const db = { user: { findUnique: async ({ where }: any) => where.id === "revoked" ? { role: "SCHOOL_ADMIN", status: "DISABLED", schoolId: "school-1" } : { role: "STUDENT", status: "ACTIVE", schoolId: "school-1" } } };
  await assert.rejects(() => assertOAuthAdministrator("revoked", "school-1", db), /no longer authorized/);
  await assert.rejects(() => assertOAuthAdministrator("student", "school-1", db), /no longer authorized/);
});

test("student session tokens expire in 24 hours while staff retain seven-day sessions", () => {
  const student = JSON.parse(Buffer.from(signUserToken({ id: "s", email: "s@example.test", role: "STUDENT", tokenVersion: 2 }).split(".")[1], "base64url").toString());
  const staff = JSON.parse(Buffer.from(signUserToken({ id: "a", email: "a@example.test", role: "SCHOOL_ADMIN", tokenVersion: 2 }).split(".")[1], "base64url").toString());
  assert.equal(student.tv, 2); assert.equal(student.exp - student.iat, 24 * 60 * 60);
  assert.equal(staff.exp - staff.iat, 7 * 24 * 60 * 60);
});
