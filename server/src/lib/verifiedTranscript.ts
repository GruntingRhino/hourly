import crypto from "node:crypto";
import { CanonicalLedger } from "./canonicalLedger";

export interface TranscriptSnapshot {
  id: string;
  studentId: string;
  schoolId: string;
  ledger: CanonicalLedger;
  ledgerHash: string;
  status: "DRAFT" | "CERTIFIED";
  certifiedBy: string | null;
  certifiedAt: string | null;
}

function digest(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function createTranscriptSnapshot(params: { id: string; studentId: string; schoolId: string; actorRole: string; actorSchoolId: string | null; ledger: CanonicalLedger }): TranscriptSnapshot {
  if (params.actorRole !== "SCHOOL_ADMIN" || params.actorSchoolId !== params.schoolId) throw new Error("Only the student's school admin may create a transcript");
  const ledger = structuredClone(params.ledger);
  return { id: params.id, studentId: params.studentId, schoolId: params.schoolId, ledger, ledgerHash: digest(ledger), status: "DRAFT", certifiedBy: null, certifiedAt: null };
}

export function certifyTranscript(snapshot: TranscriptSnapshot, params: { actorId: string; actorRole: string; actorSchoolId: string | null; now?: Date }): TranscriptSnapshot {
  if (params.actorRole !== "SCHOOL_ADMIN" || params.actorSchoolId !== snapshot.schoolId) throw new Error("Only the student's school admin may certify a transcript");
  if (digest(snapshot.ledger) !== snapshot.ledgerHash) throw new Error("Transcript ledger snapshot was modified");
  if (snapshot.status === "CERTIFIED") throw new Error("Transcript is already certified");
  return { ...snapshot, status: "CERTIFIED", certifiedBy: params.actorId, certifiedAt: (params.now ?? new Date()).toISOString() };
}
