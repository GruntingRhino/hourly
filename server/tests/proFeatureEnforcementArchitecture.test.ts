import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const serverRoot = path.resolve(__dirname, "..");
const beneficiariesRoute = fs.readFileSync(path.join(serverRoot, "src/routes/beneficiaries.ts"), "utf8");
const invitationsRoute = fs.readFileSync(path.join(serverRoot, "src/routes/invitations.ts"), "utf8");
const reminderWorker = fs.readFileSync(path.join(serverRoot, "src/lib/eventReminders.ts"), "utf8");
const listingPolicy = fs.readFileSync(path.join(serverRoot, "src/lib/opportunityListingPolicy.ts"), "utf8");

test("analytics, branding, reminders, waitlist controls, and multi-admin writes have server-side feature checks", () => {
  for (const feature of [
    "attendanceAnalytics",
    "customEmailBranding",
    "configurableReminders",
    "automatedFormReminders",
    "advancedReminderContent",
    "advancedWaitlistControls",
    "multiAdminManagement",
  ]) {
    assert.match(beneficiariesRoute, new RegExp(`requireOrgFeature\\([^)]*\\"${feature}\\"`), `${feature} lacks a route-level gate`);
  }
});

test("new-account admin invitation acceptance re-checks Pro entitlement", () => {
  const route = invitationsRoute.slice(invitationsRoute.indexOf('router.post("/beneficiary-admin/accept"'));
  assert.match(route, /requireOrgFeature\(invitation\.beneficiaryId, "multiAdminManagement"\)/);
});

test("upload storage and rate limits are selected from effective server-side tier", () => {
  assert.match(beneficiariesRoute, /resolveBeneficiaryPlanTier\(benRecord/);
  assert.match(beneficiariesRoute, /limits\.upload(sPerHour|AttemptsPerHour)/);
  assert.match(beneficiariesRoute, /limits\.storageBytes/);
  assert.match(beneficiariesRoute, /SELECT 1 FROM "Beneficiary" WHERE id = \$\{req\.params\.id\} FOR UPDATE/);
  assert.match(beneficiariesRoute, /runSerializableTransaction\(async \(tx\) => \{[\s\S]*authoritativeRecentUploads[\s\S]*authoritativeUsage/);
});

test("cross-tenant upload authorization runs before multer and abuse strikes", () => {
  const routeStart = beneficiariesRoute.indexOf('router.post(\n  "/:id/opportunities/:oppId/attachments"');
  const nextRoute = beneficiariesRoute.indexOf('router.delete("/:id/opportunities/:oppId/attachments', routeStart);
  const uploadRoute = beneficiariesRoute.slice(routeStart, nextRoute);
  const authorization = uploadRoute.indexOf("canManageBeneficiary(req.user!.userId, req.params.id)");
  const multer = uploadRoute.indexOf('attachmentUpload.array("files"');
  const abuseStrike = uploadRoute.indexOf("recordAbuseStrike(benId)");

  assert.ok(routeStart >= 0 && nextRoute > routeStart, "attachment upload route was not found");
  assert.ok(authorization >= 0, "attachment upload route lacks beneficiary authorization");
  assert.ok(authorization < multer, "beneficiary authorization must run before multer writes files");
  assert.ok(authorization < abuseStrike, "beneficiary authorization must run before abuse strikes can affect an organization");
});

test("required-form follow-ups, advanced content, and branding are filtered by the reminder worker", () => {
  assert.match(reminderWorker, /tierLimits\.automatedFormReminders/);
  assert.match(reminderWorker, /tierLimits\.advancedReminderContent/);
  assert.match(reminderWorker, /tierLimits\.customEmailBranding/);
});

test("featured placement uses server-derived effective tier as a small tie-break", () => {
  assert.match(listingPolicy, /resolveBeneficiaryPlanTier/);
  assert.match(listingPolicy, /dateDifference/);
  assert.match(listingPolicy, /timeDifference/);
  assert.match(listingPolicy, /hasPriorityListing/);
});

test("advanced waitlist controls affect automatic promotion and manual approval is Pro-gated", () => {
  assert.match(beneficiariesRoute, /shouldAutoPromoteWaitlist/);
  assert.match(beneficiariesRoute, /promoMessageTemplate/);
  assert.match(beneficiariesRoute, /\/:id\/signups\/:signupId\/promote/);
  assert.match(beneficiariesRoute, /manual_pro_approval/);
});
