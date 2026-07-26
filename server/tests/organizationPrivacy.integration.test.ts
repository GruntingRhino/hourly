import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import organizationRoutes from "../src/routes/organizations";

const prismaClient = prisma as any;
const owner = { id: "org-owner", email: "owner@example.test", role: "ORG_ADMIN", status: "ACTIVE", tokenVersion: 0, organizationId: "org-a" };
const outsider = { id: "student-outside", email: "student@example.test", role: "STUDENT", status: "ACTIVE", tokenVersion: 0, organizationId: null };
const organization = {
  id: "org-a",
  name: "Private Organization",
  email: "private-contact@example.test",
  phone: "+1-555-0100",
  description: "Organization description",
  website: "https://organization.example",
  avatarUrl: null,
  status: "SUSPENDED",
  zipCodes: '["62701"]',
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-02"),
  opportunities: [{
    id: "inactive-opportunity",
    title: "Inactive opportunity",
    description: "Not publicly listed",
    date: new Date("2026-01-01"),
    startTime: "09:00",
    endTime: "10:00",
    location: "Private location",
    status: "INACTIVE",
  }],
  _count: { opportunities: 1, members: 3 },
};

function pick(source: Record<string, unknown>, select: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(select)
    .filter(([, value]) => value === true || typeof value === "object")
    .map(([key, value]) => {
      if (key === "opportunities" && typeof value === "object" && value) {
        const relation = value as { where?: { status?: string }; select?: Record<string, unknown> };
        const opportunities = source.opportunities as Array<Record<string, unknown>>;
        return [key, opportunities
          .filter((opportunity) => !relation.where?.status || opportunity.status === relation.where.status)
          .map((opportunity) => pick(opportunity, relation.select ?? {}))];
      }
      return [key, source[key]];
    }));
}

async function requestAs(app: express.Express, path: string, user: typeof owner | typeof outsider) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role, tv: 0 }, process.env.JWT_SECRET!);
    return await fetch(`http://127.0.0.1:${address.port}${path}`, { headers: { authorization: `Bearer ${token}` } });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("organization directory keeps private rows out of unrelated authenticated responses", async () => {
  const original = { userFindUnique: prismaClient.user.findUnique, orgFindMany: prismaClient.organization.findMany, orgFindUnique: prismaClient.organization.findUnique };
  const users = new Map([[owner.id, owner], [outsider.id, outsider]]);
  prismaClient.user.findUnique = async ({ where }: any) => users.get(where.id) ?? null;
  prismaClient.organization.findMany = async ({ select }: any) => [pick(organization, select)];
  prismaClient.organization.findUnique = async ({ where, select }: any) => where.id === organization.id ? pick(organization, select) : null;

  try {
    const app = express();
    app.use(organizationRoutes);

    const listResponse = await requestAs(app, "/", outsider);
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json() as Array<Record<string, unknown>>;
    assert.equal(list.length, 1);
    assert.deepEqual(list[0].opportunities, []);
    assert.equal("_count" in list[0], false, "directory response revealed inactive opportunity existence");
    for (const field of ["email", "phone", "status", "zipCodes", "createdAt", "updatedAt", "members"]) {
      assert.equal(field in list[0], false, `directory response exposed ${field}`);
    }

    const outsiderResponse = await requestAs(app, "/org-a", outsider);
    assert.equal(outsiderResponse.status, 200);
    const outsiderJson = await outsiderResponse.json() as Record<string, unknown>;
    for (const field of ["email", "phone", "status", "zipCodes", "createdAt", "updatedAt", "members"]) {
      assert.equal(field in outsiderJson, false, `unrelated response exposed ${field}`);
    }

    const ownerResponse = await requestAs(app, "/org-a", owner);
    assert.equal(ownerResponse.status, 200);
    const ownerJson = await ownerResponse.json() as Record<string, unknown>;
    assert.equal(ownerJson.email, organization.email);
    assert.equal(ownerJson.phone, organization.phone);
    assert.equal(ownerJson.zipCodes, organization.zipCodes);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.organization.findMany = original.orgFindMany;
    prismaClient.organization.findUnique = original.orgFindUnique;
  }
});
