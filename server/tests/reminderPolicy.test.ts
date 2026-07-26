import test from "node:test";
import assert from "node:assert/strict";

import {
  DAY_MS,
  WEEK_MS,
  getInAppNotificationCooldownMs,
} from "../src/lib/reminderPolicy";

test("behind-hours in-app alerts are throttled for one week", () => {
  assert.equal(getInAppNotificationCooldownMs("AT_RISK_ALERT"), WEEK_MS);
});

test("other in-app reminder types retain the daily cooldown", () => {
  assert.equal(getInAppNotificationCooldownMs("DEADLINE_REMINDER"), DAY_MS);
  assert.equal(getInAppNotificationCooldownMs("ADMIN_PENDING_REVIEW_ALERT"), DAY_MS);
});
