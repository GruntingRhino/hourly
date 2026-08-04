import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const serverRoot = path.resolve(__dirname, "..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(serverRoot, relativePath), "utf8");
}

test("the dev-only impersonation and bypass-email-verification routes are gated by isPubliclyDeployed, not isProdLike", () => {
  const source = read("src/routes/auth.ts");
  const start = source.indexOf("router.post(\"/dev/bypass-email-verification\"");
  assert.ok(start > -1, "could not locate the dev bypass route");
  const guardWindow = source.slice(Math.max(0, start - 400), start);
  assert.match(
    guardWindow,
    /if \(!isPubliclyDeployed\(\) && ENABLE_IMPERSONATION\)/,
    "dev impersonation/bypass routes must require !isPubliclyDeployed(), not just !isProdLike() — " +
    "isProdLike() alone stays reachable on a Vercel preview deployment",
  );
});

test("the __test-email inbox-reading route is gated by isPubliclyDeployed, not isProdLike", () => {
  const source = read("src/routes/auth.ts");
  const start = source.indexOf('router.get("/__test-email"');
  assert.ok(start > -1, "could not locate the __test-email route");
  const guardWindow = source.slice(Math.max(0, start - 200), start);
  assert.match(guardWindow, /if \(!isPubliclyDeployed\(\)\)/);
});

test("the internal-admin local SCHOOL_ADMIN fallback is gated by isPubliclyDeployed, not isProdLike", () => {
  const source = read("src/lib/internalAdmin.ts");
  assert.match(source, /!isPubliclyDeployed\(\) && input\.role === "SCHOOL_ADMIN"/);
  assert.doesNotMatch(source, /!isProdLike\(\)/);
});

test("LMS test-origin bypasses (SSRF protection escape hatch) are gated by isPubliclyDeployed, not isProdLike", () => {
  const source = read("src/lib/lmsOutboundSecurity.ts");
  assert.doesNotMatch(source, /\bisProdLike\(\)/, "lmsOutboundSecurity.ts must use isPubliclyDeployed(), not isProdLike()");
});

test("the Google Classroom custom-OAuth-destination escape hatch is gated by isPubliclyDeployed", () => {
  const source = read("src/services/googleClassroomIntegration.ts");
  const start = source.indexOf("function normalizeGoogleTestOrigin");
  assert.ok(start > -1);
  const fnBody = source.slice(start, start + 400);
  assert.match(fnBody, /isPubliclyDeployed\(\)/);
});
