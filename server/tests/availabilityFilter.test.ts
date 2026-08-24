import test from "node:test";
import assert from "node:assert/strict";
import { isOpportunityAvailable } from "../src/lib/availabilityFilter";
test("availability filter compares event in the student's explicit timezone", () => assert.equal(isOpportunityAvailable({ start: new Date("2026-08-10T14:00:00Z"), end: new Date("2026-08-10T16:00:00Z"), timezone: "America/New_York", windows: [{ weekday: 1, start: "09:00", end: "13:00" }] }), true));
test("invalid timezone is rejected instead of silently matching", () => assert.throws(() => isOpportunityAvailable({ start: new Date(), end: new Date(), timezone: "not/a-zone", windows: [] })));
