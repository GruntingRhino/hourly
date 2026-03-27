/**
 * Run the Census geocoder for every US state in the BeneficiaryDirectory.
 * Processes up to CONCURRENCY states simultaneously.
 *
 * Run: cd server && npx tsx prisma/geocode-all-states.ts
 */

import { spawn } from "child_process";
import path from "path";

const CONCURRENCY = 2; // Low concurrency keeps Census API happy

// Ordered by ungeocoded count (states with geocoded=0 first, already-processed states last)
const STATES = [
  "OH","IL","GA","NC","MI","NJ","VA","MD","WA","MN",
  "IN","TN","AZ","WI","MO","CO","OR","SC","AL","LA",
  "CT","IA","KY","OK","KS","AR","NV","UT","NE","MS",
  "DC","WV","MT","ME","NM","HI","ID","NH","DE","VT",
  "RI","SD","WY","AK","ND","PR","VI","GU",
  // Already partially processed — run last to clean up Census rejects
  "PA","MA","NY","FL","TX","CA",
];

function geocodeState(state: string): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    console.log(`[${state}] Starting...`);

    const child = spawn(
      "npx",
      ["tsx", path.join(__dirname, "geocode-directory.ts"), "--state", state],
      { cwd: path.join(__dirname, ".."), encoding: "utf-8" } as any
    );

    let output = "";
    (child.stdout as any)?.on("data", (d: Buffer) => { output += d.toString(); });
    (child.stderr as any)?.on("data", (d: Buffer) => { output += d.toString(); });

    child.on("close", (code) => {
      const elapsed = Math.round((Date.now() - start) / 1000);
      const lines = output.split("\n").filter(Boolean);
      const summary = lines.find((l) => l.startsWith("Done.")) ?? lines.at(-1) ?? "no output";
      console.log(`[${state}] ${summary.trim()} (${elapsed}s, exit ${code})`);
      resolve();
    });
  });
}

async function runAll() {
  const queue = [...STATES];
  let completed = 0;

  async function worker() {
    while (queue.length > 0) {
      const state = queue.shift()!;
      await geocodeState(state);
      completed++;
      console.log(`Progress: ${completed}/${STATES.length} states done`);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
  console.log("\nAll states complete.");
}

runAll().catch(console.error);
