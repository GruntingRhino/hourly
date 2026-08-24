import test from "node:test";
import assert from "node:assert/strict";
import { consumeSupervisorVerificationToken, createSupervisorVerificationToken } from "../src/lib/supervisorVerification";

const baseParams = {
  verificationId: "v",
  serviceRecordId: "s",
  supervisorEmail: "coach@school.edu",
  expiresAt: new Date("2026-08-11T00:00:00Z"),
  secret: "secret",
};

test("supervisor verification is signed, school-domain authorized, and one-time", () => {
  const token = createSupervisorVerificationToken(baseParams);
  const consumedIds = new Set<string>();
  assert.equal(consumeSupervisorVerificationToken(token, { secret: "secret", now: new Date("2026-08-10T00:00:00Z"), authorizedDomains: ["school.edu"], consumedIds }).serviceRecordId, "s");
  assert.throws(() => consumeSupervisorVerificationToken(token, { secret: "secret", authorizedDomains: ["school.edu"], consumedIds }), /Expired or replayed/);
  assert.throws(() => consumeSupervisorVerificationToken(token, { secret: "secret", now: new Date("2026-08-10T00:00:00Z"), authorizedDomains: ["other.edu"], consumedIds: new Set() }), /not authorized/);
});

test("supervisor verification rejects tampering and expiry", () => {
  const token = createSupervisorVerificationToken(baseParams);
  const [encoded, signature] = token.split(".");
  const tamperedPayload = Buffer.from(JSON.stringify({ ...baseParams, serviceRecordId: "other" }), "utf8").toString("base64url");
  assert.throws(() => consumeSupervisorVerificationToken(`${tamperedPayload}.${signature}`, { secret: "secret", authorizedDomains: ["school.edu"], consumedIds: new Set() }), /Invalid verification token/);
  assert.throws(() => consumeSupervisorVerificationToken(token, { secret: "secret", now: new Date("2026-08-11T00:00:00Z"), authorizedDomains: ["school.edu"], consumedIds: new Set() }), /Expired or replayed/);
  assert.ok(encoded.length > 0);
});
