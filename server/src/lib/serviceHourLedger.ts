import prisma from "./prisma";
import type { ServiceHourLedgerSourceType } from "@prisma/client";

/**
 * §9 canonical service-hour ledger: records one append-only entry for an
 * hour-approval event. Called alongside (never instead of) each approve
 * route's existing write to its own source table — this does not change
 * what lib/hoursCalculator.ts reads from. Best-effort: a ledger-write
 * failure must never block or roll back the actual approval, so callers
 * should invoke this after the real approval succeeds and treat a
 * rejection here as a logged warning, not a request failure — matching
 * how this codebase already treats notification/email sends after a
 * state-changing write.
 */
type LedgerWriter = Pick<typeof prisma, "serviceHourLedgerEntry">;

export async function recordServiceHourLedgerEntry(entry: {
  studentId: string;
  schoolId: string | null;
  sourceType: ServiceHourLedgerSourceType;
  sourceId: string;
  category: string | null;
  approvedHours: number;
  approverId: string;
  db?: LedgerWriter;
  throwOnError?: boolean;
}): Promise<void> {
  const db = entry.db ?? prisma;
  try {
    await db.serviceHourLedgerEntry.create({
      data: {
        studentId: entry.studentId,
        schoolId: entry.schoolId,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        category: entry.category,
        approvedMinutes: Math.round(entry.approvedHours * 60),
        approverId: entry.approverId,
      },
    });
  } catch (err) {
    if (entry.throwOnError) throw err;
    console.error(`[serviceHourLedger] Failed to record ledger entry for ${entry.sourceType}:${entry.sourceId}:`, err);
  }
}
