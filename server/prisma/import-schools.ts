import { PrismaClient } from "@prisma/client";
import { createReadStream } from "fs";
import { parse } from "csv-parse";
import path from "path";

const prisma = new PrismaClient();

// Map CSV column headers to Prisma School fields
// Adjust this if your CSV headers differ
const COLUMN_MAP: Record<string, string> = {
  NCESSCH: "ncessch",
  SCHNAM09: "schnam09",
  MSTREE09: "mstree09",
  MCITY09: "mcity09",
  MSTATE09: "mstate09",
  MZIP09: "mzip09",
  MZIP409: "mzip409",
  MEMBER09: "member09",
  PHONE09: "phone09",
  ULOCAL09: "ulocal09",
  TYPE09: "type09",
  LEVEL09: "level09",
  GSLO09: "gslo09",
  GSHI09: "gshi09",
  STATUS09: "status09",
};

const VALID_FIELDS = new Set(Object.values(COLUMN_MAP));

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: npx tsx prisma/import-schools.ts <path-to-csv>");
    console.error("Example: npx tsx prisma/import-schools.ts ./data/schools.csv");
    process.exit(1);
  }

  const resolved = path.resolve(csvPath);
  console.log(`Reading CSV from: ${resolved}`);

  const records: Record<string, string>[] = [];

  const parser = createReadStream(resolved).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    })
  );

  for await (const row of parser) {
    const mapped: Record<string, string> = {};

    for (const [csvCol, value] of Object.entries(row as Record<string, string>)) {
      const normalized = csvCol.trim().toUpperCase();
      const prismaField = COLUMN_MAP[normalized];

      if (prismaField) {
        mapped[prismaField] = value;
      } else if (VALID_FIELDS.has(csvCol.trim().toLowerCase())) {
        // Also accept lowercase field names directly
        mapped[csvCol.trim().toLowerCase()] = value;
      }
    }

    if (Object.keys(mapped).length === 0) continue;
    records.push(mapped);
  }

  console.log(`Parsed ${records.length} rows from CSV`);

  if (records.length === 0) {
    console.error("No valid rows found. Check that your CSV headers match:");
    console.error("Expected headers:", Object.keys(COLUMN_MAP).join(", "));
    process.exit(1);
  }

  let created = 0;
  let updated = 0;
  let errors = 0;

  // Process in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map((record) => {
        if (record.ncessch) {
          // Upsert by ncessch if available (avoids duplicates)
          return prisma.school.upsert({
            where: { ncessch: record.ncessch },
            update: record,
            create: record,
          });
        } else {
          return prisma.school.create({ data: record });
        }
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        // Check if it was an update or create (we can't tell exactly, count both)
        created++;
      } else {
        errors++;
        console.error("  Error:", result.reason?.message?.slice(0, 120));
      }
    }

    console.log(`  Processed ${Math.min(i + BATCH_SIZE, records.length)} / ${records.length}`);
  }

  console.log(`\nDone! ${created} schools imported/updated, ${errors} errors`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
