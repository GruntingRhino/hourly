-- Durable privacy-preserving blacklist for rejected school-owner emails.
CREATE TABLE "SchoolOwnershipBlock" (
  "id" TEXT NOT NULL,
  "emailHash" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolOwnershipBlock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SchoolOwnershipBlock_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SchoolOwnershipBlock_emailHash_key" ON "SchoolOwnershipBlock"("emailHash");
