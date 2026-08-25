import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Regression test: routes/auth.ts had a dead (never-called) function,
// isInteractiveSignupRequest, that checked
// `origin.includes("goodhours.app")` to decide whether a signup request
// looked "interactive." That's broader than even the already-fixed SEC-003
// wildcard-subdomain CORS bug (`origin.endsWith(".goodhours.app")`) — a
// substring check matches an Origin header like
// "https://evil-goodhours.app.attacker.com" or
// "https://attacker.com/?x=goodhours.app" that has nothing to do with the
// real domain. The function was unreachable (found via a repo-wide grep
// confirming zero call sites), so it had no live security impact and was
// deleted rather than fixed in place — but nothing previously prevented
// this exact anti-pattern from being copy-pasted into a live code path.
// This test scans server source for the same substring-origin-matching
// shape so it can't quietly reappear.

const serverSrcRoot = path.resolve(__dirname, "../src");

function listSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

test("no server source file matches an Origin/Referer header with a substring check against the production domain", () => {
  const offenders: string[] = [];
  const pattern = /\b(origin|referer)\b[^\n]{0,40}\.includes\(\s*["'`][^"'`]*goodhours\.app/i;
  for (const file of listSourceFiles(serverSrcRoot)) {
    const source = fs.readFileSync(file, "utf8");
    if (pattern.test(source)) {
      offenders.push(path.relative(serverSrcRoot, file));
    }
  }
  assert.deepEqual(offenders, [], `these files match an Origin/Referer header via .includes() against the production domain instead of an exact/allowlist check: ${offenders.join(", ")}`);
});
