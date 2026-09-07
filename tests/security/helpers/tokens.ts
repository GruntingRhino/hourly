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
 * The file lives under the OS temp dir, is keyed by API base URL, and holds only
 * short-lived JWTs for the seeded throwaway `Playwright1!` accounts.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { request } from "@playwright/test";

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

const cacheFile = path.join(
  os.tmpdir(),
  `goodhours-security-tokens-${createHash("sha256").update(BASE).digest("hex").slice(0, 16)}.json`,
);

function readDiskCache(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(cacheFile, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeDiskCache(role: Account, token: string): void {
  const next = { ...readDiskCache(), [role]: token };
  // Atomic-ish: another worker may be writing concurrently, and a torn read is
  // handled by readDiskCache()'s catch (worst case one extra login).
  const tmp = `${cacheFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next), { mode: 0o600 });
  fs.renameSync(tmp, cacheFile);
}

/** Drops the on-disk cache. Call when the API or seed data is recreated. */
export function clearTokenCache(): void {
  cache.clear();
  try {
    fs.unlinkSync(cacheFile);
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
