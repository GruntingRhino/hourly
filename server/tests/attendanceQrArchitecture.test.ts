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

test("QR token minting is restricted to organization admins and scoped opportunities", () => {
  assert.match(routes, /router\.post\("\/opportunities\/:opportunityId\/qr-token", authenticate, requireRole\("ORG_ADMIN"\)/);
  assert.match(routes, /actor\.organizationId !== opportunity\.organizationId/);
  assert.match(routes, /expiresInMinutes < 1 \|\| expiresInMinutes > MAX_QR_TTL_MINUTES/);
  assert.match(routes, /hashAttendanceQrToken\(token\)/);
});

test("QR redemption is student-only, signed, expiring, and session-scoped", () => {
  assert.match(routes, /router\.post\("\/qr-checkin", authenticate, requireRole\("STUDENT"\)/);
  assert.match(routes, /parseAttendanceQrToken\(token, attendanceQrSecret\(\)\)/);
  assert.match(routes, /tokenRecord\.revokedAt \|\| tokenRecord\.expiresAt <= new Date\(\)/);
  assert.match(routes, /where: \{ userId_opportunityId: \{ userId: req\.user!\.userId, opportunityId: parsed\.opportunityId \} \}/);
  assert.match(routes, /method: "QR"/);
  assert.match(routes, /err\?\.code === "P2002"/);
});

test("QR persistence prevents raw-token storage and per-student replay", () => {
  assert.match(schema, /model AttendanceQrToken/);
  assert.match(schema, /tokenHash\s+String\s+@unique/);
  assert.match(schema, /model AttendanceQrRedemption/);
  assert.match(schema, /@@unique\(\[tokenId, studentId\]\)/);
  assert.match(migration, /CREATE UNIQUE INDEX "AttendanceQrToken_tokenHash_key"/);
  assert.match(migration, /CREATE UNIQUE INDEX "AttendanceQrRedemption_tokenId_studentId_key"/);
});
