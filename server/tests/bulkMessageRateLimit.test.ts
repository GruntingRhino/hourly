import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import messageRoutes from "../src/routes/messages";

// Regression test for §13 (bulk-messaging quotas): POST /api/messages/bulk
// had no rate limiter at all, unlike every other message-sending route in
// this file (POST / has sendMessageLimiter, POST /reminders/run has
// reminderRunLimiter). Since a single bulk call can message an entire
// school's student body, an unbounded number of repeat calls had no quota.

const prismaClient = prisma as any;

const schoolAdmin = {
  id: "bulk-admin-1",
  email: "admin@example.test",
  role: "SCHOOL_ADMIN",
  status: "ACTIVE",
  tokenVersion: 0,
  schoolId: "school-bulk-1",
  emailVerified: true,
  school: { verified: true, ownershipStatus: "APPROVED" },
  assignedCohorts: [],
};

async function requestAs(app: express.Express, ip: string) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const token = jwt.sign({ userId: schoolAdmin.id, email: schoolAdmin.email, role: schoolAdmin.role, tv: 0 }, process.env.JWT_SECRET!);
    return await fetch(`http://127.0.0.1:${(address as any).port}/bulk`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({ receiverIds: ["student-bulk-1"], body: "Reminder to submit your hours." }),
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("POST /bulk is rate limited after 5 calls per staff member per hour", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    schoolFindUnique: prismaClient.school.findUnique,
    userFindMany: prismaClient.user.findMany,
    transaction: prismaClient.$transaction,
    notificationCreateMany: prismaClient.notification.createMany,
    interventionCampaignCreate: prismaClient.interventionCampaign.create,
    interventionCaseUpsert: prismaClient.interventionCase.upsert,
  };
  prismaClient.user.findUnique = async ({ where }: any) => (where.id === schoolAdmin.id ? schoolAdmin : null);
  prismaClient.school.findUnique = async () => ({
    id: schoolAdmin.schoolId,
    name: "Test School",
    requiredHours: 20,
    serviceStartDate: null,
    serviceEndDate: null,
  });
  prismaClient.user.findMany = async () => [{
    id: "student-bulk-1",
    name: "Test Student",
    email: "student@example.test",
    grade: null,
    cohortId: null,
    cohort: null,
    cohortMemberships: [],
  }];
  prismaClient.$transaction = async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prismaClient));
  prismaClient.message = { create: async ({ select }: any) => ({ id: "msg-1", receiverId: "student-bulk-1", ...select }) };
  prismaClient.notification.createMany = async () => ({ count: 1 });
  prismaClient.interventionCampaign.create = async () => ({ id: "campaign-1" });
  prismaClient.interventionCase.upsert = async () => ({ id: "case-1" });

  try {
    const app = express();
    app.use(express.json());
    app.use("/", messageRoutes);

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await requestAs(app, "203.0.113.50");
      statuses.push(res.status);
    }

    assert.deepEqual(statuses.slice(0, 5), [201, 201, 201, 201, 201]);
    assert.equal(statuses[5], 429);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.school.findUnique = original.schoolFindUnique;
    prismaClient.user.findMany = original.userFindMany;
    prismaClient.$transaction = original.transaction;
    prismaClient.notification.createMany = original.notificationCreateMany;
    prismaClient.interventionCampaign.create = original.interventionCampaignCreate;
    prismaClient.interventionCase.upsert = original.interventionCaseUpsert;
  }
});
