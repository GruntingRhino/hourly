-- Convert User.status from a free-form String column to a real Postgres
-- enum (goal §17.1), matching the 3-value set already documented in the
-- schema comment (ACTIVE | SUSPENDED | REVOKED). This is the highest-risk
-- enum conversion of this session's §17.1 work: 29 consumer files, 35
-- create/update call sites, and 50 findMany/findFirst call sites, all
-- individually audited before writing this migration (not just grepped).
--
-- Every write site is an inline string literal or omits `status` entirely
-- (relying on the schema default); the one route where a caller-supplied
-- object reaches prisma.user.update (PUT /api/auth/profile) builds its
-- `updateData` object explicitly field-by-field from profileSchema-parsed
-- values (name, phone, grade, notificationPreferences, messagePreferences)
-- rather than spreading req.body, so status can never reach it regardless
-- of what profileSchema allows. No findMany/findFirst call in any of the 29
-- files filters on a caller-controlled status value — the few `status` hits
-- near User query sites are HTTP status codes on thrown errors
-- (`Object.assign(new Error(...), { status: 403 })`), not the User model
-- field. SUSPENDED is documented but currently never written by any code
-- path (kept in the enum for forward compatibility, matching the existing
-- schema comment). Two call sites gate authentication directly on this
-- column (`user.status !== "ACTIVE"` in lib/schoolAuthority.ts and
-- routes/auth.ts) — pure read comparisons, unaffected by the type change.
-- No caller-controlled input reaches this column, so no associated
-- validation-gap fix was needed for this round.
--
-- As with every prior enum conversion this session, Prisma's auto-generated
-- migration for this diff does DROP COLUMN / ADD COLUMN, which would
-- silently destroy existing data. Hand-written instead using the standard
-- in-place conversion (ALTER COLUMN ... TYPE ... USING col::text::enum). No
-- existing index on this column (User has indexes on schoolId, cohortId,
-- classroomId, beneficiaryId, organizationId — not status).

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- AlterTable: convert in place, preserving existing data.
ALTER TABLE "User"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "UserStatus" USING "status"::text::"UserStatus",
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
