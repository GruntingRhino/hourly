-- Strengthens the ServiceSession_verified_requires_checkout constraint
-- (added earlier this session) to match docs/qa/DATA_INTEGRITY_REPORT.md's
-- Issue 3 exactly: the report's suggested invariant requires a VERIFIED
-- session to have BOTH a checkInTime and a checkOutTime, but the
-- constraint as originally written only required checkOutTime. The
-- application layer (routes/verification.ts) already guarantees checkInTime
-- is set before checkOutTime can be (checkout requires status =
-- "CHECKED_IN", which is only reachable after check-in sets checkInTime),
-- so this closes the same direct-database-write threat model the original
-- migration described, just for the one field it missed.
--
-- Confirmed zero existing violations by querying the real dev database
-- directly (SELECT ... WHERE status = 'VERIFIED' AND "checkInTime" IS NULL
-- returned 0 rows) before writing this migration. Kept NOT VALID anyway,
-- matching the original migration's caution, so this cannot fail to apply
-- even if some other environment has a legacy violation; NOT VALID still
-- applies the check to all new/updated rows going forward.

-- Drop and replace with the stronger version (same constraint name is
-- reused so this doesn't leave the weaker constraint behind).
ALTER TABLE "ServiceSession" DROP CONSTRAINT IF EXISTS "ServiceSession_verified_requires_checkout";

ALTER TABLE "ServiceSession"
ADD CONSTRAINT "ServiceSession_verified_requires_checkout"
CHECK (status <> 'VERIFIED' OR ("checkInTime" IS NOT NULL AND "checkOutTime" IS NOT NULL))
NOT VALID;

-- To validate against existing data once any legacy violations are repaired:
-- ALTER TABLE "ServiceSession" VALIDATE CONSTRAINT "ServiceSession_verified_requires_checkout";
