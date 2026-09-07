// Local QA fixture helper: creates a disposable pending SCHOOL_ADMIN in the
// disposable test database and writes its session token to a temp file.
// Never prints the token. Delete the fixture with `--cleanup <userId>`.
import fs from "node:fs";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma";
import { signUserToken } from "../src/middleware/auth";

const db = prisma as any;
const OUT = "/tmp/goodhours-qa-pending-admin.json";

async function main() {
  if (process.argv[2] === "--reset-cooldown") {
    const { schoolId } = JSON.parse(fs.readFileSync(OUT, "utf8"));
    await db.school.update({ where: { id: schoolId }, data: { ownershipApprovalLastSentAt: null } });
    return;
  }
  if (process.argv[2] === "--set-status") {
    const { schoolId } = JSON.parse(fs.readFileSync(OUT, "utf8"));
    const status = process.argv[3];
    if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) throw new Error("unsupported ownership status");
    await db.school.update({ where: { id: schoolId }, data: { ownershipStatus: status, verified: status === "APPROVED" } });
    return;
  }
  const cleanupId = process.argv[3];
  if (process.argv[2] === "--cleanup" && cleanupId) {
    await db.school.deleteMany({ where: { createdById: cleanupId } });
    await db.user.deleteMany({ where: { id: cleanupId } });
    fs.rmSync(OUT, { force: true });
    console.log("cleaned up", cleanupId);
    return;
  }
  const email = `qa-pending-admin-${Date.now()}@example.invalid`;
  // Random throwaway credential generated locally; written only to a 0600 temp
  // file for the browser run and never logged.
  const password = `Qa${crypto.randomBytes(12).toString("base64url")}!1`;
  const user = await db.user.create({
    data: { email, passwordHash: await bcrypt.hash(password, 8), name: "QA Pending Admin", role: "SCHOOL_ADMIN", emailVerified: true },
    select: { id: true, email: true, role: true, tokenVersion: true },
  });
  const school = await db.school.create({
    data: { name: "QA Pending Approval School", verified: false, ownershipStatus: "PENDING", createdById: user.id },
    select: { id: true },
  });
  await db.user.update({ where: { id: user.id }, data: { schoolId: school.id } });
  fs.writeFileSync(OUT, JSON.stringify({
    email,
    password,
    schoolId: school.id,
    token: signUserToken(user),
    user: { id: user.id, email: user.email, name: "QA Pending Admin", role: "SCHOOL_ADMIN", schoolId: school.id, school: { id: school.id, name: "QA Pending Approval School", ownershipStatus: "PENDING", verified: false }, requiresEligibilityAttestation: false },
  }), { mode: 0o600 });
  console.log(JSON.stringify({ userId: user.id, schoolId: school.id, tokenFile: OUT }));
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
