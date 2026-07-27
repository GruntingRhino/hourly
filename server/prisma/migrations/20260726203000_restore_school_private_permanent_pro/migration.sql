-- The canonical TypeScript policy lives in
-- server/src/lib/schoolBeneficiaryPolicy.ts.
--
ALTER TABLE "Beneficiary"
ADD COLUMN "hasSchoolComplimentaryPro" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stripeEventCreatedAt" TIMESTAMP(3);

-- Every PRIVATE beneficiary automatically created for a school has permanent,
-- complimentary Pro entitlement. The marker survives later visibility changes
-- without granting Pro to beneficiaries initially created as PUBLIC.
UPDATE "Beneficiary"
SET "planTier" = 'PRO',
    "hasSchoolComplimentaryPro" = true
WHERE "createdBySchoolId" IS NOT NULL
  AND "visibility" = 'PRIVATE'
  AND ("planTier" <> 'PRO' OR "hasSchoolComplimentaryPro" = false);

CREATE UNIQUE INDEX "Beneficiary_stripeCustomerId_key"
ON "Beneficiary"("stripeCustomerId");

CREATE UNIQUE INDEX "Beneficiary_stripeSubscriptionId_key"
ON "Beneficiary"("stripeSubscriptionId");
