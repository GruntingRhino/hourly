import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma";
import app from "../src/index";
import { hashToken } from "../src/lib/tokenHash";

const db = prisma as any;

async function startServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

test("concurrent reset requests consume one reset token and revoke sessions once", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const rawToken = `reset-${suffix}`;
  const user = await db.user.create({
    data: {
      email: `reset-concurrency-${suffix}@example.invalid`,
      name: "Reset concurrency fixture",
      role: "STUDENT",
      emailVerified: true,
      passwordHash: await bcrypt.hash("old-password", 4),
      passwordResetToken: hashToken(rawToken),
      passwordResetExpires: new Date(Date.now() + 60_000),
      tokenVersion: 7,
    },
  });
  const http = await startServer();
  try {
    const body = JSON.stringify({ token: rawToken, password: "New-password-123!" });
    const responses = await Promise.all([
      fetch(`${http.baseUrl}/api/auth/reset-password`, { method: "POST", headers: { "content-type": "application/json" }, body }),
      fetch(`${http.baseUrl}/api/auth/reset-password`, { method: "POST", headers: { "content-type": "application/json" }, body }),
    ]);
    const statuses = responses.map((response) => response.status).sort((a, b) => a - b);
    assert.deepEqual(statuses, [200, 400]);
    const after = await db.user.findUnique({ where: { id: user.id }, select: { passwordResetToken: true, passwordResetExpires: true, tokenVersion: true } });
    assert.equal(after.passwordResetToken, null);
    assert.equal(after.passwordResetExpires, null);
    assert.equal(after.tokenVersion, 8);
  } finally {
    await http.close();
    await db.user.delete({ where: { id: user.id } });
  }
});
