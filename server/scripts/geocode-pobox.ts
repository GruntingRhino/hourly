/**
 * geocode-pobox.ts
 *
 * Geocodes BeneficiaryDirectory entries that have PO Box addresses (or no
 * street address) using city + state + zip via Nominatim. This gives a
 * zip/city-level centroid — sufficient for map discovery purposes.
 *
 * USAGE:
 *   set -a && source server/.env && set +a
 *   npx tsx server/scripts/geocode-pobox.ts
 *   npx tsx server/scripts/geocode-pobox.ts --batch=20 --delay=1200
 */

import prisma from "../src/lib/prisma";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "GoodHours/1.0 (community-service-tracking; contact@goodhours.app)";

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1100; // Nominatim requires max 1 req/sec; 10 concurrent = 1 batch/sec

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocodeCityZip(city: string, state: string, zip: string): Promise<{ lat: number; lng: number } | null> {
  // Build query from most specific to least: "zip, state, US" then "city, state, US"
  const queries = [
    zip ? `${zip}, ${state}, US` : null,
    city && state ? `${city}, ${state}, US` : null,
  ].filter(Boolean) as string[];

  for (const q of queries) {
    try {
      const url = new URL(NOMINATIM_URL);
      url.searchParams.set("q", q);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "1");
      url.searchParams.set("countrycodes", "us");

      const res = await fetch(url.toString(), {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-US,en" },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) continue;

      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch {
      // timeout or network error — try next query
    }
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);

  const batchArg = args.find((a) => a.startsWith("--batch="));
  const batchSize = batchArg ? parseInt(batchArg.replace("--batch=", ""), 10) : BATCH_SIZE;

  const delayArg = args.find((a) => a.startsWith("--delay="));
  const delay = delayArg ? parseInt(delayArg.replace("--delay=", ""), 10) : BATCH_DELAY_MS;

  const entries = await prisma.beneficiaryDirectory.findMany({
    where: {
      latitude: null,
      active: true,
    },
    select: { id: true, name: true, address: true, city: true, state: true, zip: true },
    orderBy: { updatedAt: "asc" },
  });

  console.log(`Found ${entries.length} entries to geocode via city/zip fallback.`);
  if (entries.length === 0) { await prisma.$disconnect(); return; }

  let geocoded = 0, failed = 0, processed = 0;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);

    // Nominatim: 1 req/sec policy. With batchSize concurrent requests + delay,
    // we stay compliant as long as delay >= batchSize * 1000ms.
    // Default: 10 concurrent, 1100ms delay = fine for a one-off backfill script.
    const results = await Promise.all(
      batch.map(async (entry) => {
        if (!entry.city && !entry.zip) return { id: entry.id, coords: null };
        const coords = await geocodeCityZip(entry.city || "", entry.state || "", entry.zip || "");
        return { id: entry.id, coords };
      })
    );

    await Promise.all(
      results.map(async ({ id, coords }) => {
        if (coords) {
          try {
            await prisma.beneficiaryDirectory.update({
              where: { id },
              data: { latitude: coords.lat, longitude: coords.lng },
            });
            geocoded++;
          } catch (err: any) {
            console.error(`  DB error for ${id}: ${err.message}`);
            failed++;
          }
        } else {
          failed++;
        }
        processed++;
      })
    );

    if (processed % 500 === 0 || processed === entries.length) {
      console.log(`  Progress: ${processed}/${entries.length} — geocoded: ${geocoded}, failed: ${failed}`);
    }

    if (i + batchSize < entries.length) await sleep(delay);
  }

  console.log(`\nDone. Geocoded: ${geocoded}, Failed: ${failed}`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
