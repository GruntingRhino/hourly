import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const beneficiariesRoute = fs.readFileSync(path.join(process.cwd(), "src/routes/beneficiaries.ts"), "utf8");
const organizationsRoute = fs.readFileSync(path.join(process.cwd(), "src/routes/organizations.ts"), "utf8");

test("student status queries are forced to APPROVED and use an explicit safe projection", () => {
  const start = beneficiariesRoute.indexOf('// GET /api/beneficiaries — list beneficiaries');
  const end = beneficiariesRoute.indexOf('// GET /api/beneficiaries/directory/nearby', start);
  const route = beneficiariesRoute.slice(start, end);
  const selectStart = beneficiariesRoute.indexOf("const studentBeneficiaryListSelect = {");
  const selectEnd = beneficiariesRoute.indexOf("} as const;", selectStart) + "} as const;".length;
  const select = beneficiariesRoute.slice(selectStart, selectEnd);
  assert.match(route, /const isStudent = user\.role === "STUDENT"/);
  assert.match(route, /status: isStudent \? "APPROVED" :/);
  assert.match(route, /beneficiary: \{ select: approvalBeneficiarySelect \}/);
  assert.doesNotMatch(route, /beneficiary:\s*true/);
  assert.match(route, /\.\.\.\(isStudent \? \{\} : \{/);
  for (const field of [
    "approvalId", "latestInvitationStatus", "latestInvitationSentTo", "latestInvitationCreatedAt", "email", "phone", "address",
    "stripeCustomerId", "stripeSubscriptionId", "stripePriceId", "subscriptionStatus", "planTier",
    "uploadAbuseStrikes", "uploadSuspendedUntil",
  ]) {
    assert.doesNotMatch(select, new RegExp(`\\b${field}\\s*:`));
  }
});

test("school-admin invitation metadata is limited to status and createdAt", () => {
  const start = beneficiariesRoute.indexOf('// GET /api/beneficiaries — list beneficiaries');
  const end = beneficiariesRoute.indexOf('// GET /api/beneficiaries/directory/nearby', start);
  const route = beneficiariesRoute.slice(start, end);
  assert.match(route, /select: \{ beneficiaryId: true, status: true, createdAt: true \}/);
  assert.doesNotMatch(route, /sentTo:\s*true/);
  assert.match(route, /latestInvitations = !isStudent/);
});

test("organization directory uses public-safe projections", () => {
  const listStart = organizationsRoute.indexOf('// GET /api/organizations — list all');
  const updateStart = organizationsRoute.indexOf('// PUT /api/organizations/:id', listStart);
  const routes = organizationsRoute.slice(listStart, updateStart);
  assert.match(routes, /select: organizationPublicSelect/);
  assert.doesNotMatch(routes, /include:\s*\{/);
});
