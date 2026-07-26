-- Keep fresh databases aligned with fields already used by authentication.
-- IF NOT EXISTS makes this safe for production databases that were aligned
-- before the migration history was consolidated.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Prisma manages @updatedAt in application code; avoid a database default that
-- would otherwise leave fresh migration installs different from schema.prisma.
ALTER TABLE "InterventionCase"
ALTER COLUMN "updatedAt" DROP DEFAULT;