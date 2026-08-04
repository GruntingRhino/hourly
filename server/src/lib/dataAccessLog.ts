import type { Request } from "express";
import crypto from "crypto";
import prisma from "./prisma";
import { resolveSchoolIdFromUserAssociations } from "./userAssociations";

/**
 * Log a data access event for FERPA audit purposes.
 *
 * Deliberately fails open in the caller's favor by failing CLOSED here: this
 * throws on a write failure rather than swallowing it. Every current caller
 * awaits this before sending a response that discloses student records, so a
 * failed audit write now aborts the response (existing route try/catch blocks
 * turn the rejection into a 500) instead of releasing data with no
 * accountability trail. Do not wrap calls to this in a try/catch that
 * discards the error for a sensitive read.
 */
export async function logDataAccess(params: {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  schoolId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await prisma.dataAccessLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType ?? null,
      targetId: params.targetId ?? null,
      schoolId: params.schoolId ?? null,
      details: params.details ? JSON.stringify(params.details) : null,
    },
  });
}

/**
 * Resolve a student's school ID by checking cohort or classroom association.
 * Returns null if the student cannot be linked to a school.
 */
export async function resolveStudentSchoolId(studentId: string): Promise<string | null> {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      schoolId: true,
      cohort: { select: { schoolId: true } },
      classroom: { select: { schoolId: true } },
      cohortMemberships: {
        where: { isActive: true },
        orderBy: [{ createdAt: "asc" }],
        select: {
          cohort: { select: { schoolId: true } },
        },
      },
    },
  });
  if (!student) return null;
  return resolveSchoolIdFromUserAssociations(student);
}

export function buildRequestAuditMetadata(req: Request): Record<string, unknown> {
  const forwardedFor = req.headers["x-forwarded-for"];
  const requestIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : typeof forwardedFor === "string"
      ? forwardedFor.split(",")[0]?.trim() || null
      : req.ip || null;
  const userAgent = typeof req.headers["user-agent"] === "string"
    ? req.headers["user-agent"].trim().slice(0, 200)
    : null;

  return {
    requestIp,
    userAgent,
  };
}

let _digestKey: Buffer | null = null;

/**
 * Derive a digest key from FIELD_ENCRYPTION_KEY with domain separation, so the
 * audit-subject digest never reuses the raw field-encryption key material.
 * Falls back to a fixed non-secret salt outside production, where
 * FIELD_ENCRYPTION_KEY is optional — the digest is then not confidential, but
 * production (where it matters) always has the key configured.
 */
function getDigestKey(): Buffer {
  if (_digestKey) return _digestKey;
  const base = process.env.FIELD_ENCRYPTION_KEY ?? "dev-only-audit-digest-salt";
  _digestKey = crypto.createHash("sha256").update(`${base}:audit-subject-digest`).digest();
  return _digestKey;
}

/**
 * Summarize the students affected by a data-access event without duplicating
 * their names or emails into the audit trail. Only a count and a stable,
 * keyed digest of the subject-ID set are retained, so the audit log cannot
 * itself become an unauthoritative copy of student PII.
 */
export function summarizeStudentSubjects(
  students: Array<{ id: string }>
): Record<string, unknown> {
  const ids = [...new Set(students.map((student) => student.id))].sort();
  return {
    studentCount: ids.length,
    subjectSetDigest: crypto
      .createHmac("sha256", getDigestKey())
      .update(ids.join("\n"))
      .digest("base64url"),
  };
}
