import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { calculateStudentHours } from "../src/lib/hoursCalculator";
import { buildStudentProgressRecords } from "../src/lib/studentProgress";

const prismaClient = prisma as any;

test("calculateStudentHours reports PARTIAL and names the failed source instead of silently zeroing it", async () => {
  const original = {
    beneficiary: prismaClient.beneficiarySignup.findMany,
    selfSubmitted: prismaClient.selfSubmittedRequest.findMany,
    session: prismaClient.serviceSession.findMany,
  };
  prismaClient.beneficiarySignup.findMany = async () => {
    throw new Error("simulated outage");
  };
  prismaClient.selfSubmittedRequest.findMany = async () => [{ studentId: "student-1", hours: 2, status: "APPROVED" }];
  prismaClient.serviceSession.findMany = async () => [];

  try {
    const result = await calculateStudentHours(["student-1"], "school-a");
    assert.equal(result.dataState, "PARTIAL");
    assert.deepEqual(result.failedSources, ["beneficiarySignup"]);
    // The surviving sources still count — this isn't "fail the whole batch",
    // just "don't pretend the failed source's contribution was zero."
    assert.deepEqual(result.get("student-1"), { approved: 2, pending: 0 });
  } finally {
    prismaClient.beneficiarySignup.findMany = original.beneficiary;
    prismaClient.selfSubmittedRequest.findMany = original.selfSubmitted;
    prismaClient.serviceSession.findMany = original.session;
  }
});

test("calculateStudentHours reports COMPLETE when every source succeeds", async () => {
  const original = {
    beneficiary: prismaClient.beneficiarySignup.findMany,
    selfSubmitted: prismaClient.selfSubmittedRequest.findMany,
    session: prismaClient.serviceSession.findMany,
  };
  prismaClient.beneficiarySignup.findMany = async () => [];
  prismaClient.selfSubmittedRequest.findMany = async () => [];
  prismaClient.serviceSession.findMany = async () => [];

  try {
    const result = await calculateStudentHours(["student-1"], "school-a");
    assert.equal(result.dataState, "COMPLETE");
    assert.deepEqual(result.failedSources, []);
  } finally {
    prismaClient.beneficiarySignup.findMany = original.beneficiary;
    prismaClient.selfSubmittedRequest.findMany = original.selfSubmitted;
    prismaClient.serviceSession.findMany = original.session;
  }
});

test("buildStudentProgressRecords propagates PARTIAL when the no-show lookup fails, without wiping hours to zero", async () => {
  const original = {
    beneficiary: prismaClient.beneficiarySignup.findMany,
    selfSubmitted: prismaClient.selfSubmittedRequest.findMany,
    session: prismaClient.serviceSession.findMany,
  };
  let noShowCallCount = 0;
  prismaClient.beneficiarySignup.findMany = async ({ where }: any) => {
    // First call (inside calculateStudentHours) succeeds; second call (the
    // no-show lookup in buildStudentProgressRecords) fails.
    if (where?.status === "NO_SHOW") {
      noShowCallCount += 1;
      throw new Error("simulated no-show lookup outage");
    }
    return [{ studentId: "student-1", totalHours: 5, verificationStatus: "APPROVED", status: "CONFIRMED", slot: null }];
  };
  prismaClient.selfSubmittedRequest.findMany = async () => [];
  prismaClient.serviceSession.findMany = async () => [];

  try {
    const records = await buildStudentProgressRecords(
      [{
        id: "student-1", name: "Alice", email: "alice@example.test", grade: "10", cohortId: null, cohort: null,
        cohortMemberships: [],
      }],
      { schoolId: "school-a", requiredHours: 20, serviceStartDate: null, serviceEndDate: null },
    );
    assert.equal(noShowCallCount, 1);
    assert.equal(records.dataState, "PARTIAL");
    assert.deepEqual(records.failedSources, ["noShowLookup"]);
    // The hours source that DID succeed must still be reflected — a failure
    // in an unrelated source (no-show lookup) must not zero out real hours.
    assert.equal(records[0].approvedHours, 5);
  } finally {
    prismaClient.beneficiarySignup.findMany = original.beneficiary;
    prismaClient.selfSubmittedRequest.findMany = original.selfSubmitted;
    prismaClient.serviceSession.findMany = original.session;
  }
});
