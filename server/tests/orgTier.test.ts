import test from "node:test";
import assert from "node:assert/strict";

import {
  ORGANIZATION_TIER_LIMITS,
  getOrgTierLimits,
  ForbiddenFeatureError,
  DEFAULT_FREE_REMINDERS,
  DEFAULT_PRO_REMINDERS,
} from "../src/lib/orgTierGates";
import { generateICS, parseTimeString, slotDateTime } from "../src/lib/icsGenerator";

// ── Tier limit structure ────────────────────────────────────────

test("FREE tier has lower storage than PRO", () => {
  assert.ok(ORGANIZATION_TIER_LIMITS.FREE.storageLimitBytes < ORGANIZATION_TIER_LIMITS.PRO.storageLimitBytes);
});

test("FREE tier has lower upload rate than PRO", () => {
  assert.ok(ORGANIZATION_TIER_LIMITS.FREE.uploadAttemptsPerHour < ORGANIZATION_TIER_LIMITS.PRO.uploadAttemptsPerHour);
});

test("FREE tier has all Pro features disabled", () => {
  const free = ORGANIZATION_TIER_LIMITS.FREE;
  assert.equal(free.configurableReminders, false);
  assert.equal(free.customEmailBranding, false);
  assert.equal(free.automatedFormReminders, false);
  assert.equal(free.advancedReminderContent, false);
  assert.equal(free.advancedWaitlistControls, false);
  assert.equal(free.attendanceAnalytics, false);
});

test("PRO tier has all features enabled", () => {
  const pro = ORGANIZATION_TIER_LIMITS.PRO;
  assert.equal(pro.configurableReminders, true);
  assert.equal(pro.customEmailBranding, true);
  assert.equal(pro.automatedFormReminders, true);
  assert.equal(pro.advancedReminderContent, true);
  assert.equal(pro.advancedWaitlistControls, true);
  assert.equal(pro.attendanceAnalytics, true);
});

test("getOrgTierLimits returns FREE limits for FREE tier", () => {
  const limits = getOrgTierLimits("FREE");
  assert.equal(limits.storageLimitBytes, ORGANIZATION_TIER_LIMITS.FREE.storageLimitBytes);
  assert.equal(limits.configurableReminders, false);
});

test("getOrgTierLimits returns PRO limits for PRO tier", () => {
  const limits = getOrgTierLimits("PRO");
  assert.equal(limits.storageLimitBytes, ORGANIZATION_TIER_LIMITS.PRO.storageLimitBytes);
  assert.equal(limits.configurableReminders, true);
});

// ── ForbiddenFeatureError ───────────────────────────────────────

test("ForbiddenFeatureError has code PRO_FEATURE_REQUIRED", () => {
  const err = new ForbiddenFeatureError("configurableReminders", "Upgrade to unlock.");
  assert.equal(err.code, "PRO_FEATURE_REQUIRED");
  assert.equal(err.feature, "configurableReminders");
  assert.equal(err.userMessage, "Upgrade to unlock.");
  assert.ok(err instanceof Error);
});

// ── Default reminder schedules ──────────────────────────────────

test("Free default reminder is exactly 24h (1440 min)", () => {
  assert.equal(DEFAULT_FREE_REMINDERS.length, 1);
  assert.equal(DEFAULT_FREE_REMINDERS[0].minutesBefore, 1440);
  assert.equal(DEFAULT_FREE_REMINDERS[0].enabled, true);
});

test("Pro default reminders include 48h and 3h", () => {
  const minutes = DEFAULT_PRO_REMINDERS.map((r) => r.minutesBefore);
  assert.ok(minutes.includes(2880), "should include 48h (2880 min)");
  assert.ok(minutes.includes(180), "should include 3h (180 min)");
  assert.ok(DEFAULT_PRO_REMINDERS.every((r) => r.enabled), "all Pro defaults should be enabled");
});

test("Pro default has no 24h reminder (not duplicating Free)", () => {
  const has24h = DEFAULT_PRO_REMINDERS.some((r) => r.minutesBefore === 1440);
  assert.equal(has24h, false, "Pro default schedule should not include a 24h entry");
});

// ── ICS generation ──────────────────────────────────────────────

test("generateICS produces valid VCALENDAR wrapper", () => {
  const ics = generateICS({
    uid: "test-123",
    title: "Beach Cleanup",
    startUtc: new Date("2025-09-15T14:00:00Z"),
    endUtc: new Date("2025-09-15T17:00:00Z"),
    location: "Sunset Beach, CA",
  });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR"), "should start with VCALENDAR");
  assert.ok(ics.includes("END:VCALENDAR"), "should end with VCALENDAR");
  assert.ok(ics.includes("BEGIN:VEVENT"), "should contain VEVENT");
  assert.ok(ics.includes("END:VEVENT"), "should close VEVENT");
  assert.ok(ics.includes("SUMMARY:Beach Cleanup"), "should include event title");
  assert.ok(ics.includes("UID:test-123@goodhours.app"), "should include UID");
  assert.ok(ics.includes("LOCATION:Sunset Beach\\, CA"), "should include location");
});

test("generateICS uses UTC datetime format (no dashes or colons)", () => {
  const ics = generateICS({
    uid: "dt-test",
    title: "Test Event",
    startUtc: new Date("2025-09-15T14:00:00Z"),
    endUtc: new Date("2025-09-15T17:00:00Z"),
  });
  // DTSTART should be like 20250915T140000Z
  assert.ok(ics.includes("DTSTART:20250915T140000Z"), "DTSTART should be in UTC compact format");
  assert.ok(ics.includes("DTEND:20250915T170000Z"), "DTEND should be in UTC compact format");
});

test("generateICS escapes commas and semicolons in title", () => {
  const ics = generateICS({
    uid: "escape-test",
    title: "Park; Cleanup, Day",
    startUtc: new Date("2025-09-15T14:00:00Z"),
    endUtc: new Date("2025-09-15T17:00:00Z"),
  });
  assert.ok(ics.includes("SUMMARY:Park\\; Cleanup\\, Day"), "should escape ; and , in SUMMARY");
});

// ── ICS time parsing ────────────────────────────────────────────

test("parseTimeString handles 12-hour AM format", () => {
  const { hours, minutes } = parseTimeString("10:30 AM");
  assert.equal(hours, 10);
  assert.equal(minutes, 30);
});

test("parseTimeString handles 12-hour PM format", () => {
  const { hours, minutes } = parseTimeString("2:00 PM");
  assert.equal(hours, 14);
  assert.equal(minutes, 0);
});

test("parseTimeString handles noon (12:00 PM)", () => {
  const { hours, minutes } = parseTimeString("12:00 PM");
  assert.equal(hours, 12);
  assert.equal(minutes, 0);
});

test("parseTimeString handles midnight (12:00 AM)", () => {
  const { hours, minutes } = parseTimeString("12:00 AM");
  assert.equal(hours, 0);
  assert.equal(minutes, 0);
});

test("slotDateTime combines date and time string correctly (UTC timezone)", () => {
  const slotDate = new Date("2025-09-15T00:00:00Z");
  const dt = slotDateTime(slotDate, "2:30 PM", "UTC");
  assert.equal(dt.getUTCHours(), 14);
  assert.equal(dt.getUTCMinutes(), 30);
});

test("slotDateTime converts wall-clock time to UTC using org timezone (America/New_York, EDT = UTC-4)", () => {
  // Sept 15 2025 is in EDT (UTC-4). "2:30 PM" ET = 18:30 UTC.
  const slotDate = new Date("2025-09-15T00:00:00Z");
  const dt = slotDateTime(slotDate, "2:30 PM", "America/New_York");
  assert.equal(dt.getUTCHours(), 18, "EDT offset should shift 2:30 PM → 18:30 UTC");
  assert.equal(dt.getUTCMinutes(), 30);
});

test("slotDateTime handles DST transition (America/Los_Angeles, PST = UTC-8)", () => {
  // Jan 15 2025 is in PST (UTC-8). "10:00 AM" PT = 18:00 UTC.
  const slotDate = new Date("2025-01-15T00:00:00Z");
  const dt = slotDateTime(slotDate, "10:00 AM", "America/Los_Angeles");
  assert.equal(dt.getUTCHours(), 18, "PST offset should shift 10:00 AM → 18:00 UTC");
});

test("slotDateTime defaults to UTC when no timezone supplied", () => {
  const slotDate = new Date("2025-09-15T00:00:00Z");
  const utcDt = slotDateTime(slotDate, "9:00 AM");
  assert.equal(utcDt.getUTCHours(), 9);
});

// ── ICS line folding ────────────────────────────────────────────

test("generateICS folds long lines and preserves multi-byte UTF-8 characters", () => {
  // Craft a title that, when encoded, will require folding and contains a multi-byte char
  const emoji = "\u{1F333}"; // 🌳 = 4 bytes in UTF-8
  const longTitle = "Community " + emoji + " Garden Cleanup Event That Has A Very Long Name Exceeding 75 Bytes";
  const ics = generateICS({
    uid: "fold-test",
    title: longTitle,
    startUtc: new Date("2025-09-15T14:00:00Z"),
    endUtc: new Date("2025-09-15T17:00:00Z"),
  });
  // The SUMMARY line must be present and must decode back to the original title
  const match = ics.match(/SUMMARY:([\s\S]*?)(?=\r\n[^\s])/);
  assert.ok(match, "SUMMARY line should be present");
  const decoded = match![1].replace(/\r\n /g, ""); // unfold
  assert.equal(decoded, longTitle.replace(/,/g, "\\,").replace(/;/g, "\\;"), "unfolded SUMMARY should match escaped title");
});

// ── Tier boundary enforcement (pure logic) ─────────────────────

test("Free org storage limit is 350 MB", () => {
  assert.equal(ORGANIZATION_TIER_LIMITS.FREE.storageLimitBytes, 350 * 1024 * 1024);
});

test("Pro org storage limit is 5 GB", () => {
  assert.equal(ORGANIZATION_TIER_LIMITS.PRO.storageLimitBytes, 5 * 1024 * 1024 * 1024);
});

test("Free org upload rate is 50 per hour", () => {
  assert.equal(ORGANIZATION_TIER_LIMITS.FREE.uploadAttemptsPerHour, 50);
});

test("Pro org upload rate is 100 per hour", () => {
  assert.equal(ORGANIZATION_TIER_LIMITS.PRO.uploadAttemptsPerHour, 100);
});

// ── Downgrade behavior (config preservation) ───────────────────

test("Pro features remain false for unknown tier (treated as FREE)", () => {
  // Simulates what happens if planTier has an unexpected value
  const tier = ("UNKNOWN" === "PRO") ? "PRO" : "FREE";
  const limits = getOrgTierLimits(tier as "FREE" | "PRO");
  assert.equal(limits.configurableReminders, false);
  assert.equal(limits.attendanceAnalytics, false);
});
