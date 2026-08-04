import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import beneficiaryRoutes from "../src/routes/beneficiaries";

const prismaClient = prisma as any;

const benAdmin = { id: "ben-admin-1", email: "admin@example.test", role: "BENEFICIARY_ADMIN", beneficiaryId: "beneficiary-1" };

function pastSlotSignup(status: string) {
  return {
    id: "signup-1",
    studentId: "student-1",
    status,
    verificationStatus: "PENDING",
    totalHours: null,
    slot: {
      id: "slot-1",
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      endTime: "10:00",
      durationHours: 3,
      opportunity: { id: "opp-1", title: "Food bank shift", beneficiaryId: "beneficiary-1", category: null },
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

function setupMocks(signup: ReturnType<typeof pastSlotSignup>) {
  prismaClient.user.findUnique = async ({ where }: any) =>
    where.id === benAdmin.id
      ? { id: benAdmin.id, email: benAdmin.email, role: benAdmin.role, status: "ACTIVE", tokenVersion: 0, beneficiaryId: benAdmin.beneficiaryId, emailVerified: true, school: null }
      : null;
  prismaClient.beneficiary = prismaClient.beneficiary ?? {};
  prismaClient.beneficiary.findFirst = async () => null;
  prismaClient.beneficiarySignup.findUnique = async () => signup;
  prismaClient.beneficiarySignup.update = async ({ data }: any) => ({ ...signup, ...data });
  prismaClient.beneficiaryAuditLog.create = async ({ data }: any) => data;
  prismaClient.notification.create = async () => ({});
}

test("approving a NO_SHOW signup without the override is rejected", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    signupFindUnique: prismaClient.beneficiarySignup.findUnique,
    signupUpdate: prismaClient.beneficiarySignup.update,
    auditCreate: prismaClient.beneficiaryAuditLog.create,
    notificationCreate: prismaClient.notification.create,
  };
  const signup = pastSlotSignup("NO_SHOW");
  setupMocks(signup);
  let updateCalled = false;
  const originalUpdate = prismaClient.beneficiarySignup.update;
  prismaClient.beneficiarySignup.update = async (...args: any[]) => {
    updateCalled = true;
    return originalUpdate(...args);
  };

  try {
    const app = express();
    app.use(express.json());
    app.use("/api/beneficiaries", beneficiaryRoutes);
    const res = await requestAs(app, "/api/beneficiaries/signups/signup-1/approve", {});
    assert.equal(res.status, 400);
    const body = await res.json() as { noShowOverrideRequired?: boolean };
    assert.equal(body.noShowOverrideRequired, true);
    assert.equal(updateCalled, false, "a NO_SHOW signup must not be silently approved without the override");
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiarySignup.findUnique = original.signupFindUnique;
    prismaClient.beneficiarySignup.update = original.signupUpdate;
    prismaClient.beneficiaryAuditLog.create = original.auditCreate;
    prismaClient.notification.create = original.notificationCreate;
  }
});

test("approving a NO_SHOW signup with overrideNoShow but no reason is rejected", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    signupFindUnique: prismaClient.beneficiarySignup.findUnique,
    signupUpdate: prismaClient.beneficiarySignup.update,
    auditCreate: prismaClient.beneficiaryAuditLog.create,
    notificationCreate: prismaClient.notification.create,
  };
  const signup = pastSlotSignup("NO_SHOW");
  setupMocks(signup);

  try {
    const app = express();
    app.use(express.json());
    app.use("/api/beneficiaries", beneficiaryRoutes);
    const res = await requestAs(app, "/api/beneficiaries/signups/signup-1/approve", { overrideNoShow: true });
    assert.equal(res.status, 400);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiarySignup.findUnique = original.signupFindUnique;
    prismaClient.beneficiarySignup.update = original.signupUpdate;
    prismaClient.beneficiaryAuditLog.create = original.auditCreate;
    prismaClient.notification.create = original.notificationCreate;
  }
});

test("approving a NO_SHOW signup with overrideNoShow + reason succeeds and is audited", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    signupFindUnique: prismaClient.beneficiarySignup.findUnique,
    signupUpdate: prismaClient.beneficiarySignup.update,
    auditCreate: prismaClient.beneficiaryAuditLog.create,
    notificationCreate: prismaClient.notification.create,
  };
  const signup = pastSlotSignup("NO_SHOW");
  setupMocks(signup);
  let auditedAction: string | null = null;
  let auditedDetails: any = null;
  prismaClient.beneficiaryAuditLog.create = async ({ data }: any) => {
    auditedAction = data.action;
    auditedDetails = JSON.parse(data.details);
    return data;
  };

  try {
    const app = express();
    app.use(express.json());
    app.use("/api/beneficiaries", beneficiaryRoutes);
    const res = await requestAs(app, "/api/beneficiaries/signups/signup-1/approve", {
      overrideNoShow: true,
      noShowOverrideReason: "Staff mis-marked attendance; volunteer has photo evidence.",
      overrideCap: true,
    });
    assert.equal(res.status, 200);
    assert.equal(auditedAction, "NO_SHOW_OVERRIDE_APPROVED");
    assert.equal(auditedDetails.noShowOverride, true);
    assert.match(auditedDetails.noShowOverrideReason, /mis-marked/);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiarySignup.findUnique = original.signupFindUnique;
    prismaClient.beneficiarySignup.update = original.signupUpdate;
    prismaClient.beneficiaryAuditLog.create = original.auditCreate;
    prismaClient.notification.create = original.notificationCreate;
  }
});

test("approving a normal CONFIRMED signup does not require the no-show override", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    signupFindUnique: prismaClient.beneficiarySignup.findUnique,
    signupUpdate: prismaClient.beneficiarySignup.update,
    auditCreate: prismaClient.beneficiaryAuditLog.create,
    notificationCreate: prismaClient.notification.create,
  };
  const signup = pastSlotSignup("CONFIRMED");
  setupMocks(signup);

  try {
    const app = express();
    app.use(express.json());
    app.use("/api/beneficiaries", beneficiaryRoutes);
    const res = await requestAs(app, "/api/beneficiaries/signups/signup-1/approve", { overrideCap: true });
    assert.equal(res.status, 200);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiarySignup.findUnique = original.signupFindUnique;
    prismaClient.beneficiarySignup.update = original.signupUpdate;
    prismaClient.beneficiaryAuditLog.create = original.auditCreate;
    prismaClient.notification.create = original.notificationCreate;
  }
});
