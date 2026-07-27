import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const route = fs.readFileSync(path.join(process.cwd(), "src/routes/sessions.ts"), "utf8");

test("signature submission authorizes before accepting bytes and persists durable evidence", () => {
  const start = route.indexOf('router.post("/:id/submit-verification"');
  const end = route.indexOf('// GET /api/sessions/school', start);
  const handler = route.slice(start, end);
  assert.match(handler, /authorizeVerificationSubmission, uploadSignatureFile/);
  assert.match(handler, /detectSignatureMime\(file\.buffer\)/);
  assert.match(handler, /signatureFileBytes: file \? Uint8Array\.from\(file\.buffer\)/);
  assert.match(handler, /router\.get\("\/:id\/signature-file"/);
  assert.doesNotMatch(handler, /sendFile\(/);
});
