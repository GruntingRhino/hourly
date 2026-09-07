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

test("school admin signup does not require a 13+ eligibility attestation", async () => {
  const email = `school-no-age-${Date.now()}@example.invalid`;
  const http = await startServer();
  try {
    const response = await fetch(`${http.baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "ValidPass1!", name: "School Admin", role: "SCHOOL_ADMIN", schoolName: "Age Policy Test School" }),
    });
    assert.equal(response.status, 201, await response.text());
    assert.equal(await db.user.count({ where: { email } }), 1);
    assert.equal(await db.eligibilityAttestation.count({ where: { user: { email } } }), 0);
  } finally {
    await http.close();
    const user = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      await db.school.deleteMany({ where: { createdById: user.id } });
      await db.user.delete({ where: { id: user.id } });
    }
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

test("beneficiary invitation account creation is not age-gated through HTTP", async () => {
  const http = await startServer();
  try {
    const response = await fetch(`${http.baseUrl}/api/invitations/beneficiary/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "invalid-token-value", name: "Age Test", password: "ValidPass1!" }),
    });
    assert.equal(response.status, 404, await response.text());
  } finally {
    await http.close();
  }
});

after(async () => {
  for (const server of servers) if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});
