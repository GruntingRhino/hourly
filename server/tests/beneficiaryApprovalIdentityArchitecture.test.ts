import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const beneficiariesRoute = fs.readFileSync(path.join(process.cwd(), "src/routes/beneficiaries.ts"), "utf8");

test("beneficiary approval queues identify the student by name", () => {
  const signupListStart = beneficiariesRoute.indexOf('// GET /api/beneficiaries/:id/signups');
  const signupListEnd = beneficiariesRoute.indexOf('// POST /api/beneficiaries/signups/:signupId/approve', signupListStart);
  const signupListRoute = beneficiariesRoute.slice(signupListStart, signupListEnd);

  assert.match(
    signupListRoute,
    /student:\s*\{\s*id:\s*s\.studentId,\s*label:\s*studentMap\.get\(s\.studentId\)\s*\?\?\s*"Unknown student"\s*\}/,
    "organizations need the student's name to verify the correct volunteer's hours",
  );
});
