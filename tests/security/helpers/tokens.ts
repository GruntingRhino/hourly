/**
 * JWT token cache for security tests.
 *
 * Logs in each seeded account once per process and caches the JWT.
 * With workers:1 the cache lives for the full test run, keeping
 * /api/auth/login calls well below the 10/15-min rate limit.
 */
import { request } from "@playwright/test";

export const BASE = process.env.API_BASE_URL ?? "http://localhost:3001";
export const PW = "Playwright1!";

export const ACCOUNTS = {
  schoolA:  { email: "school-admin@test.goodhours.app", password: PW },
  schoolB:  { email: "abhay.sivaram+2@gmail.com", password: PW },
  orgA:     { email: "abhay.sivaram+3@gmail.com", password: PW },
  orgB:     { email: "abhay.sivaram+4@gmail.com", password: PW },
  student1: { email: "abhay.sivaram+5@gmail.com", password: PW },
  student2: { email: "abhay.sivaram+6@gmail.com", password: PW },
  student3: { email: "abhay.sivaram+7@gmail.com", password: PW },
} as const;

export type Account = keyof typeof ACCOUNTS;

const cache = new Map<Account, string>();

export async function getToken(role: Account): Promise<string> {
  if (cache.has(role)) return cache.get(role)!;

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
  return body.token as string;
}

/** Returns Playwright APIRequestContext options with Authorization header set. */
export function auth(token: string): { headers: Record<string, string> } {
  return { headers: { Authorization: `Bearer ${token}` } };
}
