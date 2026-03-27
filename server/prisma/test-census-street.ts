import "dotenv/config";
import "../src/lib/env";
import prisma from "../src/lib/prisma";
import FormData from "form-data";
import fetch from "node-fetch";

async function main() {
  // Get 100 STREET (non-PO Box) ungeocoded CA entries
  const entries: any[] = await prisma.$queryRawUnsafe(
    `SELECT id, address, city, state, zip FROM "BeneficiaryDirectory"
     WHERE state = 'CA' AND latitude IS NULL
       AND address IS NOT NULL
       AND address NOT ILIKE 'PO BOX%'
       AND address NOT ILIKE 'P.O. BOX%'
       AND address NOT ILIKE 'P O BOX%'
     LIMIT 100`
  );
  console.log(`Testing with ${entries.length} street-address entries...`);
  entries.slice(0, 3).forEach(e => console.log(' ', e.address, e.city, e.state, e.zip));

  const csv = entries.map(e =>
    `${e.id},"${(e.address||'').replace(/"/g,'')}","${e.city}","${e.state}","${e.zip||''}"`
  ).join('\n');

  const form = new FormData();
  form.append("addressFile", Buffer.from(csv), { filename: "addresses.csv", contentType: "text/csv" });
  form.append("benchmark", "Public_AR_Current");
  form.append("returntype", "locations");

  const start = Date.now();
  const res = await (fetch as any)(
    "https://geocoding.geo.census.gov/geocoder/locations/addressbatch",
    { method: "POST", body: form, headers: form.getHeaders() }
  );
  const text = await (res as any).text();
  const elapsed = Date.now() - start;
  const lines = text.split('\n').filter(Boolean);
  const matched = lines.filter((l: string) => /"Match"/.test(l)).length;
  console.log(`Done in ${elapsed}ms. Matched: ${matched}/${entries.length}`);
  console.log('Sample match:', lines.find((l: string) => /"Match"/.test(l))?.slice(0, 120));

  await prisma.$disconnect();
}
main().catch(console.error);
