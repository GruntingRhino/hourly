export type ReminderJobStatus = "PENDING" | "LEASED" | "SENT" | "FAILED";
export interface ReminderJob { id: string; idempotencyKey: string; attempts: number; status: ReminderJobStatus; leasedUntil: Date | null; failureReason: string | null; }
export function leaseReminderJob(job: ReminderJob, now: Date, leaseMs: number): ReminderJob | null {
  if (job.status === "SENT" || (job.leasedUntil && job.leasedUntil > now)) return null;
  return { ...job, status: "LEASED", leasedUntil: new Date(now.getTime() + leaseMs) };
}
export function completeReminderJob(job: ReminderJob, result: { ok: true } | { ok: false; reason: string }, now: Date): ReminderJob {
  if (result.ok) return { ...job, status: "SENT", leasedUntil: null, failureReason: null };
  return { ...job, status: "FAILED", attempts: job.attempts + 1, leasedUntil: null, failureReason: "reason" in result ? result.reason : "Unknown reminder failure" };
}
