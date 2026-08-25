import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import beneficiaryRoutes from "../src/routes/beneficiaries";

// Regression test for two gaps found while re-verifying
// docs/qa/EDGE_CASE_REPORT.md's DEFECT-002 (past dates accepted) and
// DEFECT-003 (end time before start time accepted): both had already been
// fixed for manually-entered time slots (opportunityTimeSlotSchema), but
// the recurrence-rule path (POST /:id/opportunities with a recurrenceRule)
// had neither protection — generateRecurringSlots used the caller-supplied,
// unvalidated `startDate` verbatim as its floor (a past startDate generated
// a whole recurring series dated in the past), and recurrenceRuleSchema had
// no startTime < endTime check at all.

const prismaClient = prisma as any;

const beneficiaryAdmin = {
  id: "rec-admin-1",
  email: "benadmin@example.test",
  role: "BENEFICIARY_ADMIN",
  status: "ACTIVE",
  tokenVersion: 0,
  beneficiaryId: "ben-rec-1",
  emailVerified: true,
};

async function requestAs(app: express.Express, body: unknown) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const token = jwt.sign({ userId: beneficiaryAdmin.id, email: beneficiaryAdmin.email, role: beneficiaryAdmin.role, tv: 0 }, process.env.JWT_SECRET!);
    return await fetch(`http://127.0.0.1:${(address as any).port}/ben-rec-1/opportunities`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "Weekly Food Bank Shift",
    description: "Sort and pack donations.",
    category: "food",
    startDate: "2020-01-01",
    recurrenceRule: {
      type: "monthly_day_of_week",
      daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
      weeksOfMonth: [1, 2, 3, 4, 5],
      startTime: "09:00",
      endTime: "11:00",
      durationHours: 2,
      capacity: 5,
      monthsAhead: 1,
    },
    ...overrides,
  };
}

test("POST /:id/opportunities rejects a recurrence rule with endTime before startTime", async () => {
  const original = { userFindUnique: prismaClient.user.findUnique };
  prismaClient.user.findUnique = async ({ where }: any) => (where.id === beneficiaryAdmin.id ? beneficiaryAdmin : null);
  try {
    const app = express();
    app.use(express.json());
    app.use("/", beneficiaryRoutes);
    const res = await requestAs(app, baseBody({
      recurrenceRule: { ...baseBody().recurrenceRule as object, startTime: "11:00", endTime: "09:00" },
    }));
    assert.equal(res.status, 400);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
  }
});

test("POST /:id/opportunities never generates recurring slots dated before today, even with a past startDate", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    opportunityCreate: prismaClient.beneficiaryOpportunity.create,
  };
  prismaClient.user.findUnique = async ({ where }: any) => (where.id === beneficiaryAdmin.id ? beneficiaryAdmin : null);
  let observedTimeSlots: Array<{ date: Date }> = [];
  prismaClient.beneficiaryOpportunity.create = async ({ data }: any) => {
    observedTimeSlots = data.timeSlots.create;
    return { id: "opp-rec-1", ...data };
  };
  try {
    const app = express();
    app.use(express.json());
    app.use("/", beneficiaryRoutes);
    // startDate is 2020-01-01 — years in the past.
    const res = await requestAs(app, baseBody());
    assert.equal(res.status, 201);
    assert.ok(observedTimeSlots.length > 0, "expected at least one generated slot");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const slot of observedTimeSlots) {
      assert.ok(new Date(slot.date).getTime() >= today.getTime(), `slot dated ${slot.date} is before today`);
    }
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiaryOpportunity.create = original.opportunityCreate;
  }
});
