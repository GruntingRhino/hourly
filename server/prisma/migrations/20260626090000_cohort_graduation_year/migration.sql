ALTER TABLE "Cohort"
ADD COLUMN IF NOT EXISTS "graduationYear" INTEGER;

UPDATE "Cohort"
SET "graduationYear" = CASE
  WHEN "startYear" IS NOT NULL THEN "startYear" + 4
  ELSE "endYear"
END
WHERE "graduationYear" IS NULL
  AND ("endYear" IS NOT NULL OR "startYear" IS NOT NULL);

ALTER TABLE "Cohort"
DROP COLUMN IF EXISTS "startYear",
DROP COLUMN IF EXISTS "endYear";
