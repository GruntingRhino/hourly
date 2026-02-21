/**
 * Geocoding via Nominatim (OpenStreetMap) — free, no API key required.
 * Usage policy: https://operations.osmfoundation.org/policies/nominatim/
 *   - Max 1 request/second (enforced by callers — this is server-side, low volume)
 *   - Must set a descriptive User-Agent
 *   - Attribution: "Data © OpenStreetMap contributors, ODbL 1.0"
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "GoodHours/1.0 (community-service-tracking; contact@goodhours.app)";

export interface Coords {
  lat: number;
  lng: number;
  displayName?: string;
}

// In-process cache — avoids repeat network calls for the same address within a session
const cache = new Map<string, Coords | null>();

export async function geocodeAddress(address: string): Promise<Coords | null> {
  const key = address.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;

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
    });

    if (!res.ok) {
      console.error(`[geocode] Nominatim HTTP ${res.status} for: ${address}`);
      cache.set(key, null);
      return null;
    }

    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    if (!data.length) {
      cache.set(key, null);
      return null;
    }

    const result: Coords = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };

    cache.set(key, result);
    return result;
  } catch (err) {
    console.error("[geocode] Error:", err);
    cache.set(key, null);
    return null;
  }
}
