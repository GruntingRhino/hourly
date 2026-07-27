import test from "node:test";
import assert from "node:assert/strict";
import {
  parseReminderConfigInput,
  parseStoredReminders,
} from "../src/lib/reminderConfigPolicy";

test("reminder configuration accepts bounded, unique, valid definitions", () => {
  const result = parseReminderConfigInput({
    reminders: [
      { minutesBefore: 180, enabled: true, label: "  Three hours  " },
      { minutesBefore: 1440, enabled: false, label: "One day" },
    ],
    waitlistCutoffHours: 24,
    requireApprovalForPromotion: true,
    disableAutoPromotion: false,
    promoMessageTemplate: "  A place opened up.  ",
  });

  assert.deepEqual(result, {
    reminders: [
      { minutesBefore: 180, enabled: true, label: "Three hours" },
      { minutesBefore: 1440, enabled: false, label: "One day" },
    ],
    waitlistCutoffHours: 24,
    requireApprovalForPromotion: true,
    disableAutoPromotion: false,
    promoMessageTemplate: "A place opened up.",
  });
});

test("reminder configuration rejects duplicate, malformed, and unsafe values", () => {
  for (const input of [
    { reminders: [{ minutesBefore: 10, enabled: true, label: "a" }, { minutesBefore: 10, enabled: true, label: "b" }] },
    { reminders: [{ minutesBefore: 0, enabled: true, label: "a" }] },
    { reminders: [{ minutesBefore: 1.5, enabled: true, label: "a" }] },
    { reminders: [{ minutesBefore: 60, enabled: "true", label: "a" }] },
    { reminders: Array.from({ length: 9 }, (_, index) => ({ minutesBefore: index + 1, enabled: true, label: "a" })) },
    { waitlistCutoffHours: -1 },
    { promoMessageTemplate: "x".repeat(2001) },
  ]) {
    assert.throws(() => parseReminderConfigInput(input));
  }
});

test("malformed legacy reminder JSON falls back to supplied safe defaults", () => {
  const defaults = [{ minutesBefore: 1440, enabled: true, label: "24 hours" }];
  assert.deepEqual(parseStoredReminders('{"minutesBefore":"bad"}', defaults), defaults);
  assert.deepEqual(parseStoredReminders('[{"minutesBefore":0,"enabled":true,"label":"bad"}]', defaults), defaults);
  assert.deepEqual(parseStoredReminders('[{"minutesBefore":60,"enabled":true,"label":" okay "}]', defaults), [
    { minutesBefore: 60, enabled: true, label: "okay" },
  ]);
});
