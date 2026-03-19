/**
 * geocode-directory.ts
 *
 * Batch geocodes BeneficiaryDirectory entries that have no lat/lng.
 * Uses the US Census Geocoder API (free, no API key required).
 *
 * CENSUS GEOCODER API:
 *   https://geocoding.geo.census.gov/geocoder/locations/address
 *   ?street=STREET&city=CITY&state=STATE&zip=ZIP
 *   &benchmark=Public_AR_Current&format=json
 *
 * USAGE:
 *   npx tsx server/scripts/geocode-directory.ts
 *   npx tsx server/scripts/geocode-directory.ts --limit=1000  # process max 1000 entries
 *   npx tsx server/scripts/geocode-directory.ts --batch=5     # 5 concurrent requests
 */

import https from "https";
import prisma from "../src/lib/prisma";

const CENSUS_GEOCODER_BASE =
  "https://geocoding.geo.census.gov/geocoder/locations/address";

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CensusCoords {
  lat: number;
  lng: number;
}

async function geocodeAddress(
  street: string,
  city: string,
  state: string,
  zip: string
): Promise<CensusCoords | null> {
  return new Promise((resolve) => {
    const params = new URLSearchParams({
      street: street || "",
      city: city || "",
      state: state || "",
      zip: zip || "",
      benchmark: "Public_AR_Current",
      format: "json",
    });

    const url = `${CENSUS_GEOCODER_BASE}?${params.toString()}`;

    const req = https.get(url, { timeout: 10000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const matches = json?.result?.addressMatches;
          if (matches && matches.length > 0) {
            const coords = matches[0].coordinates;
            resolve({ lat: coords.y, lng: coords.x });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);

  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.replace("--limit=", ""), 10) : Infinity;

  const batchArg = args.find((a) => a.startsWith("--batch="));
  const batchSize = batchArg ? parseInt(batchArg.replace("--batch=", ""), 10) : BATCH_SIZE;

  // Find entries missing coordinates
  const entries = await prisma.beneficiaryDirectory.findMany({
    where: {
      latitude: null,
      longitude: null,
      active: true,
    },
    select: {
      id: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      name: true,
    },
    take: Number.isFinite(limit) ? limit : undefined,
    orderBy: { updatedAt: "asc" },
  });

  console.log(`Found ${entries.length} entries missing coordinates.`);

  if (entries.length === 0) {
    console.log("Nothing to geocode.");
    await prisma.$disconnect();
    return;
  }

  let geocoded = 0;
  let failed = 0;
  let processed = 0;

  // Process in batches
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (entry) => {
        if (!entry.address && !entry.city && !entry.zip) {
          failed++;
          processed++;
          return;
        }

        const coords = await geocodeAddress(
          entry.address || "",
          entry.city || "",
          entry.state || "",
          entry.zip || ""
        );

        if (coords) {
          try {
            await prisma.beneficiaryDirectory.update({
              where: { id: entry.id },
              data: { latitude: coords.lat, longitude: coords.lng },
            });
            geocoded++;
          } catch (err: any) {
            console.error(`  DB update error for ${entry.id}: ${err.message}`);
            failed++;
          }
        } else {
          failed++;
        }
        processed++;
      })
    );

    if (processed % 100 === 0 || processed === entries.length) {
      console.log(
        `  Progress: ${processed}/${entries.length} — geocoded: ${geocoded}, failed: ${failed}`
      );
    }

    // Delay between batches to be respectful to Census API
    if (i + batchSize < entries.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`\nDone. Geocoded: ${geocoded}, Failed/Skipped: ${failed}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
