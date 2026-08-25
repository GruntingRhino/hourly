import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("intervention and bulk-message routes use the central staff cohort policy", async () => {
  const source = await readFile(new URL("../src/routes/messages.ts", import.meta.url), "utf8");
  assert.match(source, /getStaffAccessScope/);
  assert.ok(
    (source.match(/buildCohortScopedStudentWhere\(scope\)/g) ?? []).length >= 4,
    "case listing, history, and bulk recipient paths must all use central student scope",
  );
  assert.ok(
    (source.match(/assertStudentAccessibleToStaff\(scope,/g) ?? []).length >= 2,
    "student-specific intervention read and mutation paths must check central scope",
  );
  assert.match(source, /canAccessCohort\(scope, body\.cohortId\)/);
});
