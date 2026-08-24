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
  assert.match(schema, /model CanvasOAuthState\s*\{/);
  assert.match(schema, /stateHash\s+String\s+@unique/);
  assert.match(schema, /consumedAt\s+DateTime\?/);
  assert.match(service, /stateHash: hashToken\(state\)/);
  assert.match(service, /const stateHash = hashToken\(rawState\)/);
  assert.match(service, /consumedAt: null/);
  assert.match(service, /updateMany\(/);
});

test("Canvas OAuth callback re-checks the initiating school administrator", () => {
  assert.match(service, /actor\.role !== "SCHOOL_ADMIN"/);
  assert.match(service, /actor\.status !== "ACTIVE"/);
  assert.match(service, /schoolId: state\.schoolId/);
});

test("Canvas OAuth rejects unsafe tenant URLs and requires encrypted real credentials", () => {
  assert.match(service, /isPrivateOrLocalHost/);
  assert.match(service, /FIELD_ENCRYPTION_KEY/);
  assert.match(service, /credentialsEncrypted.*isEncrypted|isEncrypted\(encryptedCredentials\)/s);
});

test("Canvas preview does not create local teacher accounts", () => {
  assert.match(service, /mode: params\.mode/);
  assert.match(service, /if \(params\.mode === "PREVIEW"\)/);
  assert.match(service, /isTestAccount: false/);
});

test("Canvas mapped records and API routes remain school scoped", () => {
  assert.match(service, /connectionId: connection\.id,\s*schoolId: params\.schoolId/);
  assert.match(service, /mappedUser\?\.localType === "User"[\s\S]{0,500}schoolId: params\.schoolId/);
  assert.match(routes, /router\.get\("\/canvas\/oauth\/callback", async/);
  assert.match(routes, /handleCanvasOAuthCallback/);
});

test("Google Classroom OAuth uses a persistent single-use state record", () => {
  assert.match(schema, /model GoogleClassroomOAuthState\s*\{/);
  assert.match(schema, /model GoogleClassroomOAuthState[\s\S]*stateHash\s+String\s+@unique/);
  assert.match(schema, /model GoogleClassroomOAuthState[\s\S]*consumedAt\s+DateTime\?/);
  assert.match(googleService, /googleClassroomOAuthState\.create\(/);
  assert.match(googleService, /stateHash: hashToken\(state\)/);
  assert.match(googleService, /consumedAt: null/);
  assert.match(googleService, /googleClassroomOAuthState\.updateMany\(/);
});

test("Google Classroom OAuth callback re-checks the initiating school administrator", () => {
  assert.match(googleService, /assertGoogleClassroomOAuthActor/);
  assert.match(googleService, /actor\.status !== "ACTIVE"/);
  assert.match(googleService, /actor\.role !== "SCHOOL_ADMIN"/);
  assert.match(googleService, /actor\.schoolId !== state\.schoolId/);
});

test("Google Classroom OAuth rejects unsafe tenant URLs and requires encrypted credentials", () => {
  assert.match(googleService, /privateOrLocal/);
  assert.match(googleService, /GOOGLE_CLASSROOM_ALLOWED_HOSTS/);
  assert.match(googleService, /isEncrypted\(encryptedCredentials\)/);
});

test("Google Classroom real teacher accounts are not hidden as test accounts", () => {
  assert.match(googleService, /role: "TEACHER"[\s\S]{0,300}isTestAccount: false/);
});

test("Google Classroom OAuth redirect errors do not echo provider error text", () => {
  assert.match(googleService, /googleClassroomError", "google_authorization_denied"/);
  assert.match(googleService, /googleClassroomError", "googleClassroom_oauth_failed"/);
});

test("Google Classroom mapped student lookups remain school scoped", () => {
  assert.match(googleService, /mappedUser\?\.localType === "User"[\s\S]{0,260}schoolId: params\.schoolId/);
});
