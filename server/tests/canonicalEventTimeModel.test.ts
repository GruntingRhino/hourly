import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import { computeSlotTimestamps, slotDateTime } from "../src/lib/icsGenerator";
import beneficiaryRoutes from "../src/routes/beneficiaries";

// §7 canonical event-time model: BeneficiaryTimeSlot.startsAt/.endsAt are
// precomputed, DST-correct UTC instants derived from date+startTime/
// endTime+the owning Beneficiary's timezone. Every write path that sets
// those three fields now also computes and stores startsAt/endsAt; read
// consumers (lib/eventReminders.ts, routes/beneficiaries.ts's waitlist
// auto-promotion check) prefer the stored value, falling back to the same
// live slotDateTime() conversion for any row that predates the backfill.

process.env.JWT_SECRET = process.env.JWT_SECRET || "canonical-event-time-test-secret";

const prismaClient = prisma as any;

// Regression test for a real, already-live bug found while building this
// feature: slotDateTime used to re-derive slotDate's calendar date by
// reformatting it through the target timezone via Intl.DateTimeFormat.
// Every caller stores `date` as UTC midnight (e.g. new Date("2026-09-05")).
// UTC midnight, viewed in any timezone behind UTC, always lands on the
// *previous* calendar day — and every real Beneficiary row's timezone is
// the schema default, America/New_York, which is behind UTC year-round.
// This silently shifted every event reminder email, ICS calendar invite,
// and waitlist auto-promotion cutoff check one day earlier than the
// actual event date, for every beneficiary in production. Fixed by
// reading slotDate's calendar fields directly with the UTC getters
// instead of reformatting through the timezone.
test("slotDateTime does not shift the calendar date backward for a timezone behind UTC (regression)", () => {
  const utcMidnight = new Date("2026-09-05T00:00:00Z");
  const result = slotDateTime(utcMidnight, "09:00", "America/New_York");
  assert.equal(result.getUTCFullYear(), 2026);
  assert.equal(result.getUTCMonth(), 8); // September (0-indexed)
  // Before the fix this was 4 (Sept 4) — one day early — instead of 5.
  assert.equal(result.getUTCDate(), 5);
});

test("computeSlotTimestamps derives both startsAt and endsAt via slotDateTime, DST-correctly", () => {
  const date = new Date("2026-08-15T00:00:00Z");
  const { startsAt, endsAt } = computeSlotTimestamps(date, "09:00", "13:00", "America/New_York");
  // August is EDT (UTC-4): 9:00 AM local -> 13:00 UTC, 1:00 PM local -> 17:00 UTC.
  assert.equal(startsAt.toISOString(), "2026-08-15T13:00:00.000Z");
  assert.equal(endsAt.toISOString(), "2026-08-15T17:00:00.000Z");
  assert.equal(startsAt.toISOString(), slotDateTime(date, "09:00", "America/New_York").toISOString());
  assert.equal(endsAt.toISOString(), slotDateTime(date, "13:00", "America/New_York").toISOString());
});

const beneficiaryAdmin = {
  id: "cet-ben-admin-1",
  email: "cet-ben-admin@example.test",
  role: "BENEFICIARY_ADMIN",
  status: "ACTIVE",
  tokenVersion: 0,
  beneficiaryId: "cet-beneficiary-1",
  emailVerified: true,
};

function adminToken(): string {
  return jwt.sign({ userId: beneficiaryAdmin.id, email: beneficiaryAdmin.email, role: beneficiaryAdmin.role, tv: 0 }, process.env.JWT_SECRET!);
}

async function request(app: express.Express, method: string, path: string, body?: unknown) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    return await fetch(`http://127.0.0.1:${(address as any).port}${path}`, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${adminToken()}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("POST /:id/opportunities computes startsAt/endsAt for manually-entered time slots from the beneficiary's timezone", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    beneficiaryFindUnique: prismaClient.beneficiary.findUnique,
    oppCreate: prismaClient.beneficiaryOpportunity.create,
  };
  prismaClient.user.findUnique = async () => beneficiaryAdmin;
  prismaClient.beneficiary.findUnique = async () => ({ timezone: "America/Los_Angeles" });
  let capturedSlots: any[] = [];
  prismaClient.beneficiaryOpportunity.create = async ({ data }: any) => {
    capturedSlots = data.timeSlots.create;
    return { id: "opp-1", ...data, timeSlots: [] };
  };

  try {
    const app = express();
    app.use(express.json());
    app.use("/", beneficiaryRoutes);
    const res = await request(app, "POST", "/cet-beneficiary-1/opportunities", {
      title: "Beach Cleanup",
      description: "Come clean the beach",
      category: "environment",
      startDate: "2026-09-01",
      timeSlots: [
        { date: "2026-09-05", startTime: "10:00", endTime: "13:00", durationHours: 3, capacity: 10 },
      ],
    });
    assert.equal(res.status, 201);
    assert.equal(capturedSlots.length, 1);
    // September in America/Los_Angeles is PDT (UTC-7): 10:00 AM -> 17:00 UTC.
    assert.equal(capturedSlots[0].startsAt.toISOString(), "2026-09-05T17:00:00.000Z");
    assert.equal(capturedSlots[0].endsAt.toISOString(), "2026-09-05T20:00:00.000Z");
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiary.findUnique = original.beneficiaryFindUnique;
    prismaClient.beneficiaryOpportunity.create = original.oppCreate;
  }
});

test("PATCH /:id/slots/:slotId recomputes startsAt/endsAt when the time changes", async () => {
  const slot = {
    id: "slot-1",
    date: new Date("2026-10-10T00:00:00Z"),
    startTime: "09:00",
    endTime: "11:00",
    durationHours: 2,
    capacity: 5,
    recurringGroupId: null,
    opportunity: { beneficiaryId: "cet-beneficiary-1" },
  };
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    slotFindUnique: prismaClient.beneficiaryTimeSlot.findUnique,
    beneficiaryFindUnique: prismaClient.beneficiary.findUnique,
    transaction: prismaClient.$transaction,
  };
  prismaClient.user.findUnique = async () => beneficiaryAdmin;
  prismaClient.beneficiaryTimeSlot.findUnique = async () => slot;
  prismaClient.beneficiary.findUnique = async () => ({ timezone: "America/New_York" });
  let capturedUpdateData: any = null;
  prismaClient.$transaction = async (fn: any) => {
    const tx = {
      $executeRaw: async () => undefined,
      beneficiarySignup: { count: async () => 0 },
      beneficiaryTimeSlot: {
        update: async ({ data }: any) => {
          capturedUpdateData = data;
          return { id: slot.id, ...data };
        },
      },
    };
    return fn(tx);
  };

  try {
    const app = express();
    app.use(express.json());
    app.use("/", beneficiaryRoutes);
    const res = await request(app, "PATCH", "/cet-beneficiary-1/slots/slot-1", { startTime: "14:00", endTime: "16:00" });
    assert.equal(res.status, 200);
    assert.ok(capturedUpdateData);
    // November-adjacent October in America/New_York is still EDT (UTC-4)
    // in this date range: 14:00 local -> 18:00 UTC.
    assert.equal(new Date(capturedUpdateData.startsAt).toISOString(), "2026-10-10T18:00:00.000Z");
    assert.equal(new Date(capturedUpdateData.endsAt).toISOString(), "2026-10-10T20:00:00.000Z");
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiaryTimeSlot.findUnique = original.slotFindUnique;
    prismaClient.beneficiary.findUnique = original.beneficiaryFindUnique;
    prismaClient.$transaction = original.transaction;
  }
});
