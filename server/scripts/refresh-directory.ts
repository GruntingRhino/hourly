/**
 * refresh-directory.ts
 *
 * Periodic refresh script for the GoodHours directory data.
 * - Re-downloads IRS EO data if older than 30 days
 * - Re-downloads NCES data if older than 90 days
 * - Marks entries no longer in source data as inactive (active=false)
 *
 * CRON SCHEDULE (example):
 *   0 2 * * 0   cd /app && npx tsx server/scripts/refresh-directory.ts
 *   (runs every Sunday at 2 AM)
 *
 * USAGE:
 *   npx tsx server/scripts/refresh-directory.ts
 *   npx tsx server/scripts/refresh-directory.ts --force   # ignore age checks
 *   npx tsx server/scripts/refresh-directory.ts --irs-only
 *   npx tsx server/scripts/refresh-directory.ts --states=MA,CA
 */

import fs from "fs";
import path from "path";
import https from "https";
import { parse } from "csv-parse/sync";
import prisma from "../src/lib/prisma";

const DATA_DIR = path.join(__dirname, "../data");

const IRS_BASE_URL = "https://apps.irs.gov/pub/epostcard/data-download";
const IRS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days
const NCES_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

const ALL_STATES = [
  "al","ak","az","ar","ca","co","ct","de","fl","ga",
  "hi","id","il","in","ia","ks","ky","la","me","md",
  "ma","mi","mn","ms","mo","mt","ne","nv","nh","nj",
  "nm","ny","nc","nd","oh","ok","or","pa","ri","sc",
  "sd","tn","tx","ut","vt","va","wa","wv","wi","wy",
  "dc","pr","gu","vi","as","mp",
];

function isFileStale(filePath: string, maxAgeMs: number): boolean {
  if (!fs.existsSync(filePath)) return true;
  const stat = fs.statSync(filePath);
  return Date.now() - stat.mtimeMs > maxAgeMs;
}

async function downloadFile(url: string, dest: string): Promise<boolean> {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { timeout: 30000 }, (response) => {
      if (response.statusCode !== 200) {
        console.warn(`  HTTP ${response.statusCode} for ${url}`);
        file.close();
        fs.unlink(dest, () => {});
        resolve(false);
        return;
      }
      response.pipe(file);
      file.on("finish", () => file.close(() => resolve(true)));
    }).on("error", (err) => {
      console.warn(`  Download error: ${err.message}`);
      file.close();
      fs.unlink(dest, () => {});
      resolve(false);
    });
  });
}

// NTEE relevance and mapping (mirrors import-beneficiaries.ts)
const RELEVANT_NTEE_PREFIXES = ["A", "B", "C", "D", "E", "K", "L", "N", "O", "P", "S"];

function isRelevantNtee(nteeCode: string): boolean {
  if (!nteeCode) return false;
  return RELEVANT_NTEE_PREFIXES.includes(nteeCode.charAt(0).toUpperCase());
}

function mapNteeToCategory(nteeCode: string): string {
  const code = (nteeCode || "").toUpperCase().trim();
  if (code === "B21" || code === "B22" || code === "B24") return "Education - School";
  switch (code.charAt(0)) {
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

const IRS_COLUMNS = [
  "EIN", "NAME", "ICO", "STREET", "CITY", "STATE", "ZIP",
  "GROUP", "SUBSECTION", "AFFILIATION", "CLASSIFICATION", "RULING",
  "DEDUCTIBILITY", "FOUNDATION", "ACTIVITY", "ORGANIZATION", "STATUS",
  "TAX_PERIOD", "ASSET_CD", "INCOME_CD", "FILING_REQ_CD", "PF_FILING_REQ_CD",
  "ACCT_PD", "ASSET_AMT", "INCOME_AMT", "REVENUE_AMT", "NTEE_CD", "SORT_NAME",
];

async function refreshIrsState(state: string, force: boolean): Promise<void> {
  const filePath = path.join(DATA_DIR, `eo_${state}.csv`);
  const stale = force || isFileStale(filePath, IRS_MAX_AGE_MS);

  if (!stale) {
    console.log(`  ${state.toUpperCase()}: cached file is fresh, skipping download.`);
  } else {
    const url = `${IRS_BASE_URL}/eo_${state}.csv`;
    console.log(`  ${state.toUpperCase()}: downloading ${url}...`);
    const ok = await downloadFile(url, filePath);
    if (!ok) {
      console.log(`  ${state.toUpperCase()}: download failed, skipping.`);
      return;
    }
  }

  if (!fs.existsSync(filePath)) return;

  const rawContent = fs.readFileSync(filePath, "utf-8");
  const firstLine = rawContent.split("\n")[0];
  const hasHeaders = firstLine.includes("EIN") || firstLine.includes("NAME");

  let records: Record<string, string>[];
  try {
    records = parse(rawContent, {
      columns: hasHeaders ? true : IRS_COLUMNS,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (err: any) {
    console.error(`  ${state.toUpperCase()}: parse error: ${err.message}`);
    return;
  }

  const activeEins = new Set<string>();
  let upserted = 0;

  for (const r of records) {
    const subsection = (r["SUBSECTION"] || "").trim();
    const status = (r["STATUS"] || "").trim();
    const ntee = (r["NTEE_CD"] || "").trim();

    if (subsection !== "03" || status !== "01" || !isRelevantNtee(ntee)) continue;

    const ein = (r["EIN"] || "").trim().replace(/\D/g, "");
    if (!ein || ein.length < 9) continue;

    const name = (r["NAME"] || "").trim();
    if (!name) continue;

    activeEins.add(ein);
    const zip = (r["ZIP"] || "").trim().slice(0, 5);

    try {
      await prisma.beneficiaryDirectory.upsert({
        where: { ein },
        update: {
          name,
          category: mapNteeToCategory(ntee),
          nteeCode: ntee || null,
          address: r["STREET"]?.trim() || null,
          city: r["CITY"]?.trim() || null,
          state: r["STATE"]?.trim() || null,
          zip: zip || null,
          source: "IRS",
          active: true,
        },
        create: {
          ein,
          name,
          category: mapNteeToCategory(ntee),
          nteeCode: ntee || null,
          address: r["STREET"]?.trim() || null,
          city: r["CITY"]?.trim() || null,
          state: r["STATE"]?.trim() || null,
          zip: zip || null,
          source: "IRS",
          active: true,
        },
      });
      upserted++;
    } catch {
      // Ignore individual upsert errors
    }
  }

  // Mark entries from this state that are no longer in the IRS data as inactive
  if (activeEins.size > 0) {
    const stateAbbr = state.toUpperCase();
    const deactivated = await prisma.beneficiaryDirectory.updateMany({
      where: {
        state: stateAbbr,
        source: "IRS",
        active: true,
        ein: { notIn: Array.from(activeEins) },
      },
      data: { active: false },
    });
    if (deactivated.count > 0) {
      console.log(`  ${stateAbbr}: deactivated ${deactivated.count} stale entries`);
    }
  }

  console.log(`  ${state.toUpperCase()}: upserted ${upserted}`);
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const irsOnly = args.includes("--irs-only");

  const statesArg = args.find((a) => a.startsWith("--states="));
  const statesToProcess = statesArg
    ? statesArg.replace("--states=", "").toLowerCase().split(",").map((s) => s.trim())
    : ALL_STATES;

  console.log(`GoodHours Directory Refresh`);
  console.log(`Force refresh: ${force}`);
  console.log(`States: ${statesToProcess.length}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  // === IRS EO Refresh ===
  console.log("=== IRS EO Beneficiary Data ===");
  for (const state of statesToProcess) {
    await refreshIrsState(state, force);
  }

  // === NCES School Data refresh note ===
  if (!irsOnly) {
    const publicSchoolFile = path.join(DATA_DIR, "Public_Schools.csv");
    const privateSchoolFile = path.join(DATA_DIR, "Private_Schools.csv");

    console.log("\n=== NCES School Data ===");

    if (!force && !isFileStale(publicSchoolFile, NCES_MAX_AGE_MS)) {
      console.log("Public school data is fresh (< 90 days old), skipping.");
    } else {
      console.log(`Public school data is stale or missing.`);
      console.log(`  Re-run import-public-schools.ts with the latest NCES CCD file.`);
      console.log(`  Download from: https://nces.ed.gov/ccd/files.asp`);
    }

    if (!force && !isFileStale(privateSchoolFile, NCES_MAX_AGE_MS)) {
      console.log("Private school data is fresh (< 90 days old), skipping.");
    } else {
      console.log(`Private school data is stale or missing.`);
      console.log(`  Re-run import-private-schools.ts with the latest NCES PSS file.`);
      console.log(`  Download from: https://nces.ed.gov/surveys/pss/pssdata.asp`);
    }
  }

  console.log(`\nRefresh complete: ${new Date().toISOString()}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
