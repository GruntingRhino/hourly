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
  assert.match(route, /isDirectoryClaimAuthorized\(/);
  assert.match(route, /googleProfile\.email/);
  assert.match(route, /dirEntry\.emailDomain/);
  assert.match(route, /DOMAIN_MISMATCH/);
});

test("directory claiming is conditional and transactional in both Google registration paths", () => {
  assert.match(route, /tx\.schoolDirectory\.updateMany\(/);
  assert.match(route, /claimed: false/);
  assert.match(route, /if \(claimResult\.count !== 1\)/);
  assert.doesNotMatch(route, /prisma\.schoolDirectory\.update\(\{[\s\S]*claimed: true/s);
});

test("Google registration token cannot be used as an unscoped school admin assertion", () => {
  assert.match(route, /googleProfile\.pendingSchoolAdmin/);
  assert.match(route, /googleProfile\.googleId/);
  assert.match(route, /googleProfile\.email/);
  assert.match(route, /googleProfile\.emailVerified !== true/);
  assert.match(route, /adminUser\.role !== "SCHOOL_ADMIN"/);
  assert.match(route, /adminUser\.status !== "ACTIVE"/);
});

test("school verification consumes the registration token atomically", () => {
  assert.match(route, /updateMany\(/);
  assert.match(route, /registrationToken: null/);
  assert.match(route, /registrationTokenExpires: null/);
});
