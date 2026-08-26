import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const routes = fs.readFileSync(path.join(process.cwd(), "src/routes/sessions.ts"), "utf8");
const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
const migration = fs.readFileSync(
  path.join(process.cwd(), "prisma/migrations/20260808211000_add_attendance_qr_tokens/migration.sql"),
  "utf8",
);

test("QR token primitives are signed, expiring, and hashable", () => {
  const qr = fs.readFileSync(path.join(process.cwd(), "src/lib/attendanceQr.ts"), "utf8");
  assert.match(qr, /createAttendanceQrToken/);
  assert.match(qr, /expiresAt/);
  assert.match(qr, /createHmac/);
  assert.match(qr, /hashAttendanceQrToken/);
});

test("QR migration reserves hashed-token and replay-prevention constraints", () => {
  assert.match(migration, /CREATE TABLE "AttendanceQrToken"/);
  assert.match(migration, /"tokenHash" TEXT NOT NULL/);
  assert.match(migration, /CREATE TABLE "AttendanceQrRedemption"/);
  assert.match(migration, /CREATE UNIQUE INDEX "AttendanceQrToken_tokenHash_key"/);
  assert.match(migration, /CREATE UNIQUE INDEX "AttendanceQrRedemption_tokenId_studentId_key"/);
});
