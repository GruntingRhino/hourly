import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const procurement = fs.readFileSync(path.join(process.cwd(), "src/routes/schoolProcurement.ts"), "utf8");
const billing = fs.readFileSync(path.join(process.cwd(), "src/routes/billing.ts"), "utf8");

test("procurement document upload authorizes before Multer persists bytes", () => {
  const start = procurement.indexOf('router.post("/:id/documents"');
  const end = procurement.indexOf('// ── GET /api/school-procurement', start);
  const route = procurement.slice(start, end);
  assert.match(route, /authorizeProcurementDocumentUpload,\s*procUpload\.single/);
});

test("internal invoice artifact upload authorizes before Multer persists bytes", () => {
  const start = billing.indexOf('router.post(\n  "/internal/invoice-requests/:requestId/artifacts"');
  const end = billing.indexOf('// ── DELETE /api/billing', start);
  const route = billing.slice(start, end);
  assert.match(route, /authorizeInternalArtifactUpload,\s*artifactUpload\.single/);
});
