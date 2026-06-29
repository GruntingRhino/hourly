import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

// ── Required string fields ──────────────────────────────────────────────────

const requiredStringSchema = z.string().min(1);

test("empty string fails required string validation", () => {
  const result = requiredStringSchema.safeParse("");
  assert.equal(result.success, false);
});

test("non-empty string passes required string validation", () => {
  const result = requiredStringSchema.safeParse("hello");
  assert.equal(result.success, true);
});

// ── Whitespace-only strings ─────────────────────────────────────────────────

const trimmedStringSchema = z.string().trim().min(1);

test("whitespace-only string fails after trim().min(1)", () => {
  const result = trimmedStringSchema.safeParse("   ");
  assert.equal(result.success, false);
});

test("string with content after trimming passes", () => {
  const result = trimmedStringSchema.safeParse("  valid  ");
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data, "valid");
  }
});

test("tab-only string fails after trim().min(1)", () => {
  const result = trimmedStringSchema.safeParse("\t\t");
  assert.equal(result.success, false);
});

// ── Max length enforcement ──────────────────────────────────────────────────

const maxLengthSchema = z.string().max(255);

test("string of 255 chars passes max length check", () => {
  const result = maxLengthSchema.safeParse("a".repeat(255));
  assert.equal(result.success, true);
});

test("string of 256 chars fails max length check when limit is 255", () => {
  const result = maxLengthSchema.safeParse("a".repeat(256));
  assert.equal(result.success, false);
});

test("string of 10,000 chars fails max length check when limit is 255", () => {
  const result = maxLengthSchema.safeParse("a".repeat(10_000));
  assert.equal(result.success, false);
});

// ── Negative number validation ──────────────────────────────────────────────

const nonNegativeSchema = z.number().min(0);

test("negative number fails .min(0) constraint", () => {
  const result = nonNegativeSchema.safeParse(-1);
  assert.equal(result.success, false);
});

test("zero passes .min(0) constraint", () => {
  const result = nonNegativeSchema.safeParse(0);
  assert.equal(result.success, true);
});

test("positive number passes .min(0) constraint", () => {
  const result = nonNegativeSchema.safeParse(5);
  assert.equal(result.success, true);
});

// ── Email format validation ─────────────────────────────────────────────────

const emailSchema = z.string().email();

test("valid email passes .email() validation", () => {
  const result = emailSchema.safeParse("user@example.com");
  assert.equal(result.success, true);
});

test("missing @ sign fails .email() validation", () => {
  const result = emailSchema.safeParse("notanemail");
  assert.equal(result.success, false);
});

test("missing domain fails .email() validation", () => {
  const result = emailSchema.safeParse("user@");
  assert.equal(result.success, false);
});

test("missing local part fails .email() validation", () => {
  const result = emailSchema.safeParse("@example.com");
  assert.equal(result.success, false);
});

test("email with spaces fails .email() validation", () => {
  const result = emailSchema.safeParse("user @example.com");
  assert.equal(result.success, false);
});

// ── Date validation: future vs past ────────────────────────────────────────

// Simulates a schema requiring a date to be in the future
const futureDateSchema = z.string().refine((val) => {
  const d = new Date(val);
  return !isNaN(d.getTime()) && d > new Date();
}, { message: "Date must be in the future" });

// Simulates a schema requiring a date to be in the past
const pastDateSchema = z.string().refine((val) => {
  const d = new Date(val);
  return !isNaN(d.getTime()) && d < new Date();
}, { message: "Date must be in the past" });

test("a past date fails future-date validation", () => {
  const result = futureDateSchema.safeParse("2000-01-01");
  assert.equal(result.success, false);
});

test("a future date passes future-date validation", () => {
  const result = futureDateSchema.safeParse("2099-12-31");
  assert.equal(result.success, true);
});

test("a future date fails past-date validation", () => {
  const result = pastDateSchema.safeParse("2099-12-31");
  assert.equal(result.success, false);
});

test("a past date passes past-date validation", () => {
  const result = pastDateSchema.safeParse("2000-01-01");
  assert.equal(result.success, true);
});

// ── HTML / Script injection ─────────────────────────────────────────────────
// NOTE: Zod is a validation library, not an HTML sanitizer. It does NOT strip
// or reject HTML tags by default. The application is responsible for escaping
// output before rendering. These tests document and confirm that behavior.

const descriptionSchema = z.string().trim().min(1).max(1000);

test("HTML injection string is accepted by Zod schema (Zod does not sanitize HTML)", () => {
  const malicious = '<script>alert("xss")</script>';
  const result = descriptionSchema.safeParse(malicious);
  // Zod accepts it — sanitization must happen at the rendering layer
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data, malicious);
  }
});

test("SQL-injection-style string is accepted by Zod schema (Zod does not sanitize SQL)", () => {
  const sqlInject = "'; DROP TABLE users; --";
  const result = descriptionSchema.safeParse(sqlInject);
  // Zod accepts it — parameterized queries (Prisma) handle SQL safety
  assert.equal(result.success, true);
});

test("unicode and emoji characters are accepted by Zod string schema", () => {
  const result = descriptionSchema.safeParse("Hello 🌍 こんにちは");
  assert.equal(result.success, true);
});
