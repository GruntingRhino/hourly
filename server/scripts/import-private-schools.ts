/**
 * import-private-schools.ts
 *
 * Downloads and imports NCES PSS (Private School Survey) data
 * into the SchoolDirectory table.
 *
 * DATA SOURCE:
 *   NCES Private School Universe Survey (PSS) 2021-22
 *   Download page: https://nces.ed.gov/surveys/pss/pssdata.asp
 *   Direct file: https://nces.ed.gov/surveys/pss/zip/pss2122_pu_csv.zip
 *
 * USAGE:
 *   npx tsx server/scripts/import-private-schools.ts               # shows download instructions
 *   npx tsx server/scripts/import-private-schools.ts ./path/to/pss.csv  # use local file
 *
 * KEY NCES PSS 2021-22 FIELDS:
 *   PPIN           — school ID (unique)
 *   PINST          — school name
 *   PADDRS         — street address (note: PADDRS not PADDRESS)
 *   PCITY          — city
 *   PSTABB         — state abbreviation
 *   PZIP           — zip code
 *   LATITUDE22     — latitude (note: LATITUDE22 not LATCOD)
 *   LONGITUDE22    — longitude (note: LONGITUDE22 not LONCOD)
 *   LOGR2022       — lowest grade code (coded: 1=PK, 2=K, 3=1st...13=11th, 14=12th)
 *   HIGR2022       — highest grade code (same coding; 13=12th grade for K-12 schools)
 *   NUMSTUDS       — total enrollment
 *   PPHONE         — phone number
 *   LEVEL          — school level (1=Elementary, 2=Secondary, 3=Combined K-12)
 */

import fs from "fs";
import path from "path";
import https from "https";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import prisma from "../src/lib/prisma";

const DATA_DIR = path.join(__dirname, "../data");
const OUTPUT_FILE = path.join(DATA_DIR, "Private_Schools.csv");

const NCES_PSS_URL =
  "https://nces.ed.gov/surveys/pss/zip/pss2122_pu_csv.zip";

// PSS 2021-22 grade codes: 1=PK, 2=K, 3=1st, 4=2nd, ..., 13=11th, 14=12th, 15=Ungraded
// HIGR2022=13 means 12th grade for most K-12 combined schools (confirmed by data exploration)
// LEVEL=2 = Secondary (high school), LEVEL=3 = Combined (K-12)
function isHighSchool(record: Record<string, string>): boolean {
  const level = (record["LEVEL"] || "").trim();

  // Level 2 = secondary/high school, Level 3 = combined K-12
  if (level === "2" || level === "3") return true;

  return false;
}

// PSS grade code to display string
// In PSS 2021-22: code 13 = 12th grade (the dominant pattern for K-12 combined schools)
function gradeCodeToLabel(code: string): string | null {
  const codeMap: Record<string, string> = {
    "1": "PK", "2": "K",
    "3": "1", "4": "2", "5": "3", "6": "4", "7": "5",
    "8": "6", "9": "7", "10": "8", "11": "9", "12": "10",
    "13": "12", "14": "12",
  };
  return codeMap[code] ?? null;
}

function buildGradeRange(logr: string, higr: string): string | null {
  const lo = gradeCodeToLabel(logr);
  const hi = gradeCodeToLabel(higr);
  if (!lo || !hi) return null;
  return `${lo}-${hi}`;
}

async function downloadZipAndExtract(url: string, destDir: string): Promise<string> {
  const AdmZip = require("adm-zip");
  const zipPath = path.join(destDir, "pss_private.zip");

  console.log(`Downloading PSS data from: ${url}`);
  await new Promise<void>((resolve, reject) => {
    const file = fs.createWriteStream(zipPath);
    https.get(url, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
    }).on("error", reject);
  });

  const zip = new AdmZip(zipPath);
  const csvEntry = zip.getEntries().find((e: any) => e.entryName.endsWith(".csv"));
  if (!csvEntry) throw new Error("No CSV found in PSS zip");

  const outPath = path.join(destDir, csvEntry.entryName);
  zip.extractEntryTo(csvEntry, destDir, false, true);
  return outPath;
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  let csvPath: string;

  if (process.argv[2]) {
    csvPath = path.resolve(process.argv[2]);
    console.log(`Using local file: ${csvPath}`);
  } else {
    // Check for pre-extracted file
    const cachedCsv = path.join(DATA_DIR, "pss2122_pu.csv");
    if (fs.existsSync(cachedCsv)) {
      console.log(`Using cached PSS data: ${cachedCsv}`);
      csvPath = cachedCsv;
    } else {
      console.log(`
NCES PSS Download Note:
  The NCES PSS file is distributed as a ZIP archive.
  Download URL: ${NCES_PSS_URL}
  1. Download and unzip to get pss2122_pu.csv
  2. Re-run this script with the CSV path:
     npx tsx server/scripts/import-private-schools.ts /path/to/pss2122_pu.csv
`);
      process.exit(0);
    }
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  console.log("Parsing CSV...");
  const rawContent = fs.readFileSync(csvPath, "utf-8");

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
  console.log(`Private high schools (secondary + combined): ${highSchools.length}`);

  // Save output CSV
  const outputRows = highSchools.map((r) => ({
    ppin: r["PPIN"] || "",
    name: r["PINST"] || "",
    address: r["PADDRS"] || "",
    city: r["PCITY"] || "",
    state: r["PSTABB"] || "",
    zip: r["PZIP"] || "",
    latitude: r["LATITUDE22"] || "",
    longitude: r["LONGITUDE22"] || "",
    gradeRange: buildGradeRange(r["LOGR2022"] || "", r["HIGR2022"] || "") || "",
    enrollment: r["NUMSTUDS"] || "",
    phone: r["PPHONE"] || "",
    type: "private",
  }));

  const csvOut = stringify(outputRows, { header: true });
  fs.writeFileSync(OUTPUT_FILE, csvOut);
  console.log(`Saved ${outputRows.length} rows to ${OUTPUT_FILE}`);

  // Upsert into database
  console.log("Upserting into SchoolDirectory...");
  let upserted = 0;
  let skipped = 0;

  for (const r of highSchools) {
    const ppin = (r["PPIN"] || "").trim();
    if (!ppin) { skipped++; continue; }

    const name = (r["PINST"] || "").trim();
    if (!name) { skipped++; continue; }

    const lat = parseFloat(r["LATITUDE22"] || "");
    const lng = parseFloat(r["LONGITUDE22"] || "");
    const enrollment = parseInt(r["NUMSTUDS"] || "", 10);

    try {
      await prisma.schoolDirectory.upsert({
        where: { ncessId: `PSS-${ppin}` },
        update: {
          name,
          type: "private",
          address: r["PADDRS"]?.trim() || null,
          city: r["PCITY"]?.trim() || null,
          state: r["PSTABB"]?.trim() || null,
          zip: r["PZIP"]?.trim() || null,
          latitude: isNaN(lat) ? null : lat,
          longitude: isNaN(lng) ? null : lng,
          gradeRange: buildGradeRange(r["LOGR2022"] || "", r["HIGR2022"] || ""),
          enrollment: isNaN(enrollment) ? null : enrollment,
          phone: r["PPHONE"]?.trim() || null,
          source: "NCES_PSS",
        },
        create: {
          ncessId: `PSS-${ppin}`,
          name,
          type: "private",
          address: r["PADDRS"]?.trim() || null,
          city: r["PCITY"]?.trim() || null,
          state: r["PSTABB"]?.trim() || null,
          zip: r["PZIP"]?.trim() || null,
          latitude: isNaN(lat) ? null : lat,
          longitude: isNaN(lng) ? null : lng,
          gradeRange: buildGradeRange(r["LOGR2022"] || "", r["HIGR2022"] || ""),
          enrollment: isNaN(enrollment) ? null : enrollment,
          phone: r["PPHONE"]?.trim() || null,
          source: "NCES_PSS",
        },
      });
      upserted++;
      if (upserted % 500 === 0) console.log(`  ${upserted} upserted...`);
    } catch (err: any) {
      console.error(`  Error upserting PSS-${ppin}: ${err.message}`);
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
