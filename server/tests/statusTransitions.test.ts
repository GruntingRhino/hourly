import test from "node:test";
import assert from "node:assert/strict";

// Valid session statuses as used in the app
type SessionStatus =
  | "PENDING_CHECKIN"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "VERIFIED"
  | "REJECTED"
  | "WAITLISTED"
  | "CANCELLED"
  | "PENDING_VERIFICATION";

// Valid transitions derived from sessions.ts and verification.ts:
// PENDING_CHECKIN → CHECKED_IN (check-in)
// CHECKED_IN      → CHECKED_OUT (check-out)
// CHECKED_OUT     → VERIFIED or REJECTED (verification approval/rejection)
// REJECTED        → CHECKED_OUT (re-submit after rejection)
// VERIFIED        is terminal — no outbound transitions
const VALID_TRANSITIONS: [SessionStatus, SessionStatus][] = [
  ["PENDING_CHECKIN", "CHECKED_IN"],
  ["CHECKED_IN", "CHECKED_OUT"],
  ["CHECKED_OUT", "VERIFIED"],
  ["CHECKED_OUT", "REJECTED"],
  ["REJECTED", "CHECKED_OUT"],
];

function isValidTransition(from: SessionStatus, to: SessionStatus): boolean {
  return VALID_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

// ── Status string values ────────────────────────────────────────────────────

test("status string PENDING_CHECKIN matches exactly", () => {
  const status: SessionStatus = "PENDING_CHECKIN";
  assert.equal(status, "PENDING_CHECKIN");
});

test("status string CHECKED_IN matches exactly", () => {
  const status: SessionStatus = "CHECKED_IN";
  assert.equal(status, "CHECKED_IN");
});

test("status string CHECKED_OUT matches exactly", () => {
  const status: SessionStatus = "CHECKED_OUT";
  assert.equal(status, "CHECKED_OUT");
});

test("status string VERIFIED matches exactly", () => {
  const status: SessionStatus = "VERIFIED";
  assert.equal(status, "VERIFIED");
});

test("status string REJECTED matches exactly", () => {
  const status: SessionStatus = "REJECTED";
  assert.equal(status, "REJECTED");
});

// ── Valid transitions ───────────────────────────────────────────────────────

test("PENDING_CHECKIN → CHECKED_IN is valid (check-in)", () => {
  assert.ok(isValidTransition("PENDING_CHECKIN", "CHECKED_IN"));
});

test("CHECKED_IN → CHECKED_OUT is valid (check-out)", () => {
  assert.ok(isValidTransition("CHECKED_IN", "CHECKED_OUT"));
});

test("CHECKED_OUT → VERIFIED is valid (approve)", () => {
  assert.ok(isValidTransition("CHECKED_OUT", "VERIFIED"));
});

test("CHECKED_OUT → REJECTED is valid (reject)", () => {
  assert.ok(isValidTransition("CHECKED_OUT", "REJECTED"));
});

test("REJECTED → CHECKED_OUT is valid (re-submit after rejection)", () => {
  assert.ok(isValidTransition("REJECTED", "CHECKED_OUT"));
});

// ── Invalid / skipped transitions ──────────────────────────────────────────

test("PENDING_CHECKIN → CHECKED_OUT is invalid (skips CHECKED_IN)", () => {
  assert.equal(isValidTransition("PENDING_CHECKIN", "CHECKED_OUT"), false);
});

test("PENDING_CHECKIN → VERIFIED is invalid (skips multiple steps)", () => {
  assert.equal(isValidTransition("PENDING_CHECKIN", "VERIFIED"), false);
});

test("CHECKED_IN → VERIFIED is invalid (skips CHECKED_OUT)", () => {
  assert.equal(isValidTransition("CHECKED_IN", "VERIFIED"), false);
});

test("CHECKED_IN → REJECTED is invalid (not yet checked out)", () => {
  assert.equal(isValidTransition("CHECKED_IN", "REJECTED"), false);
});

// ── VERIFIED is terminal ────────────────────────────────────────────────────

test("VERIFIED → CHECKED_OUT is invalid (VERIFIED is terminal)", () => {
  assert.equal(isValidTransition("VERIFIED", "CHECKED_OUT"), false);
});

test("VERIFIED → REJECTED is invalid (VERIFIED is terminal)", () => {
  assert.equal(isValidTransition("VERIFIED", "REJECTED"), false);
});

test("VERIFIED → PENDING_CHECKIN is invalid (VERIFIED is terminal)", () => {
  assert.equal(isValidTransition("VERIFIED", "PENDING_CHECKIN"), false);
});

test("VERIFIED → CHECKED_IN is invalid (VERIFIED is terminal)", () => {
  assert.equal(isValidTransition("VERIFIED", "CHECKED_IN"), false);
});

// ── Self-transitions ────────────────────────────────────────────────────────

test("CHECKED_OUT → CHECKED_OUT (self-transition) is invalid", () => {
  assert.equal(isValidTransition("CHECKED_OUT", "CHECKED_OUT"), false);
});

test("VERIFIED → VERIFIED (self-transition) is invalid", () => {
  assert.equal(isValidTransition("VERIFIED", "VERIFIED"), false);
});
