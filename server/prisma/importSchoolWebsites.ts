/**
 * importSchoolWebsites.ts
 *
 * Reads server/data/school_website.csv and:
 * 1. Updates SchoolDirectory.website for matching records (by NCES ID). No new rows added.
 * 2. Upserts all schools into BeneficiaryDirectory (so they appear on the map).
 * 3. For high schools with a registered School account, links the school's
 *    private Beneficiary to its BeneficiaryDirectory entry.
 */

import { PrismaClient } from "../../node_modules/.prisma/client";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

const prisma = new PrismaClient();

interface CsvRow {
  NCESSCH: string;
  SCH_NAME: string;
  WEBSITE: string;
  LEVEL: string;
  LSTREET1: string;
  LCITY: string;
  LSTATE: string;
  LZIP: string;
  PHONE: string;
  LEA_NAME: string;
  STATENAME: string;
}

/** Pads an NCES ID to 12 digits with leading zeros */
function padNcessId(raw: string): string {
  return raw.trim().padStart(12, "0");
}

function cleanWebsite(url: string): string | null {
  const s = url.trim();
  if (!s || s === "No data" || s === "." || s === "N/A") return null;
  if (!/^https?:\/\//i.test(s)) return `http://${s}`;
  return s;
}

const BATCH_SIZE = 500;

async function main() {
  const csvPath = path.join(__dirname, "../data/school_website.csv");
  console.log("Reading CSV...");
  const raw = fs.readFileSync(csvPath, "utf-8");
  const rows: CsvRow[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
  console.log(`Parsed ${rows.length} rows from CSV`);

  // ─── Build lookup: ncessId → row ──────────────────────────────────────────
  const byNcessId = new Map<string, CsvRow>();
  for (const row of rows) {
    const id = padNcessId(row.NCESSCH);
    byNcessId.set(id, row);
  }

  // ─── Step 1: Update SchoolDirectory.website (no new rows) ─────────────────
  console.log("\nStep 1: Updating SchoolDirectory.website...");
  const dirEntries = await prisma.schoolDirectory.findMany({
    select: { id: true, ncessId: true, latitude: true, longitude: true },
  });
  console.log(`  Found ${dirEntries.length} SchoolDirectory entries`);

  // Build update pairs for entries that have a matching CSV row with a website
  const websiteUpdates: Array<{ id: string; website: string }> = [];
  const dirLatLng = new Map<string, { lat: number; lng: number }>();

  for (const entry of dirEntries) {
    if (!entry.ncessId) continue;
    if (entry.latitude != null && entry.longitude != null) {
      dirLatLng.set(entry.ncessId, { lat: entry.latitude, lng: entry.longitude });
    }
    const csvRow = byNcessId.get(entry.ncessId);
    if (!csvRow) continue;
    const website = cleanWebsite(csvRow.WEBSITE);
    if (website) websiteUpdates.push({ id: entry.id, website });
  }

  // Batch-update using raw SQL for efficiency
  let websiteUpdated = 0;
  for (let i = 0; i < websiteUpdates.length; i += BATCH_SIZE) {
    const batch = websiteUpdates.slice(i, i + BATCH_SIZE);
    for (const { id, website } of batch) {
      await prisma.schoolDirectory.update({
        where: { id },
        data: { website },
      });
    }
    websiteUpdated += batch.length;
    if (websiteUpdated % 5000 === 0 || websiteUpdated === websiteUpdates.length) {
      process.stdout.write(`  Updated ${websiteUpdated}/${websiteUpdates.length}\r`);
    }
  }
  console.log(`\n  Done. Updated website on ${websiteUpdated} SchoolDirectory rows.`);

  // ─── Step 2: Upsert all schools into BeneficiaryDirectory ─────────────────
  console.log("\nStep 2: Upserting schools into BeneficiaryDirectory...");

  // Get existing ncessIds already in BeneficiaryDirectory
  const existingBenDirIds = new Set<string>(
    (
      await prisma.$queryRawUnsafe<Array<{ ncessId: string }>>(
        `SELECT "ncessId" FROM "BeneficiaryDirectory" WHERE "ncessId" IS NOT NULL`
      )
    ).map((r: any) => r.ncessId)
  );
  console.log(`  ${existingBenDirIds.size} existing NCES entries in BeneficiaryDirectory`);

  // Prepare data for new inserts
  const toInsert: Array<{
    ncessId: string;
    name: string;
    category: string;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    latitude: number | null;
    longitude: number | null;
    website: string | null;
    phone: string | null;
    source: string;
    active: boolean;
  }> = [];

  const toUpdate: Array<{
    ncessId: string;
    website: string | null;
    latitude: number | null;
    longitude: number | null;
  }> = [];

  for (const row of rows) {
    const ncessId = padNcessId(row.NCESSCH);
    const website = cleanWebsite(row.WEBSITE);
    const coords = dirLatLng.get(ncessId) ?? null;

    if (existingBenDirIds.has(ncessId)) {
      // Will update website + coords if we have them
      toUpdate.push({ ncessId, website, latitude: coords?.lat ?? null, longitude: coords?.lng ?? null });
    } else {
      toInsert.push({
        ncessId,
        name: row.SCH_NAME,
        category: "Education",
        address: row.LSTREET1 || null,
        city: row.LCITY || null,
        state: row.LSTATE || null,
        zip: row.LZIP?.slice(0, 5) || null,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        website,
        phone: row.PHONE || null,
        source: "NCES_CCD",
        active: true,
      });
    }
  }

  console.log(`  ${toInsert.length} new schools to insert, ${toUpdate.length} to update`);

  // Bulk insert new entries in batches using createMany
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    await prisma.beneficiaryDirectory.createMany({ data: batch, skipDuplicates: true });
    inserted += batch.length;
    if (inserted % 10000 === 0 || inserted >= toInsert.length) {
      process.stdout.write(`  Inserted ${inserted}/${toInsert.length}\r`);
    }
  }
  console.log(`\n  Done inserting.`);

  // Update existing entries with website + coords
  let updated = 0;
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);
    for (const { ncessId, website, latitude, longitude } of batch) {
      await prisma.$executeRawUnsafe(
        `UPDATE "BeneficiaryDirectory"
         SET website = COALESCE($1, website),
             latitude = COALESCE($2, latitude),
             longitude = COALESCE($3, longitude)
         WHERE "ncessId" = $4`,
        website, latitude, longitude, ncessId
      );
    }
    updated += batch.length;
    if (updated % 5000 === 0 || updated >= toUpdate.length) {
      process.stdout.write(`  Updated ${updated}/${toUpdate.length}\r`);
    }
  }
  console.log(`\n  Done updating.`);

  // ─── Step 3: Link high school School accounts to BeneficiaryDirectory ──────
  console.log("\nStep 3: Linking high school accounts to BeneficiaryDirectory...");

  // Build set of NCES IDs that are high schools (LEVEL = "High")
  const highSchoolNcessIds = new Set<string>(
    rows
      .filter((r) => r.LEVEL?.trim() === "High")
      .map((r) => padNcessId(r.NCESSCH))
  );
  console.log(`  ${highSchoolNcessIds.size} high school NCES IDs in CSV`);

  // Get all School records with a directoryId
  const schoolsWithDir = await prisma.school.findMany({
    where: { directoryId: { not: null } },
    select: { id: true, directoryId: true },
  });
  console.log(`  ${schoolsWithDir.length} School accounts with a directory entry`);

  // Map schoolDirectory.id → ncessId
  const sdIdToNcessId = new Map<string, string>();
  for (const entry of dirEntries) {
    if (entry.ncessId) sdIdToNcessId.set(entry.id, entry.ncessId);
  }

  // Get BeneficiaryDirectory ncessId → id map for high schools
  const benDirByNcessId = new Map<string, string>(
    (
      await prisma.$queryRawUnsafe<Array<{ id: string; ncessId: string }>>(
        `SELECT id, "ncessId" FROM "BeneficiaryDirectory" WHERE "ncessId" IS NOT NULL`
      )
    ).map((r: any) => [r.ncessId, r.id])
  );

  let linked = 0;
  for (const school of schoolsWithDir) {
    const ncessId = sdIdToNcessId.get(school.directoryId!);
    if (!ncessId || !highSchoolNcessIds.has(ncessId)) continue;

    const benDirId = benDirByNcessId.get(ncessId);
    if (!benDirId) continue;

    // Find the school's auto-created private beneficiary
    const privateBen = await prisma.beneficiary.findFirst({
      where: { createdBySchoolId: school.id, visibility: "PRIVATE" },
      select: { id: true },
    });
    if (!privateBen) continue;

    // Get the BeneficiaryDirectory coords to copy onto the Beneficiary
    const benDir = await prisma.beneficiaryDirectory.findUnique({
      where: { id: benDirId },
      select: { latitude: true, longitude: true, website: true },
    });

    await prisma.beneficiary.update({
      where: { id: privateBen.id },
      data: {
        directoryId: benDirId,
        ...(benDir?.latitude != null && benDir?.longitude != null
          ? { latitude: benDir.latitude, longitude: benDir.longitude }
          : {}),
        ...(benDir?.website ? { website: benDir.website } : {}),
      },
    });

    // Mark the directory entry as claimed by this school's beneficiary
    await prisma.beneficiaryDirectory.update({
      where: { id: benDirId },
      data: { claimed: true },
    });

    linked++;
  }
  console.log(`  Linked ${linked} high school accounts to BeneficiaryDirectory entries.`);

  console.log("\nImport complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
