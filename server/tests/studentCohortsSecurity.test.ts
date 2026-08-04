import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ensureStudentCohortMembership } from "../src/lib/studentCohorts";

test("cross-school cohort membership is rejected before any mutation", async () => {
  let upsertCount = 0;
  let userUpdateCount = 0;
  const db = {
    user: {
      findUnique: async () => ({
        id: "student-b",
        role: "STUDENT",
        schoolId: "school-b",
        cohortId: null,
      }),
      update: async () => {
        userUpdateCount += 1;
        throw new Error("user update must not run");
      },
    },
    cohort: {
      findUnique: async () => ({ id: "cohort-a", schoolId: "school-a" }),
    },
    studentCohortMembership: {
      findMany: async () => [],
      upsert: async () => {
        upsertCount += 1;
        throw new Error("membership upsert must not run");
      },
      updateMany: async () => ({ count: 0 }),
    },
  };

  await assert.rejects(
    ensureStudentCohortMembership({
      studentId: "student-b",
      cohortId: "cohort-a",
      schoolId: "school-a",
      source: "CANVAS",
      db: db as never,
    }),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 403);
      assert.equal((error as { code?: string }).code, "TENANT_BOUNDARY_VIOLATION");
      return true;
    },
  );
  assert.equal(upsertCount, 0);
  assert.equal(userUpdateCount, 0);
});

test("student invitation acceptance cannot silently transfer an existing student across schools", async () => {
  const invitations = await readFile(new URL("../src/routes/invitations.ts", import.meta.url), "utf8");
  const studentBranch = invitations.indexOf('if (existing.role === "STUDENT")');
  const crossSchoolGuard = invitations.indexOf("existing.schoolId && existing.schoolId !== inv.cohort.schoolId", studentBranch);
  const firstMutation = invitations.indexOf("await prisma.user.update", studentBranch);

  assert.ok(studentBranch >= 0);
  assert.ok(crossSchoolGuard > studentBranch, "cross-school guard must exist inside the existing-student branch");
  assert.ok(crossSchoolGuard < firstMutation, "cross-school guard must run before changing the user");
  assert.match(invitations, /authorized school transfer is required/i);
});
