import test from "node:test";
import assert from "node:assert/strict";
import {
  createAttendanceQrToken,
  parseAttendanceQrToken,
  hashAttendanceQrToken,
} from "../src/lib/attendanceQr";

test("creates and parses an expiring attendance QR token", () => {
  const now = new Date("2026-08-08T20:00:00.000Z");
  const token = createAttendanceQrToken({
    tokenId: "token-1",
    opportunityId: "opp-1",
    expiresAt: new Date("2026-08-08T21:00:00.000Z"),
    secret: "test-secret",
  });

  assert.deepEqual(parseAttendanceQrToken(token, "test-secret", now), {
    tokenId: "token-1",
    opportunityId: "opp-1",
    expiresAt: new Date("2026-08-08T21:00:00.000Z"),
  });
});

test("rejects a tampered, expired, or differently signed token", () => {
  const token = createAttendanceQrToken({
    tokenId: "token-1",
    opportunityId: "opp-1",
    expiresAt: new Date("2026-08-08T21:00:00.000Z"),
    secret: "test-secret",
  });

  assert.equal(parseAttendanceQrToken(`${token}x`, "test-secret", new Date("2026-08-08T20:00:00.000Z")), null);
  assert.equal(parseAttendanceQrToken(token, "wrong-secret", new Date("2026-08-08T20:00:00.000Z")), null);
  assert.equal(parseAttendanceQrToken(token, "test-secret", new Date("2026-08-08T21:00:00.001Z")), null);
});

test("hashes the raw token deterministically without storing it", () => {
  assert.equal(
    hashAttendanceQrToken("sample-token"),
    hashAttendanceQrToken("sample-token"),
  );
  assert.notEqual(hashAttendanceQrToken("sample-token"), hashAttendanceQrToken("other-token"));
});
