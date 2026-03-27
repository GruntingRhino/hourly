import FormData from "form-data";
import fetch from "node-fetch";

async function main() {
  const csv = '1,"151 BOSTON POST RD","SUDBURY","MA","01776"\n2,"77 MASSACHUSETTS AVE","CAMBRIDGE","MA","02139"';
  const form = new FormData();
  form.append("addressFile", Buffer.from(csv), { filename: "addresses.csv", contentType: "text/csv" });
  form.append("benchmark", "Public_AR_Current");
  form.append("returntype", "locations");

  const res = await (fetch as any)("https://geocoding.geo.census.gov/geocoder/locations/addressbatch", {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
  });
  const text = await (res as any).text();
  console.log("status:", (res as any).status);
  console.log("response:\n", text);
}

main().catch(console.error);
