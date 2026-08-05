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
