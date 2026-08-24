import test from "node:test";
import assert from "node:assert/strict";
import { completeReminderJob, leaseReminderJob } from "../src/lib/reminderJobPolicy";
const now = new Date("2026-08-10T00:00:00Z");
const job = { id: "j", idempotencyKey: "signup:24h", attempts: 0, status: "PENDING" as const, leasedUntil: null, failureReason: null };
test("reminder lease is durable/idempotent and failures are recorded", () => {
  const leased = leaseReminderJob(job, now, 60000)!;
  assert.equal(leaseReminderJob(leased, now, 60000), null);
  const failed = completeReminderJob(leased, { ok: false, reason: "SMTP unavailable" }, now);
  assert.deepEqual({ status: failed.status, attempts: failed.attempts, failureReason: failed.failureReason }, { status: "FAILED", attempts: 1, failureReason: "SMTP unavailable" });
  assert.equal(completeReminderJob(failed, { ok: true }, now).status, "SENT");
});
