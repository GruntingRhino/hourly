import test from "node:test";
import assert from "node:assert/strict";
import { toLegacyAvailableSlot } from "../src/lib/legacyOpportunityAvailability";

test("approved legacy organization opportunities are represented as browsable slots", () => {
  const slot = toLegacyAvailableSlot({
    id: "legacy-opportunity",
    title: "e",
    description: "Volunteer opportunity",
    date: new Date("2026-07-20T00:00:00.000Z"),
    startTime: "10:00",
    endTime: "12:00",
    durationHours: 2,
    capacity: 12,
    organization: { id: "legacy-organization", name: "Boston Sharks INC" },
    confirmedSignupCount: 3,
  });

  assert.equal(slot.id, "legacy:legacy-opportunity");
  assert.equal(slot.legacyOpportunityId, "legacy-opportunity");
  assert.equal(slot.opportunity.title, "e");
  assert.equal(slot.opportunity.beneficiary.name, "Boston Sharks INC");
  assert.equal(slot._count.signups, 3);
});
