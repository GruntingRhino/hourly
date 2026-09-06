import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import opportunityRoutes from "../src/routes/opportunities";
import organizationRoutes from "../src/routes/organizations";

// §18 legacy model consolidation: the legacy ORG_ADMIN/Organization/
// Opportunity system has no client UI (ORG_ADMIN gets a hardcoded "Account
// Upgrade Required" page — see client/src/App.tsx) and zero real accounts,
// but its write API routes stayed directly reachable, bypassing that UI
// block entirely for anyone holding a valid ORG_ADMIN JWT. This freezes
// every create/edit/cancel/announce-shaped ORG_ADMIN route at the API
// layer with 410, matching the client's existing block, while leaving
// every read route and every other role's routes (student session
// check-in/checkout, school/org verification approve-reject, reports)
// completely untouched — this is a full freeze of new legacy write
// activity, not a removal of legacy data or its existing functionality.

const prismaClient = prisma as any;

const orgAdmin = {
  id: "frozen-org-admin-1",
  email: "frozen-org-admin@example.test",
  role: "ORG_ADMIN",
  status: "ACTIVE",
  tokenVersion: 0,
  organizationId: "org-a",
  emailVerified: true, eligibilityAttestation: { eligible13Plus: true },
};

function orgAdminToken(): string {
  return jwt.sign({ userId: orgAdmin.id, email: orgAdmin.email, role: orgAdmin.role, tv: 0 }, process.env.JWT_SECRET!);
}

async function request(app: express.Express, method: string, path: string, body?: unknown) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    return await fetch(`http://127.0.0.1:${(address as any).port}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${orgAdminToken()}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("every ORG_ADMIN legacy write route returns 410 without ever writing to the database", async () => {
  // authenticate() itself always looks up the user (needed to verify
  // token/tokenVersion/status regardless of role) — that's expected and
  // fine. What must never happen is any actual mutation: opportunity/
  // organization create/update, or a schoolOrganization create.
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    oppCreate: prismaClient.opportunity.create,
    oppUpdate: prismaClient.opportunity.update,
    orgUpdate: prismaClient.organization.update,
    schoolOrgCreate: prismaClient.schoolOrganization.create,
  };
  let writeAttempted = false;
  prismaClient.user.findUnique = async () => orgAdmin;
  prismaClient.opportunity.create = async () => { writeAttempted = true; throw new Error("should never be called"); };
  prismaClient.opportunity.update = async () => { writeAttempted = true; throw new Error("should never be called"); };
  prismaClient.organization.update = async () => { writeAttempted = true; throw new Error("should never be called"); };
  prismaClient.schoolOrganization.create = async () => { writeAttempted = true; throw new Error("should never be called"); };

  const opportunityApp = express();
  opportunityApp.use(express.json());
  opportunityApp.use("/", opportunityRoutes);

  const organizationApp = express();
  organizationApp.use(express.json());
  organizationApp.use("/", organizationRoutes);

  try {
    const cases: Array<{ app: express.Express; method: string; path: string; body?: unknown }> = [
      { app: opportunityApp, method: "POST", path: "/", body: { title: "x" } },
      { app: opportunityApp, method: "PUT", path: "/opp-1", body: { title: "x" } },
      { app: opportunityApp, method: "POST", path: "/opp-1/cancel" },
      { app: opportunityApp, method: "POST", path: "/opp-1/announce", body: { message: "hi" } },
      { app: organizationApp, method: "PUT", path: "/org-a", body: { name: "x" } },
      { app: organizationApp, method: "POST", path: "/org-a/request-school/school-1" },
    ];

    for (const { app, method, path, body } of cases) {
      const res = await request(app, method, path, body);
      assert.equal(res.status, 410, `${method} ${path} expected 410`);
      const responseBody = await res.json();
      assert.equal(responseBody.code, "LEGACY_ORG_ADMIN_FROZEN", `${method} ${path} expected the frozen error code`);
    }

    assert.equal(writeAttempted, false, "the freeze must run before any write reaches the database");
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.opportunity.create = original.oppCreate;
    prismaClient.opportunity.update = original.oppUpdate;
    prismaClient.organization.update = original.orgUpdate;
    prismaClient.schoolOrganization.create = original.schoolOrgCreate;
  }
});

test("ORG_ADMIN read routes are not affected by the freeze", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    orgFindMany: prismaClient.schoolOrganization.findMany,
    sessionFindMany: prismaClient.serviceSession.findMany,
  };
  prismaClient.user.findUnique = async () => orgAdmin;
  prismaClient.schoolOrganization.findMany = async () => [];
  prismaClient.serviceSession.findMany = async () => [];

  const organizationApp = express();
  organizationApp.use(express.json());
  organizationApp.use("/", organizationRoutes);

  try {
    const schoolsRes = await request(organizationApp, "GET", "/org-a/schools");
    assert.equal(schoolsRes.status, 200);
    const volunteersRes = await request(organizationApp, "GET", "/org-a/volunteers");
    assert.equal(volunteersRes.status, 200);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.schoolOrganization.findMany = original.orgFindMany;
    prismaClient.serviceSession.findMany = original.sessionFindMany;
  }
});

test("GET /api/opportunities (public browse) is not affected by the freeze", async () => {
  const original = prismaClient.opportunity.findMany;
  prismaClient.opportunity.findMany = async () => [];

  const opportunityApp = express();
  opportunityApp.use(express.json());
  opportunityApp.use("/", opportunityRoutes);
  const server = http.createServer(opportunityApp);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    // No Authorization header at all — this route is public.
    const res = await fetch(`http://127.0.0.1:${(address as any).port}/`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), []);
  } finally {
    prismaClient.opportunity.findMany = original;
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
