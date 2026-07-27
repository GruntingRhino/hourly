import test from "node:test";
import assert from "node:assert/strict";
import { redactEmailLogContext } from "../src/services/email";

test("production email log context omits recipient, subject, body, and tokens", () => {
  const context = redactEmailLogContext({
    recipient: "student@example.edu",
    subject: "Private event: Algebra tutoring",
    environment: "production",
  });
  const serialized = JSON.stringify(context);
  assert.equal(serialized.includes("student@example.edu"), false);
  assert.equal(serialized.includes("Algebra tutoring"), false);
  assert.match(String(context.recipientHash), /^[a-f0-9]{16}$/);
  assert.equal(context.deliveryEnvironment, "production");
});

test("development email log context preserves useful recipient details", () => {
  const context = redactEmailLogContext({
    recipient: "student@example.edu",
    subject: "Test subject",
    environment: "development",
  });
  assert.equal(context.recipient, "student@example.edu");
  assert.equal(context.subject, "Test subject");
});
