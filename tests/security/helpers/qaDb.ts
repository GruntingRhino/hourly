/**
 * Database postconditions for the security suite.
 *
 * A few claims cannot be proved from an HTTP response alone — "no account was
 * silently created" is the obvious one: a route could create the row and answer
 * with a registration-style payload that carries no token, and a response-only
 * assertion would call that a pass.
 *
 * This is deliberately narrow and fails closed:
 *   - it requires an explicit `QA_DATABASE_URL` (never `DATABASE_URL`, which on
 *     this repo's machines points at a developer's own database);
 *   - it refuses any URL that is not a loopback host with a `_qa`/`_test`
 *     database name, so it cannot be aimed at production;
 *   - every check first proves, by positive control, that it is looking at the
 *     same data the API is serving. Without that, "row not found" could just
 *     mean "wrong database", and the assertion would pass vacuously.
 * Reads only; nothing here writes.
 */
import { expect } from "@playwright/test";

const SEEDED_CONTROL_EMAIL = "abhay.sivaram+5@gmail.com"; // student1, from seed-playwright.ts

function validatedQaUrl(): string {
  const raw = process.env.QA_DATABASE_URL;
  if (!raw) {
    throw new Error(
      "QA_DATABASE_URL is not set, so this test's database postcondition cannot be " +
      "checked. Set it to the disposable QA database the API under test is using, e.g.\n" +
      "  QA_DATABASE_URL='postgresql://…@127.0.0.1:5433/goodhours_qa?schema=public'",
    );
  }
  const url = new URL(raw);
  const host = url.hostname;
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) {
    throw new Error(`QA_DATABASE_URL must be a loopback host, got '${host}'. Refusing to connect.`);
  }
  const dbName = url.pathname.replace(/^\//, "");
  if (!/(_qa|_test)$/.test(dbName)) {
    throw new Error(
      `QA_DATABASE_URL database must end in _qa or _test, got '${dbName}'. Refusing to connect.`,
    );
  }
  return raw;
}

type MinimalClient = {
  user: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
  };
  $disconnect(): Promise<void>;
};

async function withQaDb<T>(fn: (db: MinimalClient) => Promise<T>): Promise<T> {
  const url = validatedQaUrl();
  // Imported lazily so specs that never touch the database don't pay for, or
  // depend on, a Prisma client.
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient({ datasources: { db: { url } } }) as unknown as MinimalClient;
  try {
    return await fn(db);
  } finally {
    await db.$disconnect();
  }
}

const byEmail = (email: string) => ({
  where: { email: { equals: email, mode: "insensitive" } },
  select: { id: true },
});

/**
 * Asserts no User row exists for `email` — having first confirmed the
 * connection can see the seeded fixtures, so a false "absent" caused by
 * pointing at the wrong database fails loudly instead of passing.
 */
export async function expectNoUserAccount(email: string): Promise<void> {
  await withQaDb(async (db) => {
    const control = await db.user.findFirst(byEmail(SEEDED_CONTROL_EMAIL));
    expect(
      control,
      `QA_DATABASE_URL does not contain the seeded account ${SEEDED_CONTROL_EMAIL}; ` +
      "it is not the database the API under test is using, so this postcondition " +
      "would be meaningless. Point it at the seeded QA database.",
    ).toBeTruthy();

    const created = await db.user.findFirst(byEmail(email));
    expect(created, `an account was created for '${email}'`).toBeNull();
  });
}
