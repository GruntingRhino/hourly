-- Preserve rejected-email blocks when their synthetic or source school is removed.
ALTER TABLE "SchoolOwnershipBlock" ALTER COLUMN "schoolId" DROP NOT NULL;
ALTER TABLE "SchoolOwnershipBlock" DROP CONSTRAINT IF EXISTS "SchoolOwnershipBlock_schoolId_fkey";
ALTER TABLE "SchoolOwnershipBlock"
  ADD CONSTRAINT "SchoolOwnershipBlock_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
