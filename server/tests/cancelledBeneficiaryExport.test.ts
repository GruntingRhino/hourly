import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import reportRoutes from "../src/routes/reports";
import beneficiaryRoutes from "../src/routes/beneficiaries";
import { calculateStudentHours } from "../src/lib/hoursCalculator";

const db = prisma as any;
const ids = {
  school: "gh_hours_export_school",
  student: "gh_hours_export_student",
  beneficiary: "gh_hours_export_beneficiary",
  admin: "gh_hours_export_admin",
  opportunity: "gh_hours_export_opportunity",
  slot: "gh_hours_export_slot",
  signup: "gh_hours_export_signup",
  cancelledOpportunity: "gh_hours_export_cancelled_opportunity",
  cancelledSlot: "gh_hours_export_cancelled_slot",
  cancelledSignup: "gh_hours_export_cancelled_signup",
};

async function serverFor(app: express.Express) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as any).port;
  return { server, base: `http://127.0.0.1:${port}` };
}

function auth(userId: string, role: string) {
  return { authorization: `Bearer ${jwt.sign({ userId, email: `${userId}@example.test`, role, tv: 0 }, process.env.JWT_SECRET!)}` };
}

async function setup() {
  await db.serviceHourLedgerEntry.deleteMany({ where: { studentId: ids.student } });
  await db.notification.deleteMany({ where: { userId: { in: [ids.student, ids.admin] } } });
  await db.dataAccessLog.deleteMany({ where: { actorId: { in: [ids.student, ids.admin] } } });
  await db.beneficiarySignup.deleteMany({ where: { id: { in: [ids.signup, ids.cancelledSignup] } } });
  await db.beneficiaryTimeSlot.deleteMany({ where: { id: { in: [ids.slot, ids.cancelledSlot] } } });
  await db.beneficiaryOpportunity.deleteMany({ where: { id: { in: [ids.opportunity, ids.cancelledOpportunity] } } });
  await db.user.deleteMany({ where: { id: { in: [ids.student, ids.admin] } } });
  await db.beneficiary.deleteMany({ where: { id: ids.beneficiary } });
  await db.school.deleteMany({ where: { id: ids.school } });

  await db.school.create({ data: { id: ids.school, name: "Synthetic Hours School", ownershipStatus: "APPROVED" } });
  await db.beneficiary.create({ data: { id: ids.beneficiary, name: "Synthetic Service Org", visibility: "PRIVATE", createdBySchoolId: ids.school } });
  await db.user.create({ data: { id: ids.student, email: "gh-hours-student@example.test", name: "Synthetic Student", role: "STUDENT", schoolId: ids.school, emailVerified: true, eligibilityAttestation: { create: { eligible13Plus: true, policyVersion: "test", method: "synthetic" } } } });
  await db.user.create({ data: { id: ids.admin, email: "gh-hours-admin@example.test", name: "Synthetic Beneficiary Admin", role: "BENEFICIARY_ADMIN", beneficiaryId: ids.beneficiary, emailVerified: true, eligibilityAttestation: { create: { eligible13Plus: true, policyVersion: "test", method: "synthetic" } } } });
  await db.beneficiaryOpportunity.create({ data: { id: ids.opportunity, title: "Synthetic Correctable Event", description: "test", beneficiaryId: ids.beneficiary, startDate: new Date("2025-01-01T00:00:00Z"), category: "general" } });
  await db.beneficiaryTimeSlot.create({ data: { id: ids.slot, opportunityId: ids.opportunity, date: new Date("2025-01-03T00:00:00Z"), startTime: "10:00", endTime: "14:00", durationHours: 4 } });
  await db.beneficiarySignup.create({ data: { id: ids.signup, slotId: ids.slot, studentId: ids.student, schoolId: ids.school, status: "CONFIRMED" } });
  await db.beneficiaryOpportunity.create({ data: { id: ids.cancelledOpportunity, title: "Cancelled Synthetic Event", description: "test", beneficiaryId: ids.beneficiary, startDate: new Date("2025-01-01T00:00:00Z"), category: "general" } });
  await db.beneficiaryTimeSlot.create({ data: { id: ids.cancelledSlot, opportunityId: ids.cancelledOpportunity, date: new Date("2025-01-04T00:00:00Z"), startTime: "10:00", endTime: "14:00", durationHours: 4 } });
  await db.beneficiarySignup.create({ data: { id: ids.cancelledSignup, slotId: ids.cancelledSlot, studentId: ids.student, schoolId: ids.school, status: "CANCELLED", verificationStatus: "APPROVED", totalHours: 4 } });
}

test("PostgreSQL proves correction deltas, reversal, and cancelled-export exclusion", async () => {
  await setup();
  const app = express();
  app.use(express.json());
  app.use("/api/beneficiaries", beneficiaryRoutes);
  app.use("/api/reports", reportRoutes);
  const { server, base } = await serverFor(app);
  try {
    const headers = { ...auth(ids.admin, "BENEFICIARY_ADMIN"), "content-type": "application/json" };
    let response = await fetch(`${base}/api/beneficiaries/signups/${ids.signup}/approve`, { method: "POST", headers, body: JSON.stringify({ approvedHours: 4, overrideCap: true }) });
    assert.equal(response.status, 200, await response.text());
    response = await fetch(`${base}/api/beneficiaries/signups/${ids.signup}/approve`, { method: "POST", headers, body: JSON.stringify({ approvedHours: 2, overrideCap: true }) });
    assert.equal(response.status, 200);

    let ledger = await db.serviceHourLedgerEntry.findMany({ where: { sourceId: ids.signup }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(ledger.map((entry: any) => entry.approvedMinutes), [240, -120]);
    assert.equal(ledger.reduce((sum: number, entry: any) => sum + entry.approvedMinutes, 0), 120);
    assert.equal((await calculateStudentHours([ids.student], ids.school)).get(ids.student)?.approved, 2);

    response = await fetch(`${base}/api/beneficiaries/signups/${ids.signup}/reset-review`, { method: "POST", headers, body: "{}" });
    assert.equal(response.status, 200);
    ledger = await db.serviceHourLedgerEntry.findMany({ where: { sourceId: ids.signup }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(ledger.map((entry: any) => entry.approvedMinutes), [240, -120, -120]);
    assert.equal((await calculateStudentHours([ids.student], ids.school)).get(ids.student)?.approved ?? 0, 0);

    const exportResponse = await fetch(`${base}/api/reports/export/csv`, { headers: auth(ids.student, "STUDENT") });
    assert.equal(exportResponse.status, 200);
    const csv = await exportResponse.text();
    assert.doesNotMatch(csv, /Cancelled Synthetic Event/);
    assert.doesNotMatch(csv, /Synthetic Service Org/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await db.serviceHourLedgerEntry.deleteMany({ where: { studentId: ids.student } });
    await db.notification.deleteMany({ where: { userId: { in: [ids.student, ids.admin] } } });
    await db.dataAccessLog.deleteMany({ where: { actorId: { in: [ids.student, ids.admin] } } });
    await db.beneficiarySignup.deleteMany({ where: { id: { in: [ids.signup, ids.cancelledSignup] } } });
    await db.beneficiaryTimeSlot.deleteMany({ where: { id: { in: [ids.slot, ids.cancelledSlot] } } });
    await db.beneficiaryOpportunity.deleteMany({ where: { id: { in: [ids.opportunity, ids.cancelledOpportunity] } } });
    await db.user.deleteMany({ where: { id: { in: [ids.student, ids.admin] } } });
    await db.beneficiary.deleteMany({ where: { id: ids.beneficiary } });
    await db.school.deleteMany({ where: { id: ids.school } });
  }
});


test("serializable HTTP transactions preserve one consistent result under concurrent correction/reset", async () => {
  await setup();
  const app = express();
  app.use(express.json());
  app.use("/api/beneficiaries", beneficiaryRoutes);
  const { server, base } = await serverFor(app);
  try {
    const headers = { ...auth(ids.admin, "BENEFICIARY_ADMIN"), "content-type": "application/json" };
    let response = await fetch(`${base}/api/beneficiaries/signups/${ids.signup}/approve`, {
      method: "POST", headers, body: JSON.stringify({ approvedHours: 4, overrideCap: true }),
    });
    assert.equal(response.status, 200, await response.text());

    const [correction, reset] = await Promise.all([
      fetch(`${base}/api/beneficiaries/signups/${ids.signup}/approve`, {
        method: "POST", headers, body: JSON.stringify({ approvedHours: 2, overrideCap: true }),
      }),
      fetch(`${base}/api/beneficiaries/signups/${ids.signup}/reset-review`, {
        method: "POST", headers, body: "{}",
      }),
    ]);
    const statuses = [correction.status, reset.status].sort((a, b) => a - b);
    assert.deepEqual(statuses, [200, 500]);

    const source = await db.beneficiarySignup.findUnique({ where: { id: ids.signup } });
    const ledger = await db.serviceHourLedgerEntry.findMany({ where: { sourceId: ids.signup }, orderBy: { createdAt: "asc" } });
    assert.ok(source);
    const creditedHours = ledger.reduce((sum: number, entry: any) => sum + entry.approvedMinutes, 0) / 60;
    const sourceHours = source.verificationStatus === "APPROVED" ? (source.totalHours ?? 0) : 0;
    assert.equal(creditedHours, sourceHours);
    assert.equal(ledger.length, 2);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await db.serviceHourLedgerEntry.deleteMany({ where: { studentId: ids.student } });
    await db.notification.deleteMany({ where: { userId: { in: [ids.student, ids.admin] } } });
    await db.dataAccessLog.deleteMany({ where: { actorId: { in: [ids.student, ids.admin] } } });
    await db.beneficiarySignup.deleteMany({ where: { id: { in: [ids.signup, ids.cancelledSignup] } } });
    await db.beneficiaryTimeSlot.deleteMany({ where: { id: { in: [ids.slot, ids.cancelledSlot] } } });
    await db.beneficiaryOpportunity.deleteMany({ where: { id: { in: [ids.opportunity, ids.cancelledOpportunity] } } });
    await db.user.deleteMany({ where: { id: { in: [ids.student, ids.admin] } } });
    await db.beneficiary.deleteMany({ where: { id: ids.beneficiary } });
    await db.school.deleteMany({ where: { id: ids.school } });
  }
});

test("injected ledger failure rolls back source, audit, and ledger writes", async () => {
  await setup();
  const app = express();
  app.use(express.json());
  app.use("/api/beneficiaries", beneficiaryRoutes);
  const { server, base } = await serverFor(app);
  const originalTransaction = db.$transaction.bind(db);
  try {
    db.$transaction = async (callback: (tx: any) => Promise<unknown>, options: unknown) => originalTransaction(async (tx: any) => {
      const failingTx = new Proxy(tx, {
        get(target, property, receiver) {
          if (property === "serviceHourLedgerEntry") {
            return new Proxy(Reflect.get(target, property, receiver), {
              get(ledgerTarget, ledgerProperty, ledgerReceiver) {
                if (ledgerProperty === "create") return async () => { throw new Error("INJECTED_LEDGER_FAILURE"); };
                return Reflect.get(ledgerTarget, ledgerProperty, ledgerReceiver);
              },
            });
          }
          return Reflect.get(target, property, receiver);
        },
      });
      return callback(failingTx);
    }, options);

    const response = await fetch(`${base}/api/beneficiaries/signups/${ids.signup}/approve`, {
      method: "POST", headers: { ...auth(ids.admin, "BENEFICIARY_ADMIN"), "content-type": "application/json" },
      body: JSON.stringify({ approvedHours: 4, overrideCap: true }),
    });
    assert.equal(response.status, 500, await response.text());
    const source = await db.beneficiarySignup.findUnique({ where: { id: ids.signup } });
    const audit = await db.beneficiaryAuditLog.findMany({ where: { signupId: ids.signup } });
    const ledger = await db.serviceHourLedgerEntry.findMany({ where: { sourceId: ids.signup } });
    assert.equal(source?.verificationStatus, "PENDING");
    assert.equal(source?.status, "CONFIRMED");
    assert.equal(source?.totalHours, null);
    assert.equal(audit.length, 0);
    assert.equal(ledger.length, 0);
  } finally {
    db.$transaction = originalTransaction;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await db.serviceHourLedgerEntry.deleteMany({ where: { studentId: ids.student } });
    await db.notification.deleteMany({ where: { userId: { in: [ids.student, ids.admin] } } });
    await db.dataAccessLog.deleteMany({ where: { actorId: { in: [ids.student, ids.admin] } } });
    await db.beneficiarySignup.deleteMany({ where: { id: { in: [ids.signup, ids.cancelledSignup] } } });
    await db.beneficiaryTimeSlot.deleteMany({ where: { id: { in: [ids.slot, ids.cancelledSlot] } } });
    await db.beneficiaryOpportunity.deleteMany({ where: { id: { in: [ids.opportunity, ids.cancelledOpportunity] } } });
    await db.user.deleteMany({ where: { id: { in: [ids.student, ids.admin] } } });
    await db.beneficiary.deleteMany({ where: { id: ids.beneficiary } });
    await db.school.deleteMany({ where: { id: ids.school } });
  }
});
