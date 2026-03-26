/**
 * Batch geocode BeneficiaryDirectory entries using the US Census Bureau Geocoder.
 *
 * The Census Geocoder is free, requires no API key, accepts up to 10,000 addresses
 * per batch, and returns precise lat/lng for US addresses.
 * API docs: https://geocoding.geo.census.gov/geocoder/
 *
 * Strategy:
 *   1. Find all entries that have duplicate (city-center) coordinates — these were
 *      geocoded at the city level and need precise address geocoding.
 *   2. Send them to the Census batch endpoint in chunks of 9,500.
 *   3. Parse the response CSV and update each entry's lat/lng in the DB.
 *
 * Run with:
 *   cd server && npx tsx prisma/geocode-directory.ts [--state MA] [--limit 50000]
 */

import "dotenv/config";
import "../src/lib/env";  // validate env vars
import prisma from "../src/lib/prisma";
import FormData from "form-data";
import fetch from "node-fetch";

const BATCH_SIZE = 9_500; // Census limit is 10,000; stay under
const CENSUS_URL =
  "https://geocoding.geo.census.gov/geocoder/locations/addressbatch";

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const eqForm = args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  if (eqForm) return eqForm;
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return undefined;
}
const stateArg = getArg("state");
const limitArg = parseInt(getArg("limit") ?? "999999");

// Parse a CSV line that may contain quoted fields (including commas within quotes)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += line[i];
    }
  }
  result.push(current);
  return result;
}

async function geocodeBatch(
  entries: { id: string; address: string; city: string; state: string; zip: string | null }[]
): Promise<Map<string, { lat: number; lng: number }>> {
  // Build CSV: ID,address,city,state,zip
  const csvLines = entries.map((e) =>
    `${e.id},"${(e.address || "").replace(/"/g, "")}","${e.city}","${e.state}","${e.zip ?? ""}"`
  );
  const csv = csvLines.join("\n");

  const form = new FormData();
  form.append("addressFile", Buffer.from(csv), {
    filename: "addresses.csv",
    contentType: "text/csv",
  });
  form.append("benchmark", "Public_AR_Current");
  form.append("returntype", "locations");

  const res = await (fetch as any)(CENSUS_URL, {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
  });

  if (!(res as any).ok) {
    throw new Error(`Census geocoder HTTP ${(res as any).status}: ${await (res as any).text()}`);
  }

  const text = await (res as any).text();
  const results = new Map<string, { lat: number; lng: number }>();

  // Census response: "ID","inputAddress","matchIndicator","matchType","matchedAddress","lng,lat","tigerLineId","side"
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const parts = parseCSVLine(line);
    if (parts.length < 6) continue;
    const id = parts[0].trim();
    const matchIndicator = parts[2]?.trim();
    if (matchIndicator !== "Match" && matchIndicator !== "Tie") continue;
    // Coordinates are in field 5 as "longitude,latitude"
    const coordField = parts[5];
    const coordParts = coordField.split(",");
    if (coordParts.length < 2) continue;
    const lng = parseFloat(coordParts[0]);
    const lat = parseFloat(coordParts[1]);
    if (!isNaN(lat) && !isNaN(lng)) {
      results.set(id, { lat, lng });
    }
  }

  return results;
}

async function main() {
  console.log("Finding entries that need address-level geocoding...");

  // Find entries that need precise geocoding:
  //   1. Entries with NULL lat/lng (never geocoded)
  //   2. Entries with city-center coordinates (shared with many others — geocoded at city level only)
  const whereClause = stateArg
    ? `AND state = '${stateArg.toUpperCase()}'`
    : "";

  const entries: any[] = await prisma.$queryRawUnsafe(`
    SELECT id, address, city, state, zip
    FROM "BeneficiaryDirectory"
    WHERE address IS NOT NULL AND address != ''
      ${whereClause}
      AND (
        latitude IS NULL
        OR (latitude, longitude) IN (
          SELECT latitude, longitude
          FROM "BeneficiaryDirectory"
          WHERE latitude IS NOT NULL
          GROUP BY latitude, longitude
          HAVING COUNT(*) > 1
        )
      )
    ORDER BY id
    LIMIT ${limitArg}
  `);

  console.log(`Found ${entries.length} entries with city-center coordinates.`);

  let totalUpdated = 0;
  let batchNum = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    batchNum++;
    const batch = entries.slice(i, i + BATCH_SIZE);
    console.log(`\nBatch ${batchNum}: geocoding ${batch.length} entries...`);

    try {
      const results = await geocodeBatch(batch);
      console.log(`  Matched: ${results.size} / ${batch.length}`);

      // Batch update with a VALUES clause
      if (results.size > 0) {
        const valueRows = Array.from(results.entries())
          .map(([id, { lat, lng }]) => `('${id}', ${lat}, ${lng})`)
          .join(",\n");

        await prisma.$executeRawUnsafe(`
          UPDATE "BeneficiaryDirectory" bd
          SET latitude = v.lat, longitude = v.lng
          FROM (VALUES ${valueRows}) AS v(id, lat, lng)
          WHERE bd.id = v.id
        `);

        totalUpdated += results.size;
        console.log(`  Updated ${results.size} entries. Total so far: ${totalUpdated}`);
      }
    } catch (err) {
      console.error(`  Batch ${batchNum} failed:`, err);
      console.log("  Continuing with next batch...");
    }

    // Small delay between batches to be a good citizen
    if (i + BATCH_SIZE < entries.length) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`\nDone. Total entries updated: ${totalUpdated} / ${entries.length}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
