import test from "node:test";
import assert from "node:assert/strict";
import { calculateReliability } from "../src/lib/reliabilityMetrics";
const now = new Date("2026-08-10T00:00:00Z");
test("reliability score uses rolling window and privacy minimum", () => {
  const events = Array.from({ length: 4 }, (_, i) => ({ at: new Date(now.getTime() - i * 86400000), responseMinutes: 10, attendanceAccurate: true, cancelled: false, verificationMinutes: 5 }));
  assert.equal(calculateReliability(events, { now, windowDays: 30, minimumSamples: 5 }), null);
  assert.equal(calculateReliability(events, { now, windowDays: 30, minimumSamples: 3 })?.score, 96);
});
