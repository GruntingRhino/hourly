import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Regression test: routes/internal.ts independently redefined isProdLike()
// as `NODE_ENV === "production" || VERCEL_ENV === "production"`, missing
// the APP_ENV check — the exact same drift pattern already found and fixed
// in routes/schools.ts earlier this session (isProdLike.test.ts covers
// that specific historical case), but this second occurrence was in a
// different file, gating whether the 5 internal cron endpoints in
// internal.ts require CRON_SECRET to be explicitly configured before
// running in a production-like environment. A deployment configured via
// APP_ENV alone (no NODE_ENV/VERCEL_ENV) would have silently skipped that
// requirement — the endpoints still required valid scheduler auth (a
// CRON_SECRET bearer token or GitHub Actions OIDC) to actually invoke
// anything, so this was a defense-in-depth policy gap, not a bypass of
// authentication itself, but the same root cause as the more severe
// schools.ts instance.
//
// The existing isProdLike.test.ts only unit-tests the canonical function's
// behavior; previewDeploymentGatingArchitecture.test.ts only checks the 5
// specific sites from that earlier fix. Neither would catch a new file
// redefining the check independently. This test scans every route/lib/
// service source file for a local `function isProdLike` definition outside
// the one canonical module, so this class of drift can't reoccur silently
// in any file, not just the ones already found.

const serverSrcRoot = path.resolve(__dirname, "../src");
const CANONICAL_DEFINITION_FILE = path.join(serverSrcRoot, "lib/isProdLike.ts");

function listSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

test("no file other than lib/isProdLike.ts locally redefines isProdLike()", () => {
  const offenders: string[] = [];
  for (const file of listSourceFiles(serverSrcRoot)) {
    if (file === CANONICAL_DEFINITION_FILE) continue;
    const source = fs.readFileSync(file, "utf8");
    if (/function\s+isProdLike\s*\(/.test(source)) {
      offenders.push(path.relative(serverSrcRoot, file));
    }
  }
  assert.deepEqual(offenders, [], `these files locally redefine isProdLike() instead of importing lib/isProdLike.ts: ${offenders.join(", ")}`);
});

test("routes/internal.ts imports the canonical isProdLike instead of redefining it", () => {
  const source = fs.readFileSync(path.join(serverSrcRoot, "routes/internal.ts"), "utf8");
  assert.match(source, /import\s*\{\s*isProdLike\s*\}\s*from\s*["']\.\.\/lib\/isProdLike["']/);
  assert.doesNotMatch(source, /function\s+isProdLike\s*\(/);
});

// Broader regression: the `function isProdLike(` regex above only catches
// re-derivations that happen to share that exact function name. This
// session found several more instances of the identical bug shape hiding
// under different names — a local `const IS_PRODUCTION = NODE_ENV ===
// "production" || VERCEL_ENV === "production"` in routes/googleAuth.ts
// (missing APP_ENV — silently disabled the Google OAuth approved-domain
// allowlist AND left the /dev-signin full-auth-bypass route registered on
// an APP_ENV-only production deploy), another in index.ts (missing
// APP_ENV AND VERCEL_ENV — leaked stack traces in error responses and
// allowed any localhost Origin through CORS), a VERCEL_ENV-only check in
// services/email.ts, and a duplicated-but-correct copy in
// middleware/rateLimit.ts. Scans for the raw comparison pattern itself,
// not any particular name, so the next occurrence can't dodge this check
// by choosing a different variable/function name.
test("no file other than lib/isProdLike.ts (and env.ts's deliberately stricter DB-safety variant) raw-compares NODE_ENV/VERCEL_ENV against \"production\"", () => {
  const exempt = new Set([
    CANONICAL_DEFINITION_FILE,
    // env.ts's validateEnv()/isDevMode() intentionally add an extra
    // `APP_ENV !== "development"` guard on top of the canonical check,
    // used only for startup DB-safety validation — a deliberate stricter
    // variant, not accidental drift. It also re-exports the canonical
    // isProdLike for every other consumer.
    path.join(serverSrcRoot, "lib/env.ts"),
  ]);
  const pattern = /(NODE_ENV|VERCEL_ENV)\s*===\s*["']production["']/;
  const offenders: string[] = [];
  for (const file of listSourceFiles(serverSrcRoot)) {
    if (exempt.has(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    if (pattern.test(source)) {
      offenders.push(path.relative(serverSrcRoot, file));
    }
  }
  assert.deepEqual(offenders, [], `these files raw-compare NODE_ENV/VERCEL_ENV instead of importing lib/isProdLike.ts: ${offenders.join(", ")}`);
});
