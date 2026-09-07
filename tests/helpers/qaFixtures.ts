/**
 * Synthetic fixtures in the disposable QA database.
 *
 * Some acceptance paths cannot be reached through the public API at all, so a
 * test that only speaks HTTP either skips them or — worse — passes having
 * exercised nothing. Two real cases in this repo:
 *
 *   - `/opportunity/:id` needs an Opportunity, and `POST /api/opportunities`
 *     requires `requireRole("ORG_ADMIN")`, a role `seed-playwright.ts` does not
 *     seed. Without a fixture the accessibility scan of that page silently
 *     scanned nothing (see docs/qa/evidence/2026-09-07-canvas-integration/
 *     prior-a11y-vacuous-opportunity-scan.txt).
 *   - An accepted procurement upload needs a `SchoolBillingRecord`, and no
 *     route in the repo creates one — it is written out of band by internal
 *     operations after a quote is reviewed.
 *
 * So these are written directly, and the safety rules are the same ones
 * `tests/security/helpers/qaDb.ts` already fails closed on — its
 * `validatedQaUrl()` is reused rather than copied, so the loopback-only and
 * `_qa`/`_test`-suffix guards cannot drift apart from the read-side checks.
 *
 * Every fixture additionally proves, by positive control, that it is writing to
 * the same database the API under test is serving. Without that a fixture could
 * land in a second, separately seeded database and the HTTP assertions would go
 * on failing for a reason no one could see.
 *
 * Nothing here may be pointed at production: it cannot connect to a non-loopback
 * host, and it refuses any database whose name does not end in `_qa` or `_test`.
 * All rows created are named with `SYNTHETIC_MARKER` and removed by the caller.
 */
import { validatedQaUrl } from "../security/helpers/qaDb";

/** student1, from seed-playwright.ts — the positive control for "same database". */
const SEEDED_CONTROL_EMAIL = "abhay.sivaram+5@gmail.com";

/** Every row these fixtures create carries this, so cleanup can be exact. */
export const SYNTHETIC_MARKER = "QA SYNTHETIC FIXTURE";

export const SYNTHETIC_OPPORTUNITY_TITLE = `${SYNTHETIC_MARKER} — Park Cleanup`;

/* eslint-disable @typescript-eslint/no-explicit-any */
type QaClient = any;

async function withQaDb<T>(fn: (db: QaClient) => Promise<T>): Promise<T> {
  const url = validatedQaUrl();
  // Imported lazily so specs that never touch the database don't pay for, or
  // depend on, a Prisma client.
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    await assertServesApiUnderTest(db);
    return await fn(db);
  } finally {
    await db.$disconnect();
  }
}

/**
 * Fails loudly when `QA_DATABASE_URL` is not the seeded database the API is
 * serving. A fixture written into the wrong database is worse than no fixture:
 * the HTTP assertion still fails, but for a reason that looks like a product bug.
 */
async function assertServesApiUnderTest(db: QaClient): Promise<void> {
  const control = await db.user.findFirst({
    where: { email: { equals: SEEDED_CONTROL_EMAIL, mode: "insensitive" } },
    select: { id: true },
  });
  if (!control) {
    throw new Error(
      `QA_DATABASE_URL does not contain the seeded account ${SEEDED_CONTROL_EMAIL}, so it is ` +
      "not the database the API under test is serving. Fixtures written there would be " +
      "invisible to the API. Point it at the seeded disposable QA database, e.g.\n" +
      "  QA_DATABASE_URL='postgresql://…@127.0.0.1:5433/goodhours_qa?schema=public'",
    );
  }
}

// ── Opportunity ──────────────────────────────────────────────────────────────

export interface SyntheticOpportunity {
  organizationId: string;
  opportunityId: string;
  title: string;
}

/**
 * Creates an ACTIVE Opportunity (and the Organization it must belong to) so
 * `/opportunity/:id` renders. Returns the ids needed to navigate and clean up.
 */
export async function createSyntheticOpportunity(): Promise<SyntheticOpportunity> {
  return withQaDb(async (db) => {
    const organization = await db.organization.create({
      data: {
        name: `${SYNTHETIC_MARKER} Organization`,
        email: "qa.synthetic.org@example.invalid",
        description: "Created by the accessibility suite; removed in the same test.",
        status: "APPROVED",
      },
      select: { id: true },
    });

    // Dated ahead so the detail page renders as an upcoming, joinable opportunity
    // rather than a past one, which is the state the scan should cover.
    const date = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const opportunity = await db.opportunity.create({
      data: {
        title: SYNTHETIC_OPPORTUNITY_TITLE,
        description: "Synthetic opportunity used to exercise the opportunity detail page.",
        location: "Community Park",
        date,
        startTime: "10:00 AM",
        endTime: "1:00 PM",
        durationHours: 3,
        capacity: 10,
        status: "ACTIVE",
        organizationId: organization.id,
      },
      select: { id: true },
    });

    return {
      organizationId: organization.id,
      opportunityId: opportunity.id,
      title: SYNTHETIC_OPPORTUNITY_TITLE,
    };
  });
}

export async function deleteSyntheticOpportunity(fixture: SyntheticOpportunity): Promise<void> {
  await withQaDb(async (db) => {
    // Dependent rows first; a student may have saved or signed up during the test.
    await db.savedOpportunity.deleteMany({ where: { opportunityId: fixture.opportunityId } });
    await db.signup.deleteMany({ where: { opportunityId: fixture.opportunityId } });
    await db.opportunity.deleteMany({ where: { id: fixture.opportunityId } });
    await db.organization.deleteMany({ where: { id: fixture.organizationId } });
  });
}

// ── School procurement billing record ────────────────────────────────────────

export interface SyntheticBillingRecord {
  billingRecordId: string;
  schoolId: string;
  /** False when the school already had a record, so cleanup leaves it alone. */
  createdHere: boolean;
}

/**
 * Ensures the school has a `SchoolBillingRecord`, which is the business
 * precondition an accepted procurement upload is gated on.
 */
export async function ensureSyntheticBillingRecord(schoolId: string): Promise<SyntheticBillingRecord> {
  return withQaDb(async (db) => {
    const existing = await db.schoolBillingRecord.findUnique({
      where: { schoolId },
      select: { id: true },
    });
    if (existing) {
      return { billingRecordId: existing.id, schoolId, createdHere: false };
    }
    const created = await db.schoolBillingRecord.create({
      data: {
        schoolId,
        billingStatus: "QUOTE_REQUESTED",
        internalNotes: `${SYNTHETIC_MARKER} — created by tests/security/10-uploads.spec.ts`,
      },
      select: { id: true },
    });
    return { billingRecordId: created.id, schoolId, createdHere: true };
  });
}

export async function removeSyntheticBillingRecord(fixture: SyntheticBillingRecord): Promise<void> {
  await withQaDb(async (db) => {
    // Documents are removed either way — they were uploaded by the test.
    await db.schoolProcurementDocument.deleteMany({
      where: { billingRecordId: fixture.billingRecordId },
    });
    if (!fixture.createdHere) return;
    await db.schoolBillingAuditLog.deleteMany({ where: { billingRecordId: fixture.billingRecordId } });
    await db.schoolBillingRecord.deleteMany({ where: { id: fixture.billingRecordId } });
  });
}

/**
 * Reads back a stored procurement document. Proves the upload was persisted
 * with the school and uploader the request carried, which the 201 body alone
 * does not show.
 */
export async function readProcurementDocumentRow(docId: string): Promise<{
  id: string;
  schoolId: string;
  documentType: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedByUserId: string | null;
  contentByteLength: number;
} | null> {
  return withQaDb(async (db) => {
    const row = await db.schoolProcurementDocument.findUnique({ where: { id: docId } });
    if (!row) return null;
    return {
      id: row.id,
      schoolId: row.schoolId,
      documentType: row.documentType,
      originalName: row.originalName,
      mimeType: row.mimeType,
      fileSizeBytes: row.fileSizeBytes,
      uploadedByUserId: row.uploadedByUserId ?? null,
      contentByteLength: row.contentBytes ? Buffer.from(row.contentBytes).length : 0,
    };
  });
}
