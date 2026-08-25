import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../src/lib/prisma";
import { calculateStudentHours } from "../src/lib/hoursCalculator";

const prismaClient = prisma as any;

test("hour aggregation excludes records owned by another school", async () => {
  const original = {
    beneficiary: prismaClient.beneficiarySignup.findMany,
    selfSubmitted: prismaClient.selfSubmittedRequest.findMany,
    session: prismaClient.serviceSession.findMany,
  };
  const observedSchools: Array<string | undefined> = [];

  prismaClient.beneficiarySignup.findMany = async ({ where }: any) => {
    observedSchools.push(where.schoolId);
    return where.schoolId === "school-a"
      ? [{ studentId: "student-1", totalHours: 1, verificationStatus: "APPROVED", status: "CONFIRMED", slot: null }]
      : [
          { studentId: "student-1", totalHours: 1, verificationStatus: "APPROVED", status: "CONFIRMED", slot: null },
          { studentId: "student-1", totalHours: 9, verificationStatus: "APPROVED", status: "CONFIRMED", slot: null },
        ];
  };
  prismaClient.selfSubmittedRequest.findMany = async ({ where }: any) => {
    observedSchools.push(where.schoolId);
    return where.schoolId === "school-a"
      ? [{ studentId: "student-1", hours: 2, status: "APPROVED" }]
      : [
          { studentId: "student-1", hours: 2, status: "APPROVED" },
          { studentId: "student-1", hours: 9, status: "APPROVED" },
        ];
  };
  prismaClient.serviceSession.findMany = async ({ where }: any) => {
    observedSchools.push(where.schoolId);
    return where.schoolId === "school-a"
      ? [{ userId: "student-1", totalHours: 3, verificationStatus: "APPROVED" }]
      : [
          { userId: "student-1", totalHours: 3, verificationStatus: "APPROVED" },
          { userId: "student-1", totalHours: 9, verificationStatus: "APPROVED" },
        ];
  };

  try {
    const result = await (calculateStudentHours as any)(["student-1"], "school-a");
    assert.deepEqual(result.get("student-1"), { approved: 6, pending: 0 });
    assert.deepEqual(observedSchools, ["school-a", "school-a", "school-a"]);
    assert.equal(result.dataState, "COMPLETE");
    assert.deepEqual(result.failedSources, []);
  } finally {
    prismaClient.beneficiarySignup.findMany = original.beneficiary;
    prismaClient.selfSubmittedRequest.findMany = original.selfSubmitted;
    prismaClient.serviceSession.findMany = original.session;
  }
});
