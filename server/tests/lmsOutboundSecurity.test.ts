import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import {
  assertKnownCourseSelection,
  assertPublicApprovedUrl,
  fetchApprovedLmsUrl,
  getAllowedGoogleOrigins,
  isPrivateOrReservedIp,
  normalizeSelectedExternalCourseIds,
} from "../src/lib/lmsOutboundSecurity";

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind a TCP port.");
  return `http://127.0.0.1:${address.port}`;
}

test("private, loopback, link-local, metadata, and documentation addresses are rejected", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "100.64.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "198.18.0.1",
    "192.0.2.1",
    "198.51.100.1",
    "203.0.113.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
  ]) {
    assert.equal(isPrivateOrReservedIp(address), true, address);
  }
  assert.equal(isPrivateOrReservedIp("8.8.8.8"), false);
  assert.equal(isPrivateOrReservedIp("2606:4700:4700::1111"), false);
});

test("Google OAuth and API destinations are fixed origins", () => {
  assert.deepEqual(
    [...getAllowedGoogleOrigins()].sort(),
    [
      "https://accounts.google.com",
      "https://classroom.googleapis.com",
      "https://oauth2.googleapis.com",
    ].sort(),
  );
});

test("approved-origin validation rejects unapproved, credentialed, and private URLs", async () => {
  const approved = new Set(["https://8.8.8.8", "https://127.0.0.1"]);
  await assert.rejects(
    assertPublicApprovedUrl("https://evil.example/token", approved),
    /administratively approved/,
  );
  await assert.rejects(
    assertPublicApprovedUrl("https://user:pass@8.8.8.8/token", approved),
    /credentials/,
  );
  await assert.rejects(
    assertPublicApprovedUrl("https://127.0.0.1/token", approved),
    /Private, reserved, loopback/,
  );
  await assert.doesNotReject(
    assertPublicApprovedUrl("https://8.8.8.8/token", approved, "https://8.8.8.8"),
  );
  await assert.rejects(
    assertPublicApprovedUrl("https://8.8.8.8/token", approved, "https://1.1.1.1"),
    /escaped its approved origin/,
  );
});

test("course selection is explicit, bounded, deduplicated, and accessible", () => {
  assert.throws(() => normalizeSelectedExternalCourseIds([]), /Select between 1 and 100/);
  assert.throws(() => normalizeSelectedExternalCourseIds([""]), /Invalid LMS course selection/);
  assert.deepEqual(normalizeSelectedExternalCourseIds(["course-a", "course-a", "course-b"]), ["course-a", "course-b"]);
  const courses = [{ id: "course-a", name: "A" }, { id: "course-b", name: "B" }];
  assert.deepEqual(assertKnownCourseSelection(courses, ["course-b"]), [{ id: "course-b", name: "B" }]);
  assert.throws(() => assertKnownCourseSelection(courses, ["missing"]), /unknown or inaccessible/);
});

test("redirects and unapproved URLs never forward credential-bearing request bodies", async (t) => {
  let canaryHits = 0;
  const canary = createServer((_req, res) => {
    canaryHits += 1;
    res.writeHead(200).end("unexpected");
  });
  const canaryOrigin = await listen(canary);

  let approvedBody = "";
  const approved = createServer((req, res) => {
    req.setEncoding("utf8");
    req.on("data", (chunk) => { approvedBody += chunk; });
    req.on("end", () => {
      res.writeHead(302, { Location: `${canaryOrigin}/collect` }).end();
    });
  });
  const approvedOrigin = await listen(approved);
  t.after(() => {
    approved.close();
    canary.close();
  });

  const previousAllow = process.env.LMS_ALLOW_TEST_ORIGINS;
  const previousOrigins = process.env.LMS_TEST_ALLOWED_ORIGINS;
  process.env.LMS_ALLOW_TEST_ORIGINS = "true";
  process.env.LMS_TEST_ALLOWED_ORIGINS = `${approvedOrigin},${canaryOrigin}`;
  t.after(() => {
    if (previousAllow === undefined) delete process.env.LMS_ALLOW_TEST_ORIGINS;
    else process.env.LMS_ALLOW_TEST_ORIGINS = previousAllow;
    if (previousOrigins === undefined) delete process.env.LMS_TEST_ALLOWED_ORIGINS;
    else process.env.LMS_TEST_ALLOWED_ORIGINS = previousOrigins;
  });

  const approvedOrigins = new Set([approvedOrigin, canaryOrigin]);
  await assert.rejects(fetchApprovedLmsUrl({
    url: `${approvedOrigin}/token`,
    approvedOrigins,
    expectedOrigin: approvedOrigin,
    init: { method: "POST", body: "client_secret=canary-secret" },
  }));
  assert.equal(approvedBody, "client_secret=canary-secret");
  assert.equal(canaryHits, 0, "redirect target must not receive the credential-bearing request");

  await assert.rejects(fetchApprovedLmsUrl({
    url: `${canaryOrigin}/token`,
    approvedOrigins: new Set([approvedOrigin]),
    expectedOrigin: approvedOrigin,
    init: { method: "POST", body: "refresh_token=canary-refresh" },
  }), /administratively approved|escaped its approved origin/);
  assert.equal(canaryHits, 0, "unapproved origin must be rejected before networking");
});
