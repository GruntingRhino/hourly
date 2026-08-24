import test from "node:test";
import assert from "node:assert/strict";
import { buildCanonicalLedger, buildServiceResume } from "../src/lib/canonicalLedger";

test("canonical ledger excludes unverified entries and resume uses only verified records", () => {
  const ledger = buildCanonicalLedger([
    { id: "a", studentId: "s", date: "2026-01-02", organizationName: "Food Bank", description: "Packing", hours: 3, status: "APPROVED", source: "SELF_SUBMISSION" },
    { id: "b", studentId: "s", date: "2026-01-03", organizationName: "Draft Org", description: "Draft", hours: 9, status: "PENDING", source: "SELF_SUBMISSION" },
  ]);
  assert.equal(ledger.totalApprovedHours, 3);
  assert.equal(ledger.entries.length, 1);
  assert.deepEqual(buildServiceResume(ledger), { totalHours: 3, activities: [{ date: "2026-01-02", organizationName: "Food Bank", description: "Packing", hours: 3, source: "SELF_SUBMISSION" }] });
});

test("canonical ledger rejects malformed and negative hours", () => {
  assert.throws(() => buildCanonicalLedger([{ id: "x", studentId: "s", date: "bad", organizationName: "Org", description: "x", hours: -1, status: "APPROVED", source: "LEGACY" }]));
});
