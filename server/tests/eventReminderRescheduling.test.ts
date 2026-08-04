import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { runEventReminderCycle } from "../src/lib/eventReminders";

// Avoid real provider delivery attempts — logs instead of calling Resend.
process.env.EMAIL_DELIVERY_MODE = "log";

const prismaClient = prisma as any;

const beneficiary = {
  id: "ben-1", planTier: "FREE", name: "Food Bank", timezone: "America/Chicago",
  createdBySchoolId: null, visibility: "PUBLIC", hasSchoolComplimentaryPro: false,
  brandColor: null, logoUrl: null, emailSignature: null,
  reminderConfig: null,
};

function makeSignup(dateIso: string, startTime: string, endTime: string) {
  return {
    id: "signup-1",
    studentId: "student-1",
    cancellationToken: "cancel-token-1",
    slot: {
      id: "slot-1",
      date: new Date(dateIso),
      startTime,
      endTime,
      opportunity: {
        id: "opp-1", title: "Saturday Sort", location: "Warehouse", address: null,
        beneficiaryId: beneficiary.id,
        preparationNotes: null, arrivalInstructions: null, contactInfo: null,
        requiredFormUrl: null, requiredFormName: null, requiredFormIsRequired: false,
        beneficiary,
      },
    },
  };
}

function setupMocks(params: { signup: ReturnType<typeof makeSignup>; logStore: Map<string, any>; onSent: () => void }) {
  const { signup, logStore, onSent } = params;
  prismaClient.orgReminderConfig.findMany = async () => [];
  prismaClient.beneficiaryTimeSlot.findMany = async () => [{ id: signup.slot.id }];
  prismaClient.beneficiarySignup.findMany = async () => [signup];
  prismaClient.user.findMany = async () => [{ id: "student-1", email: "student@example.test", name: "Alex Student" }];

  prismaClient.orgEventReminderLog.findUnique = async ({ where }: any) => {
    const key = `${where.signupId_reminderType.signupId}:${where.signupId_reminderType.reminderType}`;
    return logStore.get(key) ?? null;
  };
  prismaClient.orgEventReminderLog.create = async ({ data }: any) => {
    const record = { id: `log-${logStore.size + 1}`, ...data };
    logStore.set(`${data.signupId}:${data.reminderType}`, record);
    return record;
  };
  prismaClient.orgEventReminderLog.update = async ({ where, data }: any) => {
    const existing = [...logStore.values()].find((entry) => entry.id === where.id);
    const updated = { ...existing, ...data };
    logStore.set(`${updated.signupId}:${updated.reminderType}`, updated);
    if (data.deliveryStatus === "SENT") onSent();
    return updated;
  };
}

test("a rescheduled event receives a replacement reminder instead of being suppressed by the old log", async () => {
  const original = {
    orgReminderConfig: prismaClient.orgReminderConfig.findMany,
    slot: prismaClient.beneficiaryTimeSlot.findMany,
    signup: prismaClient.beneficiarySignup.findMany,
    user: prismaClient.user.findMany,
    logFindUnique: prismaClient.orgEventReminderLog.findUnique,
    logCreate: prismaClient.orgEventReminderLog.create,
    logUpdate: prismaClient.orgEventReminderLog.update,
  };

  let sentCount = 0;
  const onSent = () => { sentCount += 1; };

  const logStore = new Map<string, any>();
  const originalDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const originalDateIso = originalDate.toISOString().slice(0, 10);

  try {
    // First run: event at its original time — sends and logs the reminder.
    setupMocks({ signup: makeSignup(originalDateIso, "10:00", "12:00"), logStore, onSent });
    await runEventReminderCycle();
    assert.equal(sentCount, 1, "expected the first reminder to send");

    const loggedEntry = logStore.get("signup-1:FREE_24H");
    assert.equal(loggedEntry.deliveryStatus, "SENT");
    const originalScheduledFor = loggedEntry.scheduledFor;

    // Event gets rescheduled to a different time the same day — a naive
    // dedup on signupId+reminderType alone would see deliveryStatus "SENT"
    // and silently skip the student, even though they've never been
    // notified about the NEW time.
    setupMocks({ signup: makeSignup(originalDateIso, "14:00", "16:00"), logStore, onSent });
    await runEventReminderCycle();

    assert.equal(sentCount, 2, "expected a replacement reminder to send after the reschedule");
    const updatedEntry = logStore.get("signup-1:FREE_24H");
    assert.equal(updatedEntry.deliveryStatus, "SENT");
    assert.notEqual(
      updatedEntry.scheduledFor.getTime(),
      originalScheduledFor.getTime(),
      "scheduledFor must be updated to reflect the new event time",
    );

    // Running again with the same (already-updated) schedule must NOT
    // resend — normal idempotency for an unchanged event.
    setupMocks({ signup: makeSignup(originalDateIso, "14:00", "16:00"), logStore, onSent });
    await runEventReminderCycle();
    assert.equal(sentCount, 2, "must not resend when the event has not changed since the last send");
  } finally {
    prismaClient.orgReminderConfig.findMany = original.orgReminderConfig;
    prismaClient.beneficiaryTimeSlot.findMany = original.slot;
    prismaClient.beneficiarySignup.findMany = original.signup;
    prismaClient.user.findMany = original.user;
    prismaClient.orgEventReminderLog.findUnique = original.logFindUnique;
    prismaClient.orgEventReminderLog.create = original.logCreate;
    prismaClient.orgEventReminderLog.update = original.logUpdate;
  }
});
