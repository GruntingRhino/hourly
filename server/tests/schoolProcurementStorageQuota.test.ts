import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import schoolProcurementRoutes from "../src/routes/schoolProcurement";

// §14 storage quotas: routes/schoolProcurement.ts's document upload had a
// per-file size cap (20 MB) but no aggregate cap on total storage per
// school — a SCHOOL_ADMIN could upload an unbounded number of documents,
// growing storage indefinitely (files persist as a Postgres Bytes column).
// Mirrors the pre-existing tier-based quota pattern already used for
// beneficiary attachments.

process.env.JWT_SECRET = process.env.JWT_SECRET || "school-procurement-quota-test-secret";

const prismaClient = prisma as any;

const schoolAdmin = {
  id: "quota-admin-1",
  email: "quota-admin@example.test",
  role: "SCHOOL_ADMIN",
  status: "ACTIVE",
  tokenVersion: 0,
  schoolId: "quota-school-1",
  emailVerified: true,
};

function adminToken(): string {
  return jwt.sign({ userId: schoolAdmin.id, email: schoolAdmin.email, role: schoolAdmin.role, tv: 0 }, process.env.JWT_SECRET!);
}

async function uploadDocument(app: express.Express, fileSize: number) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    // A minimal valid PDF magic-byte header, padded to the requested size,
    // so detectMimeType's magic-byte check passes.
    const pdfHeader = Buffer.from("%PDF-1.4\n");
    const body = Buffer.concat([pdfHeader, Buffer.alloc(Math.max(0, fileSize - pdfHeader.length), 0x20)]);

    const boundary = "----quotaTestBoundary";
    const parts = [
      `--${boundary}\r\n`,
      'Content-Disposition: form-data; name="documentType"\r\n\r\nQUOTE\r\n',
      `--${boundary}\r\n`,
      'Content-Disposition: form-data; name="file"; filename="doc.pdf"\r\nContent-Type: application/pdf\r\n\r\n',
    ];
    const multipartBody = Buffer.concat([
      Buffer.from(parts.join("")),
      body,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    return await fetch(`http://127.0.0.1:${(address as any).port}/quota-school-1/documents`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${adminToken()}`,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("POST /:id/documents rejects an upload that would exceed the school's aggregate storage quota", async () => {
  const original = {
    userFindFirst: prismaClient.user.findFirst,
    schoolFindUnique: prismaClient.school.findUnique,
    docAggregate: prismaClient.schoolProcurementDocument.aggregate,
    docCreate: prismaClient.schoolProcurementDocument.create,
  };
  prismaClient.user.findFirst = async () => schoolAdmin;
  prismaClient.school.findUnique = async () => ({ billingRecord: { id: "billing-1" }, billingStatus: "ACTIVE" });
  // Already at 199 MB used; a fresh ~5 MB upload would exceed the 200 MB cap.
  prismaClient.schoolProcurementDocument.aggregate = async () => ({ _sum: { fileSizeBytes: 199 * 1024 * 1024 } });
  let createCalled = false;
  prismaClient.schoolProcurementDocument.create = async () => { createCalled = true; throw new Error("should not be called"); };

  try {
    const app = express();
    app.use(schoolProcurementRoutes);
    // Fake auth: attach req.user directly since this route uses the real
    // authenticate() middleware, which needs a mocked prisma.user.findUnique too.
    prismaClient.user.findUnique = async () => schoolAdmin;
    const res = await uploadDocument(app, 5 * 1024 * 1024);
    assert.equal(res.status, 413);
    const body = await res.json();
    assert.match(body.error, /Storage quota exceeded/);
    assert.equal(createCalled, false);
  } finally {
    prismaClient.user.findFirst = original.userFindFirst;
    prismaClient.school.findUnique = original.schoolFindUnique;
    prismaClient.schoolProcurementDocument.aggregate = original.docAggregate;
    prismaClient.schoolProcurementDocument.create = original.docCreate;
  }
});

test("POST /:id/documents allows an upload that stays within the quota", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    userFindFirst: prismaClient.user.findFirst,
    schoolFindUnique: prismaClient.school.findUnique,
    docAggregate: prismaClient.schoolProcurementDocument.aggregate,
    docCreate: prismaClient.schoolProcurementDocument.create,
  };
  prismaClient.user.findUnique = async () => schoolAdmin;
  prismaClient.user.findFirst = async () => schoolAdmin;
  prismaClient.school.findUnique = async () => ({ billingRecord: { id: "billing-1" }, billingStatus: "ACTIVE" });
  prismaClient.schoolProcurementDocument.aggregate = async () => ({ _sum: { fileSizeBytes: 1024 } });
  let createCalled = false;
  prismaClient.schoolProcurementDocument.create = async ({ data }: any) => {
    createCalled = true;
    return { id: "doc-1", documentType: data.documentType, originalName: data.originalName };
  };

  try {
    const app = express();
    app.use(schoolProcurementRoutes);
    const res = await uploadDocument(app, 1024);
    assert.equal(res.status, 201);
    assert.equal(createCalled, true);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.user.findFirst = original.userFindFirst;
    prismaClient.school.findUnique = original.schoolFindUnique;
    prismaClient.schoolProcurementDocument.aggregate = original.docAggregate;
    prismaClient.schoolProcurementDocument.create = original.docCreate;
  }
});
