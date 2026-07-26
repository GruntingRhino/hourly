-- Apply SCHOOL_CREATED_BENEFICIARY_PLAN from
-- server/src/lib/schoolBeneficiaryPolicy.ts to school-created workspaces that
-- are safe to reconcile. Paid, claimed, public, or otherwise activated
-- organizations keep their existing entitlement.
UPDATE "Beneficiary"
SET "planTier" = 'FREE',
    "proActivatedAt" = NULL
WHERE "createdBySchoolId" IS NOT NULL
  AND "claimed" = FALSE
  AND "visibility" = 'PRIVATE'
  AND "planTier" = 'PRO'
  AND "proActivatedAt" IS NULL
  AND "stripeSubscriptionId" IS NULL
  AND "subscriptionStatus" = 'FREE'
  AND NOT EXISTS (
    SELECT 1
    FROM "OrganizationInvoiceRequest" AS invoice_request
    WHERE invoice_request."beneficiaryId" = "Beneficiary"."id"
  );
