import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test, { after } from "node:test";
import prisma from "../src/lib/prisma";
import app from "../src/index";

const db = prisma as any;
const servers: Server[] = [];

async function startServer() {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return { baseUrl: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

test("password signup rejects a missing 13+ eligibility attestation before creating an account", async () => {
  const email = `age-missing-${Date.now()}@example.invalid`;
  const http = await startServer();
  try {
    const response = await fetch(`${http.baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "ValidPass1!", name: "Age Test", role: "SCHOOL_ADMIN" }),
    });
    assert.equal(response.status, 400, await response.text());
    assert.equal(await db.user.count({ where: { email } }), 0);
  } finally {
    await http.close();
    await db.user.deleteMany({ where: { email } });
  }
});

test("invitation account creation rejects missing or false eligibility through HTTP before token lookup", async () => {
  const http = await startServer();
  try {
    for (const eligible13Plus of [undefined, false]) {
      const response = await fetch(`${http.baseUrl}/api/invitations/student/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "invalid-token-value", name: "Age Test", password: "ValidPass1!", ...(eligible13Plus === undefined ? {} : { eligible13Plus }) }),
      });
      assert.equal(response.status, 400, await response.text());
    }
  } finally {
    await http.close();
  }
});

test("beneficiary invitation account creation rejects missing eligibility through HTTP", async () => {
  const http = await startServer();
  try {
    const response = await fetch(`${http.baseUrl}/api/invitations/beneficiary/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "invalid-token-value", name: "Age Test", password: "ValidPass1!" }),
    });
    assert.equal(response.status, 400, await response.text());
  } finally {
    await http.close();
  }
});

after(async () => {
  for (const server of servers) if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});
