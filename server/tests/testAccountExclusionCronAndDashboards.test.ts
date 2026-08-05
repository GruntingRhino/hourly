import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../src/lib/prisma";
import { runReminderCycle } from "../src/lib/reminders";
import { buildLaunchWorkspace } from "../src/lib/launchCenter";

// Regression coverage for two more bespoke `role: "STUDENT"` query sites
// found outside routes/*.ts (missed by the earlier route-focused sweep):
//
// - lib/reminders.ts's background cron (runReminderCycle /
//   runSchoolReminderCycle) actually SENDS EMAILS to at-risk/deadline
//   students and counts pending items for school-admin alert emails — a
//   side-effecting job, not just a display list, so QA/Playwright fixture
//   students being included here is worse than the read-only list bugs
//   fixed earlier (real emails sent to test accounts, inflated admin alert
//   counts).
// - lib/launchCenter.ts's buildLaunchWorkspace (school onboarding/launch
//   readiness dashboard) counts students the same bespoke way.

const prismaClient = prisma as any;

function captureUserFindMany(): { calls: Array<Record<string, unknown>>; restore: () => void } {
  const original = prismaClient.user.findMany;
  const calls: Array<Record<string, unknown>> = [];
  prismaClient.user.findMany = async ({ where }: any) => {
    calls.push(where);
    return [];
  };
  return { calls, restore: () => { prismaClient.user.findMany = original; } };
}

test("runReminderCycle excludes test accounts from both the deadline/at-risk roster and the pending-review count", async () => {
  const school = {
    id: "reminder-school-1",
    name: "Reminder School",
    requiredHours: 40,
    serviceStartDate: null,
    serviceEndDate: null,
    staff: [],
  };
  const original = {
    schoolFindMany: prismaClient.school.findMany,
    schoolFindUnique: prismaClient.school.findUnique,
    selfSubmittedRequestCount: prismaClient.selfSubmittedRequest.count,
    serviceSessionCount: prismaClient.serviceSession.count,
    beneficiarySignupCount: prismaClient.beneficiarySignup.count,
  };
  prismaClient.school.findMany = async () => [{ id: school.id }];
  prismaClient.school.findUnique = async () => school;
  prismaClient.selfSubmittedRequest.count = async () => 0;
  prismaClient.serviceSession.count = async () => 0;
  prismaClient.beneficiarySignup.count = async () => 0;
  const { calls, restore } = captureUserFindMany();

  try {
    const summaries = await runReminderCycle(school.id);
    assert.equal(summaries.length, 1);
    // One call for the deadline/at-risk roster, one for the pending-review
    // count's student-id lookup — both must exclude test accounts.
    assert.ok(calls.length >= 2);
    assert.ok(calls.every((where) => where.isTestAccount === false));
  } finally {
    restore();
    prismaClient.school.findMany = original.schoolFindMany;
    prismaClient.school.findUnique = original.schoolFindUnique;
    prismaClient.selfSubmittedRequest.count = original.selfSubmittedRequestCount;
    prismaClient.serviceSession.count = original.serviceSessionCount;
    prismaClient.beneficiarySignup.count = original.beneficiarySignupCount;
  }
});

test("buildLaunchWorkspace excludes test accounts from the onboarding student count", async () => {
  const school = {
    id: "launch-school-1",
    name: "Launch School",
    createdAt: new Date(),
    requiredHours: 40,
    serviceStartDate: null,
    serviceEndDate: null,
    latitude: null,
    longitude: null,
    launchOnboardingConfig: null,
    launchSupportConfig: null,
    launchRollbackConfig: null,
    launchMonitoringConfig: null,
    staff: [],
  };
  const original = {
    schoolFindUnique: prismaClient.school.findUnique,
    schoolBeneficiaryApprovalCount: prismaClient.schoolBeneficiaryApproval.count,
    cohortCount: prismaClient.cohort.count,
    studentInvitationCount: prismaClient.studentInvitation.count,
    selfSubmittedRequestCount: prismaClient.selfSubmittedRequest.count,
    serviceSessionCount: prismaClient.serviceSession.count,
    schoolLaunchBugFindMany: prismaClient.schoolLaunchBug.findMany,
  };
  prismaClient.school.findUnique = async () => school;
  prismaClient.schoolBeneficiaryApproval.count = async () => 0;
  prismaClient.cohort.count = async () => 0;
  prismaClient.studentInvitation.count = async () => 0;
  prismaClient.selfSubmittedRequest.count = async () => 0;
  prismaClient.serviceSession.count = async () => 0;
  prismaClient.schoolLaunchBug.findMany = async () => [];
  const { calls, restore } = captureUserFindMany();

  try {
    const workspace = await buildLaunchWorkspace(school.id);
    assert.ok(workspace);
    assert.ok(calls.length >= 1);
    assert.ok(calls.every((where) => where.isTestAccount === false));
  } finally {
    restore();
    prismaClient.school.findUnique = original.schoolFindUnique;
    prismaClient.schoolBeneficiaryApproval.count = original.schoolBeneficiaryApprovalCount;
    prismaClient.cohort.count = original.cohortCount;
    prismaClient.studentInvitation.count = original.studentInvitationCount;
    prismaClient.selfSubmittedRequest.count = original.selfSubmittedRequestCount;
    prismaClient.serviceSession.count = original.serviceSessionCount;
    prismaClient.schoolLaunchBug.findMany = original.schoolLaunchBugFindMany;
  }
});
