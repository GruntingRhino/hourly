/**
 * import-public-schools.ts
 *
 * Downloads and imports NCES CCD (Common Core of Data) public school data
 * into the SchoolDirectory table.
 *
 * DATA SOURCE:
 *   NCES CCD Public School Characteristics 2022-23
 *   Hosted on NCES ArcGIS Open Data Portal (catalog.data.gov ID: 05bceb99-66ac-47d5-a612-a2b18ee4b973)
 *   Direct CSV: https://data-nces.opendata.arcgis.com/api/download/v1/items/6a4fa1b0434e4688b5d60c2e5c1dcaaa/csv?layers=0
 *
 * USAGE:
 *   npx tsx server/scripts/import-public-schools.ts               # download from NCES ArcGIS portal
 *   npx tsx server/scripts/import-public-schools.ts ./path/to/ccd.csv  # use local file
 *
 * KEY NCES FIELDS (2022-23 ArcGIS schema):
 *   NCESSCH        — school ID (unique)
 *   SCH_NAME       — school name
 *   LSTREET1       — street address
 *   LCITY          — city
 *   LSTATE         — state abbreviation
 *   LZIP           — zip code
 *   LATCOD         — latitude
 *   LONCOD         — longitude
 *   GSLO           — lowest grade offered
 *   GSHI           — highest grade offered
 *   SCHOOL_LEVEL   — "Elementary", "Middle", "High", "Secondary", "Combined", etc.
 *   CHARTER_TEXT   — "Yes" / "No"
 *   SCHOOL_TYPE_TEXT — "Regular School", "Special Education", etc.
 *   TOTAL          — total enrollment
 *   PHONE          — phone number
 */

import fs from "fs";
import path from "path";
import https from "https";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import prisma from "../src/lib/prisma";

const DATA_DIR = path.join(__dirname, "../data");
const OUTPUT_FILE = path.join(DATA_DIR, "Public_Schools.csv");

// NCES CCD 2022-23 — NCES ArcGIS Open Data Portal (direct CSV download)
const NCES_CCD_URL =
  "https://data-nces.opendata.arcgis.com/api/download/v1/items/6a4fa1b0434e4688b5d60c2e5c1dcaaa/csv?layers=0";

function isHighSchool(record: Record<string, string>): boolean {
  const level = (record["SCHOOL_LEVEL"] || "").trim().toLowerCase();
  const typeText = (record["SCHOOL_TYPE_TEXT"] || "").trim().toLowerCase();
  const gshi = (record["GSHI"] || "").trim();

  // Skip special education, vocational, alternative schools
  if (typeText.includes("special education") || typeText.includes("vocational") || typeText.includes("alternative")) return false;

  // High or secondary level schools
  if (level === "high" || level === "secondary") return true;

  // Grade high = 12 (could be combined K-12)
  if (gshi === "12" || gshi === "11" || gshi === "10") return true;

  return false;
}

function getSchoolType(record: Record<string, string>): string {
  const charter = (record["CHARTER_TEXT"] || "").trim().toLowerCase();
  if (charter === "yes" || charter === "y") return "charter";
  return "public";
}

function buildGradeRange(gslo: string, gshi: string): string | null {
  if (!gslo || !gshi) return null;
  const loMap: Record<string, string> = {
    PK: "PK",
    KG: "K",
    "00": "K",
    "01": "1",
    "02": "2",
    "03": "3",
    "04": "4",
    "05": "5",
    "06": "6",
    "07": "7",
    "08": "8",
    "09": "9",
    "10": "10",
    "11": "11",
    "12": "12",
  };
  const lo = loMap[gslo] ?? gslo;
  const hi = loMap[gshi] ?? gshi;
  return `${lo}-${hi}`;
}

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const location = response.headers.location;
        if (location) {
          downloadFile(location, dest).then(resolve).catch(reject);
          return;
        }
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} fetching ${url}`));
        return;
      }
      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
    }).on("error", reject);
  });
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  let csvPath: string;

  if (process.argv[2]) {
    csvPath = path.resolve(process.argv[2]);
    console.log(`Using local file: ${csvPath}`);
  } else {
    const downloadPath = path.join(DATA_DIR, "public_schools_2223.csv");
    if (fs.existsSync(downloadPath)) {
      console.log(`Using cached download: ${downloadPath}`);
      csvPath = downloadPath;
    } else {
      console.log(`Downloading NCES CCD 2022-23 from ArcGIS portal...`);
      console.log(`  URL: ${NCES_CCD_URL}`);
      await downloadFile(NCES_CCD_URL, downloadPath);
      console.log(`  Downloaded to ${downloadPath}`);
      csvPath = downloadPath;
    }
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  console.log("Parsing CSV...");
  const rawContent = fs.readFileSync(csvPath, "utf-8");

  // NCES ArcGIS files use comma delimiter
  const firstLine = rawContent.split("\n")[0];
  const delimiter = firstLine.includes("\t") ? "\t" : ",";

  const records: Record<string, string>[] = parse(rawContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter,
    relax_column_count: true,
  });

  console.log(`Total records: ${records.length}`);

  const highSchools = records.filter(isHighSchool);
  console.log(`High schools: ${highSchools.length}`);

  // Save output CSV
  const outputRows = highSchools.map((r) => ({
    ncessId: r["NCESSCH"] || "",
    name: r["SCH_NAME"] || "",
    address: r["LSTREET1"] || "",
    city: r["LCITY"] || "",
    state: r["LSTATE"] || "",
    zip: r["LZIP"] || "",
    latitude: r["LATCOD"] || "",
    longitude: r["LONCOD"] || "",
    gradeRange: buildGradeRange(r["GSLO"] || "", r["GSHI"] || "") || "",
    enrollment: r["TOTAL"] || "",
    phone: r["PHONE"] || "",
    type: getSchoolType(r),
  }));

  const csvOut = stringify(outputRows, { header: true });
  fs.writeFileSync(OUTPUT_FILE, csvOut);
  console.log(`Saved ${outputRows.length} rows to ${OUTPUT_FILE}`);

  // Upsert into database
  console.log("Upserting into SchoolDirectory...");
  let upserted = 0;
  let skipped = 0;

  for (const r of highSchools) {
    const ncessId = (r["NCESSCH"] || "").trim();
    if (!ncessId) { skipped++; continue; }

    const name = (r["SCH_NAME"] || "").trim();
    if (!name) { skipped++; continue; }

    const lat = parseFloat(r["LATCOD"] || "");
    const lng = parseFloat(r["LONCOD"] || "");
    const enrollment = parseInt(r["TOTAL"] || "", 10);

    try {
      await prisma.schoolDirectory.upsert({
        where: { ncessId },
        update: {
          name,
          type: getSchoolType(r),
          address: r["LSTREET1"]?.trim() || null,
          city: r["LCITY"]?.trim() || null,
          state: r["LSTATE"]?.trim() || null,
          zip: r["LZIP"]?.trim() || null,
          latitude: isNaN(lat) ? null : lat,
          longitude: isNaN(lng) ? null : lng,
          gradeRange: buildGradeRange(r["GSLO"] || "", r["GSHI"] || ""),
          enrollment: isNaN(enrollment) ? null : enrollment,
          phone: r["PHONE"]?.trim() || null,
          source: "NCES_CCD",
        },
        create: {
          ncessId,
          name,
          type: getSchoolType(r),
          address: r["LSTREET1"]?.trim() || null,
          city: r["LCITY"]?.trim() || null,
          state: r["LSTATE"]?.trim() || null,
          zip: r["LZIP"]?.trim() || null,
          latitude: isNaN(lat) ? null : lat,
          longitude: isNaN(lng) ? null : lng,
          gradeRange: buildGradeRange(r["GSLO"] || "", r["GSHI"] || ""),
          enrollment: isNaN(enrollment) ? null : enrollment,
          phone: r["PHONE"]?.trim() || null,
          source: "NCES_CCD",
        },
      });
      upserted++;
      if (upserted % 500 === 0) console.log(`  ${upserted} upserted...`);
    } catch (err: any) {
      console.error(`  Error upserting ${ncessId}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`Done. Upserted: ${upserted}, Skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
