/**
 * geocode-zipcentroid.ts
 *
 * Fills coordinates for BeneficiaryDirectory entries that still have no
 * lat/lng by computing the centroid of already-geocoded entries in the
 * same zip code (and falling back to SchoolDirectory zip centroids).
 *
 * This handles PO Box addresses that the Census geocoder can't resolve.
 * Zip-level precision is sufficient for map discovery purposes.
 *
 * USAGE:
 *   npx tsx server/scripts/geocode-zipcentroid.ts
 */

import prisma from "../src/lib/prisma";

async function main() {
  // Pass 1: fill from other BeneficiaryDirectory records in same zip
  const pass1: any = await prisma.$executeRaw`
    UPDATE "BeneficiaryDirectory" AS missing
    SET latitude = zc.avg_lat, longitude = zc.avg_lng, "updatedAt" = NOW()
    FROM (
      SELECT zip, AVG(latitude) AS avg_lat, AVG(longitude) AS avg_lng
      FROM "BeneficiaryDirectory"
      WHERE latitude IS NOT NULL AND zip IS NOT NULL AND zip != ''
      GROUP BY zip
    ) zc
    WHERE missing.latitude IS NULL
      AND missing.active = true
      AND missing.zip = zc.zip
  `;
  console.log(`Pass 1 (beneficiary zip centroids): ${pass1} rows filled`);

  // Pass 2: fill remaining from SchoolDirectory zip centroids
  const pass2: any = await prisma.$executeRaw`
    UPDATE "BeneficiaryDirectory" AS missing
    SET latitude = sc.avg_lat, longitude = sc.avg_lng, "updatedAt" = NOW()
    FROM (
      SELECT zip, AVG(latitude) AS avg_lat, AVG(longitude) AS avg_lng
      FROM "SchoolDirectory"
      WHERE latitude IS NOT NULL AND zip IS NOT NULL AND zip != ''
      GROUP BY zip
    ) sc
    WHERE missing.latitude IS NULL
      AND missing.active = true
      AND missing.zip = sc.zip
  `;
  console.log(`Pass 2 (school zip centroids):       ${pass2} rows filled`);

  // Summary
  const result: any[] = await prisma.$queryRaw`
    SELECT COUNT(*) AS total, COUNT(latitude) AS geocoded
    FROM "BeneficiaryDirectory" WHERE active = true
  `;
  const { total, geocoded } = result[0];
  const pct = Math.round((Number(geocoded) / Number(total)) * 100);
  console.log(`Coverage: ${geocoded} / ${total} (${pct}%)`);

  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
