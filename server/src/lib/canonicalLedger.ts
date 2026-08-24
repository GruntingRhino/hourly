export type LedgerSource = "SELF_SUBMISSION" | "LEGACY_SESSION" | "BENEFICIARY_SIGNUP";

export interface LedgerInput {
  id: string;
  studentId: string;
  date: string | Date;
  organizationName: string;
  description: string;
  hours: number;
  status: string;
  source: LedgerSource;
}

export interface CanonicalLedgerEntry {
  id: string;
  studentId: string;
  date: string;
  organizationName: string;
  description: string;
  hours: number;
  source: LedgerSource;
}

export interface CanonicalLedger {
  entries: CanonicalLedgerEntry[];
  totalApprovedHours: number;
}

function normalizeDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Ledger date is invalid");
  return date.toISOString().slice(0, 10);
}

export function buildCanonicalLedger(inputs: LedgerInput[]): CanonicalLedger {
  const seen = new Set<string>();
  const entries = inputs
    .filter((input) => input.status === "APPROVED" || input.status === "VERIFIED")
    .map((input) => {
      if (seen.has(input.id)) throw new Error(`Duplicate ledger entry: ${input.id}`);
      seen.add(input.id);
      if (!input.studentId || !input.organizationName || !input.description || !Number.isFinite(input.hours) || input.hours < 0) {
        throw new Error(`Invalid ledger entry: ${input.id}`);
      }
      return { id: input.id, studentId: input.studentId, date: normalizeDate(input.date), organizationName: input.organizationName.trim(), description: input.description.trim(), hours: Math.round(input.hours * 100) / 100, source: input.source };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return { entries, totalApprovedHours: Math.round(entries.reduce((sum, entry) => sum + entry.hours, 0) * 100) / 100 };
}

export function buildServiceResume(ledger: CanonicalLedger) {
  return {
    totalHours: ledger.totalApprovedHours,
    activities: ledger.entries.map(({ date, organizationName, description, hours, source }) => ({ date, organizationName, description, hours, source })),
  };
}
