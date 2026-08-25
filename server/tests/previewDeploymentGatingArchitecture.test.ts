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

// googleAuth.ts previously defined its own local `IS_PRODUCTION` constant
// (NODE_ENV/VERCEL_ENV only, missing APP_ENV) instead of importing the
// canonical check — on an APP_ENV-only production deploy this would have
// left the fully-unauthenticated /dev-signin route (mints a real session
// for any email/name with zero Google verification) registered and
// reachable, and also silently disabled the Google OAuth approved-school-
// domain allowlist entirely (isApprovedDomain() unconditionally returned
// true). Both are now gated by the canonical isPubliclyDeployed(), which
// is also correctly false-on-preview-true (stricter than isProdLike()) so
// this can't be reachable on a public preview deployment either.
test("googleAuth.ts does not locally redefine a production/deployment check", () => {
  const source = read("src/routes/googleAuth.ts");
  assert.doesNotMatch(source, /\bIS_PRODUCTION\b/);
  assert.doesNotMatch(source, /NODE_ENV\s*===\s*["']production["']/);
  assert.match(source, /import\s*\{\s*isPubliclyDeployed\s*\}\s*from\s*["']\.\.\/lib\/isProdLike["']/);
});

test("the Google /dev-signin auth-bypass route is gated by isPubliclyDeployed", () => {
  const source = read("src/routes/googleAuth.ts");
  const start = source.indexOf('router.post("/dev-signin"');
  assert.ok(start > -1, "could not locate the /dev-signin route");
  const guardWindow = source.slice(Math.max(0, start - 200), start);
  assert.match(guardWindow, /if \(!isPubliclyDeployed\(\)\)/);
});

test("isApprovedDomain() enforces the school-domain allowlist based on isPubliclyDeployed, not a raw env comparison", () => {
  const source = read("src/routes/googleAuth.ts");
  const start = source.indexOf("function isApprovedDomain");
  assert.ok(start > -1);
  const fnBody = source.slice(start, start + 200);
  assert.match(fnBody, /if \(!isPubliclyDeployed\(\)\) return true;/);
});
