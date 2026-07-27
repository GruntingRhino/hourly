import test from "node:test";
import assert from "node:assert/strict";
import { compareAvailableSlots } from "../src/lib/opportunityListingPolicy";

function slot(input: { date?: string; startTime?: string; planTier?: "FREE" | "PRO" }) {
  return {
    date: input.date ?? "2026-08-01T00:00:00.000Z",
    startTime: input.startTime ?? "10:00 AM",
    opportunity: {
      beneficiary: {
        planTier: input.planTier ?? "FREE",
        createdBySchoolId: null,
        visibility: "PUBLIC",
      },
    },
  };
}

test("priority listing never outranks an earlier opportunity", () => {
  const earlierFree = slot({ date: "2026-08-01T00:00:00.000Z", planTier: "FREE" });
  const laterPro = slot({ date: "2026-08-02T00:00:00.000Z", planTier: "PRO" });
  assert.ok(compareAvailableSlots(earlierFree, laterPro) < 0);
});

test("Pro receives the featured-placement tie-break when opportunities are equally relevant", () => {
  const free = slot({ planTier: "FREE" });
  const pro = slot({ planTier: "PRO" });
  assert.ok(compareAvailableSlots(pro, free) < 0);
  assert.ok(compareAvailableSlots(free, pro) > 0);
});
