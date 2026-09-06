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

test("student invitation acceptance claims and mutates inside one transaction with a cross-school guard", async () => {
  const invitations = await readFile(new URL("../src/routes/invitations.ts", import.meta.url), "utf8");
  const studentRoute = invitations.indexOf('router.post("/student/accept"');
  const transaction = invitations.indexOf("runSerializableTransaction", studentRoute);
  const crossSchoolGuard = invitations.indexOf("existing?.schoolId && existing.schoolId !== inv.cohort.schoolId", transaction);
  const claim = invitations.indexOf("tx.studentInvitation.updateMany", transaction);
  const membership = invitations.indexOf("db: tx", transaction);

  assert.ok(studentRoute >= 0);
  assert.ok(transaction > studentRoute, "student acceptance must use a transaction");
  assert.ok(crossSchoolGuard > transaction, "cross-school guard must run inside the transaction");
  assert.ok(claim > crossSchoolGuard, "invitation must be conditionally claimed after validation");
  assert.ok(membership > claim, "membership mutation must use the transaction client");
  assert.match(invitations, /authorized school transfer is required/i);
});
