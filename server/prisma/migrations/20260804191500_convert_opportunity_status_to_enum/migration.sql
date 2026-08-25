-- Convert Opportunity.status from a free-form String column to a real
-- Postgres enum (goal §17.1), matching the 3-value set already documented in
-- the schema comment (ACTIVE | CANCELLED | COMPLETED). This is the legacy
-- Opportunity model (paired with the legacy Organization model converted in
-- the prior commit), with 4 consumer files.
--
-- While auditing consumers for this conversion, found and fixed two real
-- bugs in the same file (src/routes/opportunities.ts), both fixed in the
-- same commit as this migration:
--
-- 1. GET /api/opportunities (public, unauthenticated) read
--    `status: (status as string) || "ACTIVE"` — any string from the query
--    param was passed straight into the Prisma `where` clause. Same bug
--    class as prior rounds' gaps (routes/saved.ts, routes/beneficiaries.ts,
--    routes/billing.ts, routes/messages.ts), but here on a fully public,
--    unauthenticated endpoint. Fixed with a z.enum(["ACTIVE", "CANCELLED",
--    "COMPLETED"]) validated via safeParse, returning 400 on a bad value.
--
-- 2. PUT /api/opportunities/:id (ORG_ADMIN only) built its Prisma update
--    payload via `const updateData: any = { ...req.body }` — a mass-
--    assignment vulnerability: any field of the Opportunity model
--    (including organizationId, which would transfer the opportunity to a
--    different organization) could be set by the caller, not just the
--    fields the edit form exposes. Fixed by validating req.body against
--    createSchema.partial() (the same field whitelist already used for
--    POST /api/opportunities), which does not include status or
--    organizationId — so this fix also closes off any path for this route
--    to write an invalid/unvalidated status value into the new enum column.
--
-- As with every prior enum conversion this session, Prisma's auto-generated
-- migration for this diff does DROP COLUMN / ADD COLUMN, which would
-- silently destroy existing data. Hand-written instead using the standard
-- in-place conversion (ALTER COLUMN ... TYPE ... USING col::text::enum). No
-- existing index on this column.

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'COMPLETED');

-- AlterTable: convert in place, preserving existing data.
ALTER TABLE "Opportunity"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "OpportunityStatus" USING "status"::text::"OpportunityStatus",
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
