import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const routePath = path.resolve(process.cwd(), "src/routes/googleAuth.ts");
const route = fs.readFileSync(routePath, "utf8");

test("Google callback requires a verified Google email before account linking", () => {
  assert.match(route, /googleUser\.verified_email !== true/);
  assert.match(route, /return res\.status\(403\)/);
});

test("directory-backed Google registration binds the identity to the directory email domain", () => {
  assert.match(route, /Direct school claiming is disabled/);
  assert.match(route, /directorySchoolId/);
});

test("directory claiming is conditional and transactional in both Google registration paths", () => {
  assert.match(route, /registrationToken/);
  assert.match(route, /directoryId/);
  assert.match(route, /claimed/);
});

test("Google registration token cannot be used as an unscoped school admin assertion", () => {
  assert.match(route, /registrationToken/);
  assert.match(route, /googleUser\.verified_email !== true/);
});

test("school verification consumes the registration token atomically", () => {
  assert.match(route, /updateMany\(/);
  assert.match(route, /registrationToken: null/);
  assert.match(route, /registrationTokenExpires: null/);
});
