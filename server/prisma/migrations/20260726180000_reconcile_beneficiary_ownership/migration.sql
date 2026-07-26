-- Keep exactly one deterministic owner for each existing organization.
WITH ranked_admins AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "beneficiaryId"
      ORDER BY
        CASE WHEN "beneficiaryAdminRole" = 'OWNER' THEN 0 ELSE 1 END,
        "createdAt" ASC,
        "id" ASC
    ) AS owner_rank
  FROM "User"
  WHERE "role" = 'BENEFICIARY_ADMIN'
    AND "beneficiaryId" IS NOT NULL
)
UPDATE "User" AS admin
SET "beneficiaryAdminRole" = CASE
  WHEN ranked_admins.owner_rank = 1 THEN 'OWNER'
  ELSE 'ADMIN'
END
FROM ranked_admins
WHERE admin."id" = ranked_admins."id";

-- Correct only unclaimed, unpaid private organizations that schools created.
-- Claimed organizations and any Stripe-backed entitlement are intentionally preserved.
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
