/**
 * JWT token cache for security tests.
 *
 * The cache is written to disk, not just held in memory. Playwright restarts a
 * worker process after a failing test, and an in-memory-only cache made every
 * restart re-login all seven accounts. A run with a handful of failures then
 * exceeded `publicAuthLimiter` (60 requests / 15 min / IP, `routes/auth.ts`) and
 * every later spec failed with 429 — masking the real results. The limiter is
 * correct; the harness was the bug. On disk, a full run logs in each account
 * once regardless of how many workers are recycled.
 *
 * The file holds real bearer tokens, so it lives inside a private per-run
 * directory (0700, unpredictable name — see `tokenCacheDir.ts`) rather than at
 * a predictable shared /tmp path, and it is removed at global teardown. Because
 * the directory is created fresh by global setup and destroyed after the run,
 * a token can never be adopted by a later run: a re-seed, a `tokenVersion` bump
 * or a `JWT_SECRET` rotation always produces fresh logins, never 401s from a
 * stale fixture. Within the run the file is keyed by API base URL.
 */
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { request } from "@playwright/test";
import { createPrivateCacheDir, TOKEN_CACHE_DIR_ENV } from "./tokenCacheDir";

export const BASE = process.env.API_BASE_URL ?? "http://localhost:3001";
export const PW = "Playwright1!";

export const ACCOUNTS = {
  schoolA:  { email: "abhay.sivaram+1@gmail.com", password: PW },
  schoolB:  { email: "abhay.sivaram+2@gmail.com", password: PW },
  orgA:     { email: "abhay.sivaram+3@gmail.com", password: PW },
  orgB:     { email: "abhay.sivaram+4@gmail.com", password: PW },
  student1: { email: "abhay.sivaram+5@gmail.com", password: PW },
  student2: { email: "abhay.sivaram+6@gmail.com", password: PW },
  student3: { email: "abhay.sivaram+7@gmail.com", password: PW },
} as const;

export type Account = keyof typeof ACCOUNTS;

const cache = new Map<Account, string>();

const CACHE_FILE_NAME =
  `tokens-${createHash("sha256").update(BASE).digest("hex").slice(0, 16)}.json`;

let processCacheDir: string | undefined;

/**
 * The run's private cache directory, published by global setup. If a spec is
 * run under a config without that global setup, fall back to a private
 * directory for this process alone — still never a shared predictable path,
 * just not shared with a restarted worker.
 */
function cacheFilePath(): string {
  const runDir = process.env[TOKEN_CACHE_DIR_ENV];
  if (runDir) return path.join(runDir, CACHE_FILE_NAME);
  processCacheDir ??= createPrivateCacheDir();
  return path.join(processCacheDir, CACHE_FILE_NAME);
}

function readDiskCache(): Record<string, string> {
  const file = cacheFilePath();
  try {
    // The containing directory is 0700 and unpredictably named, so nothing
    // hostile can be in it; reject anything that is not a plain file anyway.
    if (!fs.lstatSync(file).isFile()) return {};
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeDiskCache(role: Account, token: string): void {
  const file = cacheFilePath();
  const next = { ...readDiskCache(), [role]: token };
  // `wx` — fail if the staging path already exists, rather than following a
  // pre-planted file or symlink (`mode` alone is applied only on create, so it
  // is not by itself protection). Atomic-ish: another worker may be writing
  // concurrently, and a torn read is handled by readDiskCache()'s catch (worst
  // case one extra login).
  const tmp = `${file}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next), { flag: "wx", mode: 0o600 });
  fs.renameSync(tmp, file);
}

/**
 * Drops the on-disk cache. The run-scoped directory means this is not needed
 * between runs; it exists for a suite that re-seeds mid-run and must not reuse
 * the tokens it minted before the re-seed.
 */
export function clearTokenCache(): void {
  cache.clear();
  try {
    fs.unlinkSync(cacheFilePath());
  } catch {
    /* already absent */
  }
}

export async function getToken(role: Account): Promise<string> {
  if (cache.has(role)) return cache.get(role)!;

  const onDisk = readDiskCache()[role];
  if (onDisk) {
    cache.set(role, onDisk);
    return onDisk;
  }

  const ctx = await request.newContext();
  const res = await ctx.post(`${BASE}/api/auth/login`, {
    data: ACCOUNTS[role],
  });

  if (!res.ok()) {
    const text = await res.text();
    await ctx.dispose();
    throw new Error(
      `Login failed for '${role}' (${res.status()}): ${text}` +
      "\nRun: cd server && npx tsx prisma/seed-playwright.ts",
    );
  }

  const body = await res.json();
  await ctx.dispose();

  if (!body.token) {
    throw new Error(`No token in login response for '${role}': ${JSON.stringify(body)}`);
  }

  cache.set(role, body.token as string);
  writeDiskCache(role, body.token as string);
  return body.token as string;
}

/** Returns Playwright APIRequestContext options with Authorization header set. */
export function auth(token: string): { headers: Record<string, string> } {
  return { headers: { Authorization: `Bearer ${token}` } };
}
