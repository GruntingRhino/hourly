import test from "node:test";
import assert from "node:assert/strict";

// Replicates the calculation from sessions.ts checkout handler:
// totalHours = Math.round(((checkOutTime - checkInTime) / (1000 * 60 * 60)) * 100) / 100
function calcHours(checkInMs: number, checkOutMs: number): number {
  return Math.round(((checkOutMs - checkInMs) / (1000 * 60 * 60)) * 100) / 100;
}

test("2 hour session calculates exactly 2.00 hours", () => {
  const checkIn = 0;
  const checkOut = 2 * 60 * 60 * 1000; // 2 hours in ms
  assert.equal(calcHours(checkIn, checkOut), 2);
});

test("1 hour 30 minute session calculates 1.5 hours", () => {
  const checkIn = 0;
  const checkOut = 1.5 * 60 * 60 * 1000;
  assert.equal(calcHours(checkIn, checkOut), 1.5);
});

test("5 minute session calculates to 0.08 hours (rounded to 2dp)", () => {
  const checkIn = 0;
  const checkOut = 5 * 60 * 1000; // 5 minutes in ms
  // 5 / 60 = 0.08333... → rounded to 2dp = 0.08
  assert.equal(calcHours(checkIn, checkOut), 0.08);
});

test("same check-in and check-out time calculates 0 hours", () => {
  const now = Date.now();
  assert.equal(calcHours(now, now), 0);
});

test("8 hour session calculates exactly 8 hours", () => {
  const checkIn = 0;
  const checkOut = 8 * 60 * 60 * 1000;
  assert.equal(calcHours(checkIn, checkOut), 8);
});

test("24 hour session calculates exactly 24 hours", () => {
  const checkIn = 0;
  const checkOut = 24 * 60 * 60 * 1000;
  assert.equal(calcHours(checkIn, checkOut), 24);
});

test("calculated hours are always >= 0 for valid check-in/check-out pair", () => {
  const checkIn = Date.now();
  const checkOut = checkIn + 3 * 60 * 60 * 1000; // 3 hours later
  assert.ok(calcHours(checkIn, checkOut) >= 0);
});

test("1 hour 45 minute session calculates 1.75 hours", () => {
  const checkIn = 0;
  const checkOut = (1 * 60 + 45) * 60 * 1000;
  assert.equal(calcHours(checkIn, checkOut), 1.75);
});

test("real wall-clock timestamps produce correct duration", () => {
  const checkIn = new Date("2025-06-01T09:00:00.000Z").getTime();
  const checkOut = new Date("2025-06-01T11:30:00.000Z").getTime();
  assert.equal(calcHours(checkIn, checkOut), 2.5);
});
