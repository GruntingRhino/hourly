import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import beneficiaryRoutes from "../src/routes/beneficiaries";

const prismaClient = prisma as any;

const benAdmin = { id: "ben-admin-1", email: "admin@example.test", role: "BENEFICIARY_ADMIN", beneficiaryId: "beneficiary-1" };

function makeSignup(status: string, slotDate: Date) {
  return {
    id: "signup-1",
    studentId: "student-1",
    status,
    slot: {
      id: "slot-1",
      date: slotDate,
      endTime: "10:00",
      opportunity: { id: "opp-1", title: "Food bank shift", beneficiaryId: "beneficiary-1" },
    },
  };
}

async function requestAs(app: express.Express, path: string, body: unknown) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const token = jwt.sign({ userId: benAdmin.id, email: benAdmin.email, role: benAdmin.role, tv: 0 }, process.env.JWT_SECRET!);
    return await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function setupMocks(signup: ReturnType<typeof makeSignup>) {
  prismaClient.user.findUnique = async ({ where }: any) =>
    where.id === benAdmin.id
      ? { id: benAdmin.id, email: benAdmin.email, role: benAdmin.role, status: "ACTIVE", tokenVersion: 0, beneficiaryId: benAdmin.beneficiaryId, emailVerified: true, school: null }
      : null;
  prismaClient.beneficiarySignup.findUnique = async () => signup;
  prismaClient.beneficiarySignup.update = async ({ data }: any) => ({ ...signup, ...data });
  prismaClient.beneficiaryAuditLog.create = async () => ({});
  prismaClient.notification.create = async () => ({});
}

test("marking no-show before the event ends is rejected without an early override", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    signupFindUnique: prismaClient.beneficiarySignup.findUnique,
    signupUpdate: prismaClient.beneficiarySignup.update,
  };
  const futureSlotDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  setupMocks(makeSignup("CONFIRMED", futureSlotDate));
  let updateCalled = false;
  const originalUpdate = prismaClient.beneficiarySignup.update;
  prismaClient.beneficiarySignup.update = async (...args: any[]) => { updateCalled = true; return originalUpdate(...args); };

  try {
    const app = express();
    app.use(express.json());
    app.use("/api/beneficiaries", beneficiaryRoutes);
    const res = await requestAs(app, "/api/beneficiaries/signups/signup-1/no-show", {});
    assert.equal(res.status, 400);
    const body = await res.json() as { earlyOverrideRequired?: boolean };
    assert.equal(body.earlyOverrideRequired, true);
    assert.equal(updateCalled, false);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiarySignup.findUnique = original.signupFindUnique;
    prismaClient.beneficiarySignup.update = original.signupUpdate;
  }
});

test("marking no-show before the event ends succeeds with earlyOverride + reason", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    signupFindUnique: prismaClient.beneficiarySignup.findUnique,
    signupUpdate: prismaClient.beneficiarySignup.update,
  };
  const futureSlotDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  setupMocks(makeSignup("CONFIRMED", futureSlotDate));

  try {
    const app = express();
    app.use(express.json());
    app.use("/api/beneficiaries", beneficiaryRoutes);
    const res = await requestAs(app, "/api/beneficiaries/signups/signup-1/no-show", {
      earlyOverride: true,
      earlyOverrideReason: "Student texted to say they can't make it.",
    });
    assert.equal(res.status, 200);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiarySignup.findUnique = original.signupFindUnique;
    prismaClient.beneficiarySignup.update = original.signupUpdate;
  }
});

test("marking no-show after the event has ended does not require the override", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    signupFindUnique: prismaClient.beneficiarySignup.findUnique,
    signupUpdate: prismaClient.beneficiarySignup.update,
  };
  const pastSlotDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  setupMocks(makeSignup("CONFIRMED", pastSlotDate));

  try {
    const app = express();
    app.use(express.json());
    app.use("/api/beneficiaries", beneficiaryRoutes);
    const res = await requestAs(app, "/api/beneficiaries/signups/signup-1/no-show", {});
    assert.equal(res.status, 200);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiarySignup.findUnique = original.signupFindUnique;
    prismaClient.beneficiarySignup.update = original.signupUpdate;
  }
});
