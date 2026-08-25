-- Convert Beneficiary.status, Beneficiary.visibility, and Beneficiary.planTier
-- from free-form String columns to real Postgres enums (goal §17.1),
-- matching the value sets already documented in each schema comment:
-- status: PENDING | ACTIVE | SUSPENDED
-- visibility: PUBLIC | PRIVATE
-- planTier: FREE | PRO
--
-- 10 consumer files (lib/orgTierGates.ts, lib/schoolActivation.ts,
-- lib/schoolBeneficiaryLink.ts, lib/invoiceEntitlementPolicy.ts,
-- routes/invitations.ts, routes/stripeWebhooks.ts, routes/billing.ts,
-- routes/schoolPartners.ts, routes/beneficiaries.ts, routes/schools.ts),
-- 22+ create/update call sites, all individually audited. Every write is an
-- inline string literal, a schema default, or a Zod-validated
-- z.enum(["PUBLIC", "PRIVATE"]) value (routes/beneficiaries.ts POST / and
-- PUT /:id) passed through schoolCreatedBeneficiaryPlan(visibility), whose
-- own parameter type is the TypeScript union "PUBLIC" | "PRIVATE" — or, in
-- the CSV bulk-import route, a ternary
-- `(row.visibility || "").trim().toUpperCase() === "PUBLIC" ? "PUBLIC" : "PRIVATE"`
-- that normalizes arbitrary CSV input down to one of exactly two literals
-- before it ever reaches Prisma. Confirmed safe by a clean tsc after the
-- Prisma-client regen. No findMany/count call in any consumer file filters
-- on a caller-controlled status/visibility/planTier value. SUSPENDED is
-- documented but currently never written by any code path (kept for
-- forward compatibility, same treatment as User.status's SUSPENDED and
-- StudentCohortMembership.source's MANUAL earlier this session). No
-- caller-controlled input reaches any of these three columns, so no
-- associated validation-gap fix was needed for this round.
--
-- As with every prior enum conversion this session, Prisma's auto-generated
-- migration for this diff does DROP COLUMN / ADD COLUMN, which would
-- silently destroy existing data. Hand-written instead using the standard
-- in-place conversion (ALTER COLUMN ... TYPE ... USING col::text::enum). No
-- existing index on any of these three columns.

-- CreateEnum
CREATE TYPE "BeneficiaryStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BeneficiaryVisibilityStatus" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "BeneficiaryPlanTierStatus" AS ENUM ('FREE', 'PRO');

-- AlterTable: convert all three columns in place, preserving existing data.
ALTER TABLE "Beneficiary"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "BeneficiaryStatus" USING "status"::text::"BeneficiaryStatus",
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER TABLE "Beneficiary"
  ALTER COLUMN "visibility" DROP DEFAULT,
  ALTER COLUMN "visibility" TYPE "BeneficiaryVisibilityStatus" USING "visibility"::text::"BeneficiaryVisibilityStatus",
  ALTER COLUMN "visibility" SET DEFAULT 'PRIVATE';

ALTER TABLE "Beneficiary"
  ALTER COLUMN "planTier" DROP DEFAULT,
  ALTER COLUMN "planTier" TYPE "BeneficiaryPlanTierStatus" USING "planTier"::text::"BeneficiaryPlanTierStatus",
  ALTER COLUMN "planTier" SET DEFAULT 'FREE';
