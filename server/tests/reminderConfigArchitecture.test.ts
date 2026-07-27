import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const route = fs.readFileSync(path.join(process.cwd(), "src/routes/beneficiaries.ts"), "utf8");
const worker = fs.readFileSync(path.join(process.cwd(), "src/lib/eventReminders.ts"), "utf8");

test("reminder config route validates untrusted input before persistence", () => {
  const start = route.indexOf('router.put("/:id/reminder-config"');
  const end = route.indexOf('// POST /api/beneficiaries/signups/', start);
  const handler = route.slice(start, end);
  assert.match(handler, /parseReminderConfigInput\(req\.body\)/);
  assert.match(handler, /err instanceof z\.ZodError/);
  assert.match(handler, /requireOrgFeature\(req\.params\.id, "configurableReminders"\)/);
  assert.match(handler, /requireOrgFeature\(req\.params\.id, "advancedWaitlistControls"\)/);
});

test("reminder worker uses validated stored config and isolates a bad beneficiary", () => {
  assert.match(worker, /parseStoredReminders/);
  assert.match(worker, /for \(const config of configs\) \{\s*try \{/);
  assert.match(worker, /Ignoring invalid configuration for beneficiary/);
});
