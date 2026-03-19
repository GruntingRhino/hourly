/**
 * import-beneficiaries.ts
 *
 * Downloads and imports IRS EO (Exempt Organizations) bulk data into
 * BeneficiaryDirectory. Filters for 501(c)(3) organizations with
 * community-service-relevant NTEE codes.
 *
 * DATA SOURCE:
 *   IRS EO (Exempt Organizations) Business Master File Extract
 *   Published by IRS Statistics of Income (SOI) division
 *   Four regional CSV files covering all US states/territories:
 *     https://www.irs.gov/pub/irs-soi/eo1.csv  (Northeast)
 *     https://www.irs.gov/pub/irs-soi/eo2.csv  (Southeast + South Central)
 *     https://www.irs.gov/pub/irs-soi/eo3.csv  (Midwest + West)
 *     https://www.irs.gov/pub/irs-soi/eo4.csv  (US territories)
 *   Official page: https://www.irs.gov/charities-non-profits/exempt-organizations-business-master-file-extract-eo-bmf
 *
 *   IRS EO CSV columns (with header row):
 *   EIN, NAME, ICO, STREET, CITY, STATE, ZIP, GROUP, SUBSECTION, AFFILIATION,
 *   CLASSIFICATION, RULING, DEDUCTIBILITY, FOUNDATION, ACTIVITY, ORGANIZATION,
 *   STATUS, TAX_PERIOD, ASSET_CD, INCOME_CD, FILING_REQ_CD, PF_FILING_REQ_CD,
 *   ACCT_PD, ASSET_AMT, INCOME_AMT, REVENUE_AMT, NTEE_CD, SORT_NAME
 *
 * USAGE:
 *   npx tsx server/scripts/import-beneficiaries.ts           # download + import all 4 regional files
 *   npx tsx server/scripts/import-beneficiaries.ts --files=eo1,eo2  # specific files
 *   npx tsx server/scripts/import-beneficiaries.ts --local   # use already-downloaded files in data/
 *
 * NOTE: IRS EO data does NOT include coordinates. Run geocode-directory.ts
 *       after this script to geocode the imported entries.
 */

import fs from "fs";
import path from "path";
import https from "https";
import { parse } from "csv-parse";
import prisma from "../src/lib/prisma";

const DATA_DIR = path.join(__dirname, "../data");

// IRS SOI EO BMF — 4 regional files covering all US states/territories
const IRS_SOI_BASE = "https://www.irs.gov/pub/irs-soi";
const EO_FILES = ["eo1", "eo2", "eo3", "eo4"];

// Batch size for DB inserts — large enough to be fast, small enough to avoid timeouts
const BATCH_SIZE = 500;

// NTEE codes relevant to community service / volunteering
const RELEVANT_NTEE_PREFIXES = ["A", "B", "C", "D", "E", "K", "L", "N", "O", "P", "S"];

function mapNteeToCategory(nteeCode: string): string {
  if (!nteeCode) return "Community Service";
  const code = nteeCode.toUpperCase().trim();
  const letter = code.charAt(0);
  switch (letter) {
    case "A": return "Arts & Culture";
    case "B": return "Education";
    case "C": return "Environment";
    case "D": return "Animal Welfare";
    case "E": return "Health";
    case "K": return "Food & Nutrition";
    case "L": return "Housing & Shelter";
    case "N": return "Recreation & Sports";
    case "O": return "Youth Development";
    case "P": return "Human Services";
    case "S": return "Community Improvement";
    default:  return "Community Service";
  }
}

function isRelevantNtee(nteeCode: string): boolean {
  if (!nteeCode) return false;
  return RELEVANT_NTEE_PREFIXES.includes(nteeCode.charAt(0).toUpperCase());
}

async function downloadEoFile(name: string): Promise<string | null> {
  const url = `${IRS_SOI_BASE}/${name}.csv`;
  const dest = path.join(DATA_DIR, `${name}.csv`);
  return new Promise((resolve) => {
    console.log(`  Downloading ${url}...`);
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        console.warn(`  HTTP ${response.statusCode} for ${name} — skipping`);
        file.close(); fs.unlink(dest, () => {}); resolve(null); return;
      }
      response.pipe(file);
      file.on("finish", () => file.close(() => resolve(dest)));
    }).on("error", (err) => {
      console.warn(`  Download error for ${name}: ${err.message}`);
      file.close(); fs.unlink(dest, () => {}); resolve(null);
    });
  });
}

async function processFile(csvPath: string): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;
  let batch: any[] = [];

  async function flushBatch() {
    if (batch.length === 0) return;
    try {
      const result = await prisma.beneficiaryDirectory.createMany({
        data: batch,
        skipDuplicates: true,
      });
      inserted += result.count;
    } catch (err: any) {
      console.error(`  Batch insert error: ${err.message}`);
      skipped += batch.length;
    }
    batch = [];
  }

  await new Promise<void>((resolve, reject) => {
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    let rowCount = 0;

    parser.on("readable", async () => {
      parser.pause();
      let record: Record<string, string>;
      while ((record = parser.read()) !== null) {
        rowCount++;
        if (rowCount % 100000 === 0) {
          process.stdout.write(`    ${rowCount.toLocaleString()} rows parsed, ${inserted.toLocaleString()} inserted...\n`);
        }

        const subsection = (record["SUBSECTION"] || "").trim();
        const status = (record["STATUS"] || "").trim();
        const ntee = (record["NTEE_CD"] || "").trim();

        // Filter: 501(c)(3) + active + relevant NTEE
        if (subsection !== "03" || status !== "01" || !isRelevantNtee(ntee)) {
          skipped++;
          continue;
        }

        const ein = (record["EIN"] || "").trim().replace(/\D/g, "");
        if (!ein || ein.length < 9) { skipped++; continue; }
        const name = (record["NAME"] || "").trim();
        if (!name) { skipped++; continue; }

        batch.push({
          ein,
          name,
          category: mapNteeToCategory(ntee),
          nteeCode: ntee || null,
          address: record["STREET"]?.trim() || null,
          city: record["CITY"]?.trim() || null,
          state: record["STATE"]?.trim() || null,
          zip: (record["ZIP"] || "").trim().slice(0, 5) || null,
          source: "IRS",
          active: true,
        });

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }
      }
      parser.resume();
    });

    parser.on("end", async () => {
      try {
        await flushBatch();
        console.log(`    Total rows: ${rowCount.toLocaleString()}`);
        resolve();
      } catch (err) { reject(err); }
    });

    parser.on("error", reject);
    fs.createReadStream(csvPath).pipe(parser);
  });

  return { inserted, skipped };
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const filesArg = args.find((a) => a.startsWith("--files="));
  const localOnly = args.includes("--local");

  const filesToProcess = filesArg
    ? filesArg.replace("--files=", "").split(",").map((s) => s.trim())
    : EO_FILES;

  console.log(`Processing IRS EO BMF files: ${filesToProcess.join(", ")}`);
  console.log(`Source: ${IRS_SOI_BASE}/eoN.csv\n`);

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const name of filesToProcess) {
    console.log(`--- File: ${name}.csv ---`);

    const localFile = path.join(DATA_DIR, `${name}.csv`);
    let csvPath: string | null = null;

    if (fs.existsSync(localFile)) {
      const size = fs.statSync(localFile).size;
      console.log(`  Using cached file (${(size / 1024 / 1024).toFixed(1)} MB): ${localFile}`);
      csvPath = localFile;
    } else if (localOnly) {
      console.log(`  Not found locally — skipping`);
      continue;
    } else {
      csvPath = await downloadEoFile(name);
    }

    if (!csvPath) { console.log(`  Skipped.`); continue; }

    const start = Date.now();
    try {
      const { inserted, skipped } = await processFile(csvPath);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  Inserted: ${inserted.toLocaleString()}, Filtered out: ${skipped.toLocaleString()} (${elapsed}s)\n`);
      totalInserted += inserted;
      totalSkipped += skipped;
    } catch (err: any) {
      console.error(`  Error: ${err.message}`);
    }
  }

  console.log(`\nDone. Total inserted: ${totalInserted.toLocaleString()}, filtered out: ${totalSkipped.toLocaleString()}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
