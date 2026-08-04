import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("hour-bearing records carry and enforce an owning school", async () => {
  const [schema, signups, beneficiaries, calculator, progress, messages, classrooms, reminders] = await Promise.all([
    source("../prisma/schema.prisma"),
    source("../src/routes/signups.ts"),
    source("../src/routes/beneficiaries.ts"),
    source("../src/lib/hoursCalculator.ts"),
    source("../src/lib/studentProgress.ts"),
    source("../src/routes/messages.ts"),
    source("../src/routes/classrooms.ts"),
    source("../src/lib/reminders.ts"),
  ]);

  const serviceSession = schema.slice(schema.indexOf("model ServiceSession"), schema.indexOf("model AuditLog"));
  const beneficiarySignup = schema.slice(schema.indexOf("model BeneficiarySignup"), schema.indexOf("model BeneficiaryAuditLog"));
  assert.match(serviceSession, /schoolId\s+String\?/);
  assert.match(beneficiarySignup, /schoolId\s+String\?/);
  assert.match(signups, /select:\s*\{\s*schoolId:\s*true\s*\}/);
  assert.match(signups, /serviceSession\.create\([\s\S]*?schoolId,/);
  assert.match(beneficiaries, /schoolId:\s*studentSchoolId/);
  assert.ok(
    (calculator.match(/^\s+schoolId,$/gm) ?? []).length >= 3,
    "all three hour sources must be filtered by owning school",
  );
  assert.match(progress, /calculateStudentHours\(studentIds, schoolDefaults\.schoolId\)/);

  const caseList = messages.slice(
    messages.indexOf('router.get("/interventions/cases"'),
    messages.indexOf('router.put("/interventions/cases/:studentId"'),
  );
  const campaignHistory = messages.slice(
    messages.indexOf('router.get("/interventions/history"'),
    messages.indexOf('// POST /api/messages/bulk'),
  );
  assert.match(caseList, /serviceSession\.findMany\([\s\S]*?schoolId:\s*scope\.schoolId/);
  assert.match(campaignHistory, /serviceSession\.findMany\([\s\S]*?schoolId:\s*scope\.schoolId/);

  const classroomDetail = classrooms.slice(
    classrooms.indexOf('// GET /api/classrooms/:id'),
    classrooms.indexOf('// PUT /api/classrooms/:id'),
  );
  assert.match(classroomDetail, /serviceSessions:\s*\{\s*where:\s*\{\s*schoolId:\s*user\.schoolId/);
  assert.match(reminders, /serviceSession\.count\([\s\S]*?where:\s*\{\s*schoolId,/);
  assert.match(reminders, /beneficiarySignup\.count\([\s\S]*?where:\s*\{\s*schoolId,/);
  assert.match(reminders, /const students = await prisma\.user\.findMany\(\{[\s\S]*?role:\s*"STUDENT",\s*schoolId,/);
});
