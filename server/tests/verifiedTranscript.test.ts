import test from "node:test";
import assert from "node:assert/strict";
import { buildCanonicalLedger } from "../src/lib/canonicalLedger";
import { certifyTranscript, createTranscriptSnapshot } from "../src/lib/verifiedTranscript";

test("transcript snapshot is immutable and school-admin certified", () => {
  const ledger = buildCanonicalLedger([{ id: "e", studentId: "s", date: "2026-01-01", organizationName: "Org", description: "Work", hours: 2, status: "APPROVED", source: "SELF_SUBMISSION" }]);
  const snapshot = createTranscriptSnapshot({ id: "t", studentId: "s", schoolId: "school", actorRole: "SCHOOL_ADMIN", actorSchoolId: "school", ledger });
  const certified = certifyTranscript(snapshot, { actorId: "admin", actorRole: "SCHOOL_ADMIN", actorSchoolId: "school", now: new Date("2026-01-02T00:00:00Z") });
  assert.equal(certified.status, "CERTIFIED");
  assert.equal(certified.ledgerHash.length, 64);
  assert.throws(() => certifyTranscript({ ...snapshot, ledger: { ...snapshot.ledger, totalApprovedHours: 99 } }, { actorId: "admin", actorRole: "SCHOOL_ADMIN", actorSchoolId: "school" }));
});
