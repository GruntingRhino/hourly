import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../src/lib/prisma";

const db = prisma as any;

test("rejected school email block survives deletion of its source school", async () => {
  const school = await db.school.create({
    data: { name: `Synthetic retention school ${Date.now()}-${Math.random()}` },
    select: { id: true },
  });
  const emailHash = `synthetic-email-hash-${Date.now()}-${Math.random()}`;
  try {
    const block = await db.schoolOwnershipBlock.create({
      data: { emailHash, schoolId: school.id, reason: "REJECTED" },
      select: { id: true, emailHash: true, schoolId: true },
    });

    await db.school.delete({ where: { id: school.id } });

    const retained = await db.schoolOwnershipBlock.findUnique({
      where: { emailHash },
      select: { id: true, emailHash: true, schoolId: true },
    });
    assert.deepEqual(retained, { id: block.id, emailHash, schoolId: null });
    await db.schoolOwnershipBlock.delete({ where: { id: block.id } });
  } catch (error) {
    await db.schoolOwnershipBlock.deleteMany({ where: { emailHash } });
    await db.school.deleteMany({ where: { id: school.id } });
    throw error;
  }
});
