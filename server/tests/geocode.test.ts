import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { geocodeAddress } from "../src/lib/geocode";

function mockFetchOnce(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: any, init?: any) => handler(String(url), init)) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("geocodeAddress caches a successful lookup and does not refetch", async () => {
  let calls = 0;
  const restore = mockFetchOnce(async () => {
    calls += 1;
    return jsonResponse([{ lat: "41.8", lon: "-87.6", display_name: "Chicago, IL" }]);
  });
  try {
    const first = await geocodeAddress("233 S Wacker Dr, Chicago, IL");
    const second = await geocodeAddress("233 S Wacker Dr, Chicago, IL");
    assert.deepEqual(first, { lat: 41.8, lng: -87.6, displayName: "Chicago, IL" });
    assert.deepEqual(second, first);
    assert.equal(calls, 1, "second call should be served from cache, not refetched");
  } finally {
    restore();
  }
});

test("geocodeAddress aborts and returns null on a slow upstream instead of hanging", async () => {
  const restore = mockFetchOnce((_url, init: any) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    })
  );
  try {
    const start = Date.now();
    const result = await geocodeAddress("Unique Slow Address " + Date.now());
    assert.equal(result, null);
    // Must not hang indefinitely — the built-in timeout should abort well under 15s.
    assert.ok(Date.now() - start < 15000, "geocodeAddress did not time out promptly");
  } finally {
    restore();
  }
});

test("geocodeAddress does not cache a transient network failure", async () => {
  let calls = 0;
  const restore = mockFetchOnce(async () => {
    calls += 1;
    throw new Error("network unreachable");
  });
  try {
    const address = "Retry Address " + Date.now();
    const first = await geocodeAddress(address);
    const second = await geocodeAddress(address);
    assert.equal(first, null);
    assert.equal(second, null);
    // A transient failure must not be cached — every call should retry the network.
    assert.equal(calls, 2);
  } finally {
    restore();
  }
});

test("the /api/geocode route requires authentication", () => {
  const indexSource = fs.readFileSync(path.join(__dirname, "..", "src", "index.ts"), "utf8");
  const routeMatch = indexSource.match(/app\.get\(\s*"\/api\/geocode"\s*,\s*([^)]*)\)/);
  assert.ok(routeMatch, "could not locate the /api/geocode route registration");
  assert.match(
    routeMatch![1],
    /\bauthenticate\b/,
    "/api/geocode must require authentication — it was previously reachable by anonymous callers as an open proxy to Nominatim",
  );
});
