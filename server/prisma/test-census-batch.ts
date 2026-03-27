import "dotenv/config";
import "../src/lib/env";
import prisma from "../src/lib/prisma";
import FormData from "form-data";
import fetch from "node-fetch";

async function main() {
  // Get 100 ungeocoded CA entries
  const entries: any[] = await prisma.$queryRawUnsafe(
    `SELECT id, address, city, state, zip FROM "BeneficiaryDirectory"
     WHERE state = 'CA' AND latitude IS NULL AND address IS NOT NULL LIMIT 100`
  );
  console.log(`Testing with ${entries.length} entries...`);

  const csv = entries.map(e =>
    `${e.id},"${(e.address||'').replace(/"/g,'')}","${e.city}","${e.state}","${e.zip||''}"`
  ).join('\n');

  const form = new FormData();
  form.append("addressFile", Buffer.from(csv), { filename: "addresses.csv", contentType: "text/csv" });
  form.append("benchmark", "Public_AR_Current");
  form.append("returntype", "locations");

  console.log("Sending to Census...");
  const start = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000); // 60s timeout

  try {
    const res = await (fetch as any)(
      "https://geocoding.geo.census.gov/geocoder/locations/addressbatch",
      { method: "POST", body: form, headers: form.getHeaders(), signal: controller.signal }
    );
    clearTimeout(timer);
    const text = await (res as any).text();
    const elapsed = Date.now() - start;
    const lines = text.split('\n').filter((l: string) => l.includes('Match'));
    const matched = lines.filter((l: string) => l.includes('"Match"')).length;
    console.log(`Done in ${elapsed}ms. Matched: ${matched}/${entries.length}`);
    console.log('Sample line:', lines[0]?.slice(0, 120));
  } catch (err: any) {
    clearTimeout(timer);
    console.error(`Failed after ${Date.now() - start}ms:`, err.message);
  }

  await prisma.$disconnect();
}
main().catch(console.error);
