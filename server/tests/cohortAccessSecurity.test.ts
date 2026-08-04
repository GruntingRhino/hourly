import assert from "node:assert/strict";
import test from "node:test";
import { buildCohortScopedStudentWhere, type StaffAccessScope } from "../src/lib/cohortAccess";

const adminScope: StaffAccessScope = {
  userId: "admin-a",
  role: "SCHOOL_ADMIN",
  schoolId: "school-a",
  assignedCohortIds: [],
  isSchoolAdmin: true,
};

const teacherScope: StaffAccessScope = {
  userId: "teacher-a",
  role: "TEACHER",
  schoolId: "school-a",
  assignedCohortIds: ["cohort-a"],
  isSchoolAdmin: false,
};

test("school staff student scopes require the canonical student school", () => {
  assert.deepEqual(buildCohortScopedStudentWhere(adminScope), {
    schoolId: "school-a",
  });

  assert.deepEqual(buildCohortScopedStudentWhere(teacherScope), {
    schoolId: "school-a",
    OR: [
      { cohortId: { in: ["cohort-a"] } },
      { cohortMemberships: { some: { isActive: true, cohortId: { in: ["cohort-a"] } } } },
    ],
  });
});
