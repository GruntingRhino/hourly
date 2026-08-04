-- Defense-in-depth: a ServiceSession must not be VERIFIED without a
-- checkOutTime. The application layer (routes/verification.ts) already
-- enforces this, but nothing previously stopped a direct write from
-- producing the invalid combination.
--
-- Added NOT VALID so this applies immediately to all new/updated rows
-- without failing the migration if any legacy row already violates it.
-- Run the companion VALIDATE CONSTRAINT statement below once any legacy
-- violations have been identified and repaired (or confirmed not to exist).
ALTER TABLE "ServiceSession"
ADD CONSTRAINT "ServiceSession_verified_requires_checkout"
CHECK (status <> 'VERIFIED' OR "checkOutTime" IS NOT NULL)
NOT VALID;

-- To validate against existing data once any legacy violations are repaired:
-- ALTER TABLE "ServiceSession" VALIDATE CONSTRAINT "ServiceSession_verified_requires_checkout";
