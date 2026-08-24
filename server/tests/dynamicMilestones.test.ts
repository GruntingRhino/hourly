import test from "node:test";
import assert from "node:assert/strict";
import { deriveMilestones, parseMilestoneThresholds } from "../src/lib/dynamicMilestones";

test("derives milestone state from approved canonical ledger hours", () => {
  const result = deriveMilestones({ approvedHours: 12, thresholds: parseMilestoneThresholds('{"25": "Started", "50": "Halfway", "100": "Complete"}') });
  assert.deepEqual(result, { percentComplete: 30, reached: [{ percent: 25, label: "Started" }], next: { percent: 50, label: "Halfway" } });
});

test("uses safe school-configurable defaults and clamps ledger values", () => {
  const result = deriveMilestones({ approvedHours: 100, requiredHours: 40, thresholds: parseMilestoneThresholds("invalid") });
  assert.equal(result.percentComplete, 100);
  assert.deepEqual(result.reached.map((item) => item.percent), [25, 50, 75, 100]);
  assert.equal(result.next, null);
});
