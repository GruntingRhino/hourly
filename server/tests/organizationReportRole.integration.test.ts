import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import reportsRoutes from "../src/routes/reports";
import { hashToken } from "../src/lib/tokenHash";

const db = prisma as any;
test("organization report rejects a student carrying a legacy organizationId before scope evaluation", async () => {
  const original = db.user.findUnique;
  db.user.findUnique = async ({ where }: any) => where.id === "student-1" ? { id: "student-1", role: "STUDENT", status: "ACTIVE", tokenVersion: 0, organizationId: "org-a", schoolId: null } : null;
  const app = express(); app.use(reportsRoutes);
  const server = http.createServer(app); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address === "object");
    const token = jwt.sign({ userId: "student-1", email: "student@example.test", role: "STUDENT", tv: 0 }, process.env.JWT_SECRET!);
    const response = await fetch(`http://127.0.0.1:${address.port}/organization?organizationId=org-other`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(response.status, 403);
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); db.user.findUnique = original; }
});
