-- Convert StudentInvitation.status from a free-form String column to a real
-- Postgres enum (goal §17.1), matching the 4-value set already documented in
-- the schema comment (PENDING | ACCEPTED | EXPIRED | REVOKED). 6 consumer
-- files (lib/launchCenter.ts, routes/invitations.ts, routes/auth.ts,
-- services/canvasIntegration.ts, services/googleClassroomIntegration.ts,
-- routes/cohorts.ts).
--
-- Audited every write site: all `create`/`update` calls use inline string
-- literals or rely on the schema default, except one repeated pattern in
-- both integration services —
-- `status: existingInvitation.status === "REVOKED" ? "PENDING" : existingInvitation.status`
-- — which reuses the already-Prisma-typed `existingInvitation.status` field
-- on the non-matching branch; confirmed safe by a clean `tsc` after the
-- Prisma-client regen for this conversion. No caller-controlled input
-- (query param or request body) ever reaches this column, so no associated
-- validation-gap fix was needed for this round.
--
-- As with every prior enum conversion this session, Prisma's auto-generated
-- migration for this diff does DROP COLUMN / ADD COLUMN, which would
-- silently destroy existing data. Hand-written instead using the standard
-- in-place conversion (ALTER COLUMN ... TYPE ... USING col::text::enum). No
-- existing index on this column.

-- CreateEnum
CREATE TYPE "StudentInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- AlterTable: convert in place, preserving existing data.
ALTER TABLE "StudentInvitation"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "StudentInvitationStatus" USING "status"::text::"StudentInvitationStatus",
  ALTER COLUMN "status" SET DEFAULT 'PENDING';
