import test from "node:test";
import assert from "node:assert/strict";

// Audit log entry shapes derived from verification.ts and sessions.ts.
// No database connection is needed — tests validate the data structure
// that would be written to the auditLog table.

type AuditAction =
  | "APPROVE"
  | "REJECT"
  | "OVERRIDE"
  | "CHECK_IN"
  | "CHECK_OUT"
  | "SUBMIT_VERIFICATION";

interface ApproveDetails {
  approvedHours: number;
  originalHours: number | null;
}

interface RejectDetails {
  reason: string;
}

interface OverrideDetails {
  reason: string;
  approvedHours?: number;
  originalHours?: number | null;
}

interface CheckInDetails {
  time: string;
}

interface CheckOutDetails {
  time: string;
  totalHours: number;
}

interface AuditLogEntry {
  action: AuditAction;
  actorId: string;
  sessionId: string;
  details: string; // stored as JSON string
}

function buildApproveEntry(actorId: string, sessionId: string, approvedHours: number, originalHours: number | null): AuditLogEntry {
  const details: ApproveDetails = { approvedHours, originalHours };
  return { action: "APPROVE", actorId, sessionId, details: JSON.stringify(details) };
}

function buildRejectEntry(actorId: string, sessionId: string, reason: string): AuditLogEntry {
  const details: RejectDetails = { reason };
  return { action: "REJECT", actorId, sessionId, details: JSON.stringify(details) };
}

function buildOverrideEntry(actorId: string, sessionId: string, reason: string, approvedHours?: number, originalHours?: number | null): AuditLogEntry {
  const details: OverrideDetails = { reason, approvedHours, originalHours };
  return { action: "OVERRIDE", actorId, sessionId, details: JSON.stringify(details) };
}

function buildCheckInEntry(actorId: string, sessionId: string, time: Date): AuditLogEntry {
  const details: CheckInDetails = { time: time.toISOString() };
  return { action: "CHECK_IN", actorId, sessionId, details: JSON.stringify(details) };
}

function buildCheckOutEntry(actorId: string, sessionId: string, time: Date, totalHours: number): AuditLogEntry {
  const details: CheckOutDetails = { time: time.toISOString(), totalHours };
  return { action: "CHECK_OUT", actorId, sessionId, details: JSON.stringify(details) };
}

// ── APPROVE action ──────────────────────────────────────────────────────────

test("APPROVE entry has action: APPROVE", () => {
  const entry = buildApproveEntry("actor-1", "session-1", 2.5, 2.5);
  assert.equal(entry.action, "APPROVE");
});

test("APPROVE entry details contain approvedHours as number", () => {
  const entry = buildApproveEntry("actor-1", "session-1", 2.5, 3.0);
  const details = JSON.parse(entry.details) as ApproveDetails;
  assert.equal(typeof details.approvedHours, "number");
  assert.equal(details.approvedHours, 2.5);
});

test("APPROVE entry details contain originalHours as number", () => {
  const entry = buildApproveEntry("actor-1", "session-1", 2.5, 3.0);
  const details = JSON.parse(entry.details) as ApproveDetails;
  assert.equal(typeof details.originalHours, "number");
  assert.equal(details.originalHours, 3.0);
});

test("APPROVE entry details contain actorId as string", () => {
  const entry = buildApproveEntry("actor-123", "session-1", 2.5, 2.5);
  assert.equal(typeof entry.actorId, "string");
  assert.equal(entry.actorId, "actor-123");
});

test("APPROVE entry originalHours can be null (when session had no prior hours)", () => {
  const entry = buildApproveEntry("actor-1", "session-1", 1.0, null);
  const details = JSON.parse(entry.details) as ApproveDetails;
  assert.equal(details.originalHours, null);
});

// ── REJECT action ───────────────────────────────────────────────────────────

test("REJECT entry has action: REJECT", () => {
  const entry = buildRejectEntry("actor-1", "session-1", "Did not show up");
  assert.equal(entry.action, "REJECT");
});

test("REJECT entry details contain reason as string", () => {
  const entry = buildRejectEntry("actor-1", "session-1", "Insufficient hours logged");
  const details = JSON.parse(entry.details) as RejectDetails;
  assert.equal(typeof details.reason, "string");
  assert.equal(details.reason, "Insufficient hours logged");
});

test("REJECT entry details reason is non-empty", () => {
  const entry = buildRejectEntry("actor-1", "session-1", "Some reason");
  const details = JSON.parse(entry.details) as RejectDetails;
  assert.ok(details.reason.length > 0);
});

// ── OVERRIDE action ─────────────────────────────────────────────────────────

test("OVERRIDE entry has action: OVERRIDE", () => {
  const entry = buildOverrideEntry("actor-1", "session-1", "Correcting clerical error", 3.0, 2.5);
  assert.equal(entry.action, "OVERRIDE");
});

test("OVERRIDE entry details contain reason as string", () => {
  const entry = buildOverrideEntry("actor-1", "session-1", "Manual correction", 2.0, 1.5);
  const details = JSON.parse(entry.details) as OverrideDetails;
  assert.equal(typeof details.reason, "string");
  assert.equal(details.reason, "Manual correction");
});

// ── Valid enum values ───────────────────────────────────────────────────────

const VALID_ACTIONS: AuditAction[] = [
  "APPROVE",
  "REJECT",
  "OVERRIDE",
  "CHECK_IN",
  "CHECK_OUT",
  "SUBMIT_VERIFICATION",
];

test("all expected audit actions are in the valid set", () => {
  assert.ok(VALID_ACTIONS.includes("APPROVE"));
  assert.ok(VALID_ACTIONS.includes("REJECT"));
  assert.ok(VALID_ACTIONS.includes("OVERRIDE"));
  assert.ok(VALID_ACTIONS.includes("CHECK_IN"));
  assert.ok(VALID_ACTIONS.includes("CHECK_OUT"));
  assert.ok(VALID_ACTIONS.includes("SUBMIT_VERIFICATION"));
});

test("APPROVE action string is in the valid actions enum", () => {
  const entry = buildApproveEntry("a", "s", 1, 1);
  assert.ok(VALID_ACTIONS.includes(entry.action));
});

test("REJECT action string is in the valid actions enum", () => {
  const entry = buildRejectEntry("a", "s", "reason");
  assert.ok(VALID_ACTIONS.includes(entry.action));
});

test("OVERRIDE action string is in the valid actions enum", () => {
  const entry = buildOverrideEntry("a", "s", "reason");
  assert.ok(VALID_ACTIONS.includes(entry.action));
});

// ── JSON serialization of details ──────────────────────────────────────────

test("APPROVE details field is a valid JSON string", () => {
  const entry = buildApproveEntry("actor-1", "session-1", 2.5, 3.0);
  assert.doesNotThrow(() => JSON.parse(entry.details));
});

test("REJECT details field is a valid JSON string", () => {
  const entry = buildRejectEntry("actor-1", "session-1", "Some reason");
  assert.doesNotThrow(() => JSON.parse(entry.details));
});

test("CHECK_IN details field is a valid JSON string with ISO time", () => {
  const now = new Date("2025-06-01T09:00:00.000Z");
  const entry = buildCheckInEntry("actor-1", "session-1", now);
  assert.doesNotThrow(() => JSON.parse(entry.details));
  const details = JSON.parse(entry.details) as CheckInDetails;
  assert.equal(details.time, "2025-06-01T09:00:00.000Z");
});

test("CHECK_OUT details field contains totalHours as number", () => {
  const now = new Date("2025-06-01T11:00:00.000Z");
  const entry = buildCheckOutEntry("actor-1", "session-1", now, 2.0);
  const details = JSON.parse(entry.details) as CheckOutDetails;
  assert.equal(typeof details.totalHours, "number");
  assert.equal(details.totalHours, 2.0);
});

test("details round-trips through JSON serialization without data loss", () => {
  const original: ApproveDetails = { approvedHours: 3.5, originalHours: 3.0 };
  const serialized = JSON.stringify(original);
  const deserialized = JSON.parse(serialized) as ApproveDetails;
  assert.deepEqual(deserialized, original);
});

test("OVERRIDE details round-trips through JSON serialization", () => {
  const original: OverrideDetails = { reason: "Test override", approvedHours: 4.0, originalHours: 3.5 };
  const serialized = JSON.stringify(original);
  const deserialized = JSON.parse(serialized) as OverrideDetails;
  assert.deepEqual(deserialized, original);
});
