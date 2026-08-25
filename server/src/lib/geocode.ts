/**
 * Geocoding via Nominatim (OpenStreetMap) — free, no API key required.
 * Usage policy: https://operations.osmfoundation.org/policies/nominatim/
 *   - Max 1 request/second (enforced by callers — this is server-side, low volume)
 *   - Must set a descriptive User-Agent
 *   - Attribution: "Data © OpenStreetMap contributors, ODbL 1.0"
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "GoodHours/1.0 (community-service-tracking; contact@goodhours.app)";
const REQUEST_TIMEOUT_MS = 8000;

export interface Coords {
  lat: number;
  lng: number;
  displayName?: string;
}

// In-process cache — avoids repeat network calls for the same address within a session.
// Bounded by both entry count and age: an unbounded cache would grow forever (one entry
// per distinct address string ever queried) and never refresh stale results.
const CACHE_MAX_ENTRIES = 2000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — addresses rarely move

type CacheEntry = { value: Coords | null; expiresAt: number };
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): { hit: boolean; value: Coords | null } {
  const entry = cache.get(key);
  if (!entry) return { hit: false, value: null };
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return { hit: false, value: null };
  }
  // Refresh recency by re-inserting (simple LRU-ish eviction order, since Map
  // iterates in insertion order).
  cache.delete(key);
  cache.set(key, entry);
  return { hit: true, value: entry.value };
}

function cacheSet(key: string, value: Coords | null): void {
  cache.delete(key);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

export async function geocodeAddress(address: string): Promise<Coords | null> {
  const key = address.trim().toLowerCase();
  const cached = cacheGet(key);
  if (cached.hit) return cached.value;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("q", address);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "us"); // US-focused app

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-US,en",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`[geocode] Nominatim HTTP ${res.status} for: ${address}`);
      cacheSet(key, null);
      return null;
    }

    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    if (!data.length) {
      cacheSet(key, null);
      return null;
    }

    const result: Coords = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };

    cacheSet(key, result);
    return result;
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      console.error(`[geocode] Request timed out after ${REQUEST_TIMEOUT_MS}ms for: ${address}`);
    } else {
      console.error("[geocode] Error:", err);
    }
    // Do not cache transient failures (timeout, network error) — only cache
    // confirmed "not found" results, so a temporary outage doesn't poison
    // the cache for the full TTL.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
