/**
 * File upload acceptance — real multipart requests over HTTP.
 *
 * The repo already asserts upload *architecture* by reading the source
 * (`server/tests/uploadAuthorizationArchitecture.test.ts` proves authorization is
 * wired ahead of Multer; `signatureUploadArchitecture.test.ts` likewise). Those
 * are source assertions. Nothing here previously sent a real multipart body, so
 * the runtime behaviour — role gates, cross-tenant refusal, and above all the
 * magic-byte MIME check — was untested end to end.
 *
 * Target: POST /api/school-procurement/:schoolId/documents
 *   authenticate -> requireRole(SCHOOL_ADMIN) -> same-school check
 *   -> multer -> documentType allow-list -> magic-byte MIME -> quota
 *
 * The security assertions below all resolve before the procurement-record check,
 * so they need no billing fixture. The accepted-upload test creates a quote
 * request first, which is what a real school does.
 */
import { test, expect, request as playwrightRequest } from "@playwright/test";
import { BASE, getToken, auth } from "./helpers/tokens";
import { getIds, Ids } from "./helpers/setup";

let ids: Ids;
let tSchoolA: string;
let tSchoolB: string;
let tStudent1: string;

let api: Awaited<ReturnType<typeof playwrightRequest.newContext>>;

/**
 * Playwright's `multipart:` option cannot be used here. The suite config sets a
 * global `Content-Type: application/json` (`playwright-security.config.ts`),
 * which overrides the multipart boundary header; Express then parses the body
 * with express.json() and answers
 *   400 {"error":"Unexpected token '-', \"------WebK\"... is not valid JSON"}
 * So the body and its Content-Type are built explicitly below.
 */
const BOUNDARY = "----GoodHoursUploadAcceptance7f2a1c";

function multipartBody(
  fields: Record<string, string>,
  file?: { field: string; filename: string; contentType: string; bytes: Buffer },
): { body: Buffer; contentType: string } {
  const parts: Buffer[] = [];
  for (const [key, value] of Object.entries(fields)) {
    parts.push(Buffer.from(
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
    ));
  }
  if (file) {
    parts.push(Buffer.from(
      `--${BOUNDARY}\r\n` +
      `Content-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\n` +
      `Content-Type: ${file.contentType}\r\n\r\n`,
    ));
    parts.push(file.bytes);
    parts.push(Buffer.from("\r\n"));
  }
  parts.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return {
    body: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${BOUNDARY}`,
  };
}

/** Upload request options: explicit body, explicit Content-Type, optional bearer. */
function uploadOpts(
  documentType: string | null,
  file: { filename: string; bytes: Buffer } | null,
  token?: string,
) {
  const { body, contentType } = multipartBody(
    documentType === null ? {} : { documentType },
    file ? { field: "file", filename: file.filename, contentType: "application/pdf", bytes: file.bytes } : undefined,
  );
  return {
    data: body,
    headers: {
      "content-type": contentType,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
}

/** A minimal but genuinely valid PDF: correct %PDF- magic bytes. */
const REAL_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
  "2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n" +
  "trailer<</Root 1 0 R>>\n%%EOF\n",
  "utf8",
);

/** HTML pretending to be a PDF: right name, right declared type, wrong bytes. */
const DISGUISED_HTML = Buffer.from(
  "<!doctype html><script>alert('xss')</script>",
  "utf8",
);

test.beforeAll(async () => {
  api = await playwrightRequest.newContext();
  ids = await getIds();
  [tSchoolA, tSchoolB, tStudent1] = await Promise.all([
    getToken("schoolA"),
    getToken("schoolB"),
    getToken("student1"),
  ]);
});

test.afterAll(async () => {
  await api.dispose();
});

// ── Authorization ────────────────────────────────────────────────────────────

test("UP-01: an unauthenticated upload is refused", async () => {
  const res = await api.post(`${BASE}/api/school-procurement/${ids.schoolAId}/documents`, {
    ...uploadOpts("W9", { filename: "w9.pdf", bytes: REAL_PDF }),
  });
  expect(res.status()).toBe(401);
});

test("UP-02: a STUDENT cannot upload a procurement document", async () => {
  const res = await api.post(`${BASE}/api/school-procurement/${ids.schoolAId}/documents`, {
    ...uploadOpts("W9", { filename: "w9.pdf", bytes: REAL_PDF }, tStudent1),
  });
  expect(res.status()).toBe(403);
});

test("UP-03: a school admin cannot upload into ANOTHER school (cross-tenant)", async () => {
  const res = await api.post(`${BASE}/api/school-procurement/${ids.schoolAId}/documents`, {
    // School B's admin, School A's id
    ...uploadOpts("W9", { filename: "w9.pdf", bytes: REAL_PDF }, tSchoolB),
  });
  expect(res.status()).toBe(403);
  expect(await res.text()).not.toContain("quota");
});

// ── Content validation ───────────────────────────────────────────────────────

test("UP-04: HTML renamed .pdf and declared application/pdf is rejected on its bytes", async () => {
  // The single most important assertion in this file: neither the filename nor
  // the client-declared Content-Type is trusted. Only the magic bytes decide.
  const res = await api.post(`${BASE}/api/school-procurement/${ids.schoolAId}/documents`, {
    ...uploadOpts("W9", { filename: "totally-a-w9.pdf", bytes: DISGUISED_HTML }, tSchoolA),
  });
  expect(res.status()).toBe(400);
  expect(await res.text()).toMatch(/file type not permitted/i);
});

test("UP-05: an executable renamed .pdf is rejected", async () => {
  const elf = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(64)]);
  const res = await api.post(`${BASE}/api/school-procurement/${ids.schoolAId}/documents`, {
    ...uploadOpts("W9", { filename: "invoice.pdf", bytes: elf }, tSchoolA),
  });
  expect(res.status()).toBe(400);
  expect(await res.text()).toMatch(/file type not permitted/i);
});

test("UP-06: a document type outside the allow-list is rejected", async () => {
  const res = await api.post(`${BASE}/api/school-procurement/${ids.schoolAId}/documents`, {
    ...uploadOpts("ARBITRARY_TYPE", { filename: "x.pdf", bytes: REAL_PDF }, tSchoolA),
  });
  expect(res.status()).toBe(400);
  expect(await res.text()).toMatch(/invalid document type/i);
});

test("UP-07: a request with no file at all is rejected", async () => {
  const res = await api.post(`${BASE}/api/school-procurement/${ids.schoolAId}/documents`, {
    ...uploadOpts("W9", null, tSchoolA),
  });
  expect(res.status()).toBe(400);
  expect(await res.text()).toMatch(/no file uploaded/i);
});

// ── Accepted upload, and what happens to it afterwards ───────────────────────

test("UP-08: a genuine PDF passes every authorization and content check and is refused only at the procurement-record stage", async () => {
  // A real school opens procurement before uploading paperwork.
  const ctx = await playwrightRequest.newContext();
  const quote = await ctx.post(`${BASE}/api/school-procurement/${ids.schoolAId}/quote-request`, {
    data: {
      schoolName: "Playwright School A",
      enrollment: 500,
      primaryContactName: "QA Contact",
      primaryContactEmail: "abhay.sivaram+1@gmail.com",
    },
    ...auth(tSchoolA),
  });
  // 201 first time, 400 "Procurement already in progress" on a re-run.
  expect(
    [200, 201, 400].includes(quote.status()),
    `unexpected quote-request status ${quote.status()}: ${await quote.text()}`,
  ).toBe(true);
  await ctx.dispose();

  const res = await api.post(`${BASE}/api/school-procurement/${ids.schoolAId}/documents`, {
    ...uploadOpts("W9", { filename: "w9.pdf", bytes: REAL_PDF }, tSchoolA),
  });

  // HONEST SCOPE NOTE — do not "fix" this by asserting 2xx.
  // A quote request does NOT create a SchoolBillingRecord, and NO route in this
  // repo creates one (`grep -rn "billingRecord" server/src` returns only the
  // select at schoolProcurement.ts:86 and the guard at :258). The record is
  // created out of band by internal operations after a quote is reviewed, so
  // the accepted-upload path is not reachable through the public API and this
  // test does not pretend to cover it. Manufacturing a billing row would have
  // meant writing billing data purely to make a test go green.
  //
  // What this DOES prove, and it is the point: a legitimate PDF from the right
  // admin gets past authenticate -> requireRole -> same-school -> multer ->
  // documentType allow-list -> magic-byte MIME, and is stopped only by the
  // business precondition. Compare with UP-03/04/05, which never get this far.
  expect(res.status()).toBe(400);
  expect(await res.text()).toMatch(/no active procurement record/i);
});
