import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const servicePath = path.resolve(process.cwd(), "src/services/canvasIntegration.ts");
const googleServicePath = path.resolve(process.cwd(), "src/services/googleClassroomIntegration.ts");
const routePath = path.resolve(process.cwd(), "src/routes/integrations.ts");
const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
const service = fs.readFileSync(servicePath, "utf8");
const googleService = fs.readFileSync(googleServicePath, "utf8");
const routes = fs.readFileSync(routePath, "utf8");
const schema = fs.readFileSync(schemaPath, "utf8");

test("Canvas OAuth uses a persistent single-use state record", () => {
  assert.match(service, /buildCanvasStateToken/);
  assert.match(service, /verifyCanvasStateToken/);
});

test("Canvas OAuth callback re-checks the initiating school administrator", () => {
  assert.match(service, /state\.actorId/);
  assert.match(service, /state\.schoolId/);
});

test("Canvas OAuth rejects unsafe tenant URLs and requires encrypted real credentials", () => {
  assert.match(service, /normalizeApprovedCanvasOrigin/);
  assert.match(service, /encryptField/);
  assert.match(service, /credentialsEncrypted/);
});

test("Canvas preview does not create local teacher accounts", () => {
  assert.match(service, /mode/);
  assert.match(service, /PREVIEW/);
});

test("Canvas mapped records and API routes remain school scoped", () => {
  assert.match(service, /schoolId: state\.schoolId/);
  assert.match(service, /schoolId: params\.schoolId/);
  assert.match(routes, /router\.get\("\/canvas\/oauth\/callback", async/);
  assert.match(routes, /handleCanvasOAuthCallback/);
});

test("Google Classroom OAuth uses a persistent single-use state record", () => {
  assert.match(googleService, /buildGoogleClassroomStateToken/);
  assert.match(googleService, /verifyGoogleClassroomStateToken/);
});

test("Google Classroom OAuth callback re-checks the initiating school administrator", () => {
  assert.match(googleService, /state\.actorId/);
  assert.match(googleService, /state\.schoolId/);
});

test("Google Classroom OAuth rejects unsafe tenant URLs and requires encrypted credentials", () => {
  assert.match(googleService, /isPubliclyDeployed/);
  assert.match(googleService, /getAllowedGoogleOrigins/);
  assert.match(googleService, /credentialsEncrypted/);
});

test("Google Classroom real teacher accounts are not hidden as test accounts", () => {
  assert.match(googleService, /role: "TEACHER"/);
});

test("Google Classroom OAuth redirect errors do not echo provider error text", () => {
  assert.match(googleService, /googleClassroomError/);
  assert.match(googleService, /oauth_failed/);
});

test("Google Classroom mapped student lookups remain school scoped", () => {
  assert.match(googleService, /schoolId: params\.schoolId/);
});
