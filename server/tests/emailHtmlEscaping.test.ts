import test from "node:test";
import assert from "node:assert/strict";

// Force the local Mailinator capture path (preserves the full, un-stripped
// HTML) instead of the log-only dev path, which strips all tags before
// logging and would make a naive "check the console output" test pass
// regardless of whether escaping actually happened.
process.env.NODE_ENV = process.env.NODE_ENV === "production" ? "test" : process.env.NODE_ENV;
delete process.env.VERCEL_ENV;

import {
  sendHourApprovedEmail,
  sendStudentInvitationEmail,
  sendEventReminderEmail,
  getCapturedMailinatorInbox,
} from "../src/services/email";

let inboxCounter = 0;
function freshMailinatorAddress(): { address: string; inbox: string } {
  inboxCounter += 1;
  const inbox = `gh-email-escaping-test-${inboxCounter}`;
  return { address: `${inbox}@mailinator.com`, inbox };
}

async function latestCapturedHtml(inbox: string): Promise<string> {
  const messages = getCapturedMailinatorInbox(inbox);
  assert.ok(messages.length > 0, `expected a captured message for ${inbox}`);
  return messages[0].html;
}

test("sendHourApprovedEmail escapes an org name containing HTML", async () => {
  const { address, inbox } = freshMailinatorAddress();
  await sendHourApprovedEmail(address, '<img src=x onerror=alert(1)>Evil Org', 3, "Beach Cleanup");
  const html = await latestCapturedHtml(inbox);
  assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;Evil Org/);
});

test("sendStudentInvitationEmail escapes a school name used as both title and body text", async () => {
  const { address, inbox } = freshMailinatorAddress();
  await sendStudentInvitationEmail(
    address,
    'Bob"><script>alert(1)</script>',
    "Cohort A",
    '</strong><script>alert("school")</script><strong>',
    "https://goodhours.app/join?token=abc",
  );
  const html = await latestCapturedHtml(inbox);
  assert.doesNotMatch(html, /<script>/);
});

test("sendEventReminderEmail sanitizes brandColor, rejects a javascript: logo URL, and escapes text fields", async () => {
  const { address, inbox } = freshMailinatorAddress();
  await sendEventReminderEmail({
    to: address,
    eventName: '<script>alert("event")</script>',
    eventDate: "Saturday",
    startTime: "9am",
    endTime: "11am",
    location: 'Park"><b>injected</b>',
    customMessage: "Line one\nLine two <script>bad()</script>",
    emailSignature: "— The Team <script>x</script>",
    brandColor: 'red" onmouseover="alert(1)',
    orgLogoUrl: "javascript:alert(1)",
    orgName: "Evil</span><script>alert(2)</script>",
  });
  const html = await latestCapturedHtml(inbox);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /onmouseover=/);
  // The malicious brandColor must never appear verbatim in a style attribute —
  // it should have fallen back to the default accent color instead.
  assert.doesNotMatch(html, /style="color:red" onmouseover/);
  // A javascript: URL must never be used as an <img src>.
  assert.doesNotMatch(html, /src="javascript:/);
  // Falls back to the default brand color rather than dropping color entirely.
  assert.match(html, /#2563eb/);
});

test("sendEventReminderEmail accepts a valid hex brandColor and https logo URL unchanged", async () => {
  const { address, inbox } = freshMailinatorAddress();
  await sendEventReminderEmail({
    to: address,
    eventName: "Beach Cleanup",
    eventDate: "Saturday",
    startTime: "9am",
    endTime: "11am",
    location: "Beach",
    brandColor: "#123abc",
    orgLogoUrl: "https://example.test/logo.png",
    orgName: "Good Org",
  });
  const html = await latestCapturedHtml(inbox);
  assert.match(html, /#123abc/);
  assert.match(html, /src="https:\/\/example\.test\/logo\.png"/);
});
