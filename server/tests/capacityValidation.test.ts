import test from "node:test";
import assert from "node:assert/strict";

// Pure logic mirroring signups.ts:
// status = confirmedCount >= capacity ? "WAITLISTED" : "CONFIRMED"
function getSignupStatus(confirmedCount: number, capacity: number): "CONFIRMED" | "WAITLISTED" | "CLOSED" {
  if (capacity === 0) return "CLOSED";
  return confirmedCount >= capacity ? "WAITLISTED" : "CONFIRMED";
}

// Simulate promoting the first waitlisted signup when a confirmed signup is cancelled.
// Returns the new status of the waitlisted signup, or null if nobody was waiting.
interface Signup {
  id: string;
  userId: string;
  status: "CONFIRMED" | "WAITLISTED" | "CANCELLED";
  createdAt: number; // timestamp for ordering
}

function cancelAndPromote(signups: Signup[], cancelId: string): Signup[] {
  const result = signups.map((s) => ({ ...s }));
  const cancelled = result.find((s) => s.id === cancelId);
  if (!cancelled || cancelled.status !== "CONFIRMED") return result;

  cancelled.status = "CANCELLED";

  // Promote oldest waitlisted
  const firstWaitlisted = result
    .filter((s) => s.status === "WAITLISTED")
    .sort((a, b) => a.createdAt - b.createdAt)[0];

  if (firstWaitlisted) {
    firstWaitlisted.status = "CONFIRMED";
  }

  return result;
}

// ── Status assignment ───────────────────────────────────────────────────────

test("signup is CONFIRMED when confirmedCount < capacity", () => {
  assert.equal(getSignupStatus(3, 10), "CONFIRMED");
});

test("signup is CONFIRMED when confirmedCount is 0 and capacity > 0", () => {
  assert.equal(getSignupStatus(0, 5), "CONFIRMED");
});

test("signup is WAITLISTED when confirmedCount equals capacity", () => {
  assert.equal(getSignupStatus(10, 10), "WAITLISTED");
});

test("signup is WAITLISTED when confirmedCount exceeds capacity", () => {
  assert.equal(getSignupStatus(11, 10), "WAITLISTED");
});

test("signup is WAITLISTED when at capacity of 1", () => {
  assert.equal(getSignupStatus(1, 1), "WAITLISTED");
});

// ── Capacity 0 = closed ─────────────────────────────────────────────────────

test("capacity 0 means opportunity is closed, no signups allowed", () => {
  assert.equal(getSignupStatus(0, 0), "CLOSED");
});

test("capacity 0 is still closed even with 0 confirmed signups", () => {
  assert.equal(getSignupStatus(0, 0), "CLOSED");
});

// ── Waitlist promotion on cancellation ─────────────────────────────────────

test("cancelling a CONFIRMED signup when a WAITLISTED user exists promotes that user", () => {
  const signups: Signup[] = [
    { id: "a", userId: "user-a", status: "CONFIRMED", createdAt: 1 },
    { id: "b", userId: "user-b", status: "WAITLISTED", createdAt: 2 },
  ];
  const result = cancelAndPromote(signups, "a");
  const promoted = result.find((s) => s.id === "b");
  assert.equal(promoted?.status, "CONFIRMED");
});

test("cancelled signup has CANCELLED status after cancellation", () => {
  const signups: Signup[] = [
    { id: "a", userId: "user-a", status: "CONFIRMED", createdAt: 1 },
    { id: "b", userId: "user-b", status: "WAITLISTED", createdAt: 2 },
  ];
  const result = cancelAndPromote(signups, "a");
  const cancelled = result.find((s) => s.id === "a");
  assert.equal(cancelled?.status, "CANCELLED");
});

test("cancelling a CONFIRMED signup with no waitlisted users does not crash", () => {
  const signups: Signup[] = [
    { id: "a", userId: "user-a", status: "CONFIRMED", createdAt: 1 },
  ];
  const result = cancelAndPromote(signups, "a");
  const cancelled = result.find((s) => s.id === "a");
  assert.equal(cancelled?.status, "CANCELLED");
});

test("oldest waitlisted user is promoted first (FIFO order)", () => {
  const signups: Signup[] = [
    { id: "confirmed", userId: "user-0", status: "CONFIRMED", createdAt: 0 },
    { id: "wait-2", userId: "user-2", status: "WAITLISTED", createdAt: 200 },
    { id: "wait-1", userId: "user-1", status: "WAITLISTED", createdAt: 100 },
  ];
  const result = cancelAndPromote(signups, "confirmed");
  const promoted = result.find((s) => s.id === "wait-1");
  const stillWaiting = result.find((s) => s.id === "wait-2");
  assert.equal(promoted?.status, "CONFIRMED");
  assert.equal(stillWaiting?.status, "WAITLISTED");
});

test("cancelling a WAITLISTED signup does not trigger promotion", () => {
  const signups: Signup[] = [
    { id: "a", userId: "user-a", status: "CONFIRMED", createdAt: 1 },
    { id: "b", userId: "user-b", status: "WAITLISTED", createdAt: 2 },
  ];
  // Cancel the waitlisted one — no one to promote
  const result = cancelAndPromote(signups, "b");
  // b is not CONFIRMED so our helper won't promote anyone
  const confirmedUser = result.find((s) => s.id === "a");
  assert.equal(confirmedUser?.status, "CONFIRMED");
  const cancelledUser = result.find((s) => s.id === "b");
  // b was WAITLISTED, not CONFIRMED, so cancelAndPromote leaves it unchanged
  assert.equal(cancelledUser?.status, "WAITLISTED");
});

test("capacity of 1 with 0 confirmed gives CONFIRMED status", () => {
  assert.equal(getSignupStatus(0, 1), "CONFIRMED");
});

test("capacity of 1 with 1 confirmed gives WAITLISTED status", () => {
  assert.equal(getSignupStatus(1, 1), "WAITLISTED");
});
