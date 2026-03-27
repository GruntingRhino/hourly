import "dotenv/config";
import "../src/lib/env";
import prisma from "../src/lib/prisma";
import FormData from "form-data";
import fetch from "node-fetch";

async function main() {
  // Use 3 known-good addresses to confirm API works
  const csv = [
    '1,"151 BOSTON POST RD","SUDBURY","MA","01776"',
    '2,"1600 PENNSYLVANIA AVE NW","WASHINGTON","DC","20500"',
    '3,"1 INFINITE LOOP","CUPERTINO","CA","95014"',
  ].join('\n');

  const form = new FormData();
  form.append("addressFile", Buffer.from(csv), { filename: "addresses.csv", contentType: "text/csv" });
  form.append("benchmark", "Public_AR_Current");
  form.append("returntype", "locations");

  const res = await (fetch as any)(
    "https://geocoding.geo.census.gov/geocoder/locations/addressbatch",
    { method: "POST", body: form, headers: form.getHeaders() }
  );
  const text = await (res as any).text();
  console.log("Raw response:\n", text);

  await prisma.$disconnect();
}
main().catch(console.error);
