import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import prisma from "../src/lib/prisma";
import beneficiaryRoutes from "../src/routes/beneficiaries";

const prismaClient = prisma as any;

const baseSignup = {
  id: "signup-1",
  studentId: "student-1",
  slotId: "slot-1",
  // WAITLISTED avoids exercising waitlist-promotion machinery here — that path
  // is covered separately by waitlistPromotionPolicy tests.
  status: "WAITLISTED",
  verificationStatus: "PENDING",
  cancellationToken: "valid-token",
  slot: {
    date: new Date("2026-09-01"),
    startTime: "09:00",
    endTime: "10:00",
    opportunity: { title: "Food bank shift", beneficiaryId: "beneficiary-1" },
  },
};

async function requestApp(app: express.Express, path: string, method: "GET" | "POST") {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    return await fetch(`http://127.0.0.1:${address.port}${path}`, { method });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("GET on a public cancellation link never mutates the signup", async () => {
  const original = { findUnique: prismaClient.beneficiarySignup.findUnique };
  let updateCalled = false;
  prismaClient.beneficiarySignup.findUnique = async () => ({ ...baseSignup });
  // If GET ever reaches update/transaction machinery, this proves the mutation ran.
  prismaClient.beneficiarySignup.update = async () => {
    updateCalled = true;
    throw new Error("GET must never call update");
  };

  try {
    const app = express();
    app.use("/api/beneficiaries", beneficiaryRoutes);

    const res = await requestApp(app, "/api/beneficiaries/cancel/valid-token", "GET");
    assert.equal(res.status, 200);
    const body = await res.json() as { requiresConfirmation: boolean; opportunityTitle: string };
    assert.equal(body.requiresConfirmation, true);
    assert.equal(body.opportunityTitle, "Food bank shift");
    assert.equal(updateCalled, false, "GET must not mutate the signup");
  } finally {
    prismaClient.beneficiarySignup.findUnique = original.findUnique;
  }
});

test("POST on the cancellation link consumes the token and cancels the signup", async () => {
  const original = { findUnique: prismaClient.beneficiarySignup.findUnique, transaction: prismaClient.$transaction };
  let updatedStatus: string | null = null;

  prismaClient.beneficiarySignup.findUnique = async ({ select }: any) => {
    if (select) {
      return { status: baseSignup.status, cancellationToken: baseSignup.cancellationToken, verificationStatus: baseSignup.verificationStatus };
    }
    return { ...baseSignup };
  };

  prismaClient.$transaction = async (fn: any) => {
    const tx = {
      $executeRaw: async () => 1,
      beneficiarySignup: {
        findUnique: prismaClient.beneficiarySignup.findUnique,
        update: async ({ data }: any) => {
          updatedStatus = data.status;
          return { ...baseSignup, ...data };
        },
        findMany: async () => [],
      },
      beneficiaryAuditLog: { create: async () => ({}) },
      beneficiaryTimeSlot: {
        findUnique: async () => ({ id: "slot-1", capacity: 1, opportunity: { title: "Food bank shift" } }),
      },
    };
    return fn(tx);
  };

  try {
    const app = express();
    app.use("/api/beneficiaries", beneficiaryRoutes);

    const res = await requestApp(app, "/api/beneficiaries/cancel/valid-token", "POST");
    assert.equal(res.status, 200);
    assert.equal(updatedStatus, "CANCELLED");
  } finally {
    prismaClient.beneficiarySignup.findUnique = original.findUnique;
    prismaClient.$transaction = original.transaction;
  }
});
