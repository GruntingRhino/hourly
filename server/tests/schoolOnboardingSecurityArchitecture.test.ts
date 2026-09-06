import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const authSource = readFileSync(new URL("../src/routes/auth.ts", import.meta.url), "utf8");
const googleSource = readFileSync(new URL("../src/routes/googleAuth.ts", import.meta.url), "utf8");
const middlewareSource = readFileSync(new URL("../src/middleware/auth.ts", import.meta.url), "utf8");
const activationSource = readFileSync(new URL("../src/lib/schoolActivation.ts", import.meta.url), "utf8");

function routeSlice(source: string, start: string, end: string): string {
  const begin = source.indexOf(start);
  const finish = source.indexOf(end, begin + start.length);
  assert.notEqual(begin, -1, `missing route marker ${start}`);
  assert.notEqual(finish, -1, `missing route marker ${end}`);
  return source.slice(begin, finish);
}

test("password signup creates a pending application but returns no bearer token", () => {
  const signup = routeSlice(authSource, 'router.post("/signup"', '// POST /api/auth/login');
  assert.match(signup, /requiresEmailVerification:\s*true/);
  assert.match(signup, /requiresSchoolOwnershipReview:\s*true/);
  assert.match(signup, /ownershipStatus:\s*"PENDING"/);
  assert.doesNotMatch(signup, /signUserToken\(/);
  assert.doesNotMatch(signup, /claimedBySchoolId/);
});

test("login and authenticated requests enforce verification and restrict pending schools to setup routes", () => {
  const login = routeSlice(authSource, 'router.post("/login"', '// GET /api/auth/me');
  assert.match(login, /evaluateSessionEligibility/);
  assert.match(middlewareSource, /evaluateSessionEligibility/);
  assert.match(middlewareSource, /emailVerified:\s*true/);
  assert.match(middlewareSource, /ownershipStatus:\s*true/);
  assert.match(middlewareSource, /SCHOOL_SETUP_ONLY/);
  assert.match(middlewareSource, /isPendingSetupRoute/);
});

test("Google bootstrap is database-backed, short-lived, and consumed once", () => {
  assert.match(googleSource, /schoolRegistrationIntent\.create/);
  assert.match(googleSource, /15 \* 60 \* 1000/);
  assert.match(googleSource, /schoolRegistrationIntent\.updateMany/);
  assert.match(googleSource, /consumed\.count !== 1/);
  assert.doesNotMatch(googleSource, /pendingSchoolAdmin/);
});

test("legacy direct school claiming and magic-link session minting fail closed", () => {
  const direct = routeSlice(
    googleSource,
    'router.post("/complete-registration"',
    '// GET /api/auth/google/verify-school',
  );
  assert.match(direct, /status\(410\)/);
  assert.doesNotMatch(direct, /signUserToken/);

  const verify = routeSlice(
    googleSource,
    'router.get("/verify-school"',
    'export default router',
  );
  assert.match(verify, /ownershipEvidenceVerifiedAt/);
  assert.match(verify, /requiresSchoolOwnershipReview:\s*true/);
  assert.doesNotMatch(verify, /signUserToken/);
  assert.doesNotMatch(verify, /verified:\s*true/);
});

test("directory claims happen only inside independent approval transaction", () => {
  assert.match(activationSource, /School applicants cannot approve their own authority/);
  assert.match(activationSource, /ownershipStatus:\s*"PENDING"/);
  assert.match(activationSource, /claimedBySchoolId:\s*candidate\.id/);
  assert.match(activationSource, /claimed\.count !== 1/);
});
