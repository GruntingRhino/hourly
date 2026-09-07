/**
 * Per-run private directory for the security suite's JWT cache.
 *
 * Why a directory and not a fixed file: the cache holds real bearer tokens for
 * the seeded QA accounts. A fixed, predictable path under the shared OS temp
 * dir is (a) pre-creatable by any other local account, which would let it feed
 * attacker-chosen JWTs to the whole suite, and (b) symlink-plantable, which
 * would leak the tokens on write. `fs.mkdtempSync` gives an unpredictable name
 * created with 0700, so neither is possible.
 *
 * Why per run: a directory created at global setup and removed at global
 * teardown cannot outlive the run, so a re-seed, a `tokenVersion` bump or a
 * `JWT_SECRET` rotation can never be papered over by a stale token from an
 * earlier run. Playwright workers inherit `process.env` from the process that
 * runs global setup, which is how they find the directory — that is the whole
 * propagation mechanism.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const TOKEN_CACHE_DIR_ENV = "GH_SECURITY_TOKEN_CACHE_DIR";

const PREFIX = "goodhours-security-";

/** Creates a fresh private (0700) directory under the OS temp dir. */
export function createPrivateCacheDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), PREFIX));
  // mkdtemp already creates 0700; make it explicit so a permissive umask or a
  // future platform difference cannot widen it silently.
  fs.chmodSync(dir, 0o700);
  return dir;
}

/** Removes a directory created by createPrivateCacheDir(). */
export function removePrivateCacheDir(dir: string | undefined): void {
  if (!dir) return;
  // Refuse to remove anything that is not one of ours.
  if (!path.basename(dir).startsWith(PREFIX)) return;
  if (path.dirname(dir) !== fs.realpathSync(os.tmpdir())
      && path.dirname(dir) !== os.tmpdir()) return;
  fs.rmSync(dir, { recursive: true, force: true });
}
