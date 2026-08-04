import dns from "node:dns/promises";
import net from "node:net";
import { isProdLike } from "./isProdLike";

export const GOOGLE_CLASSROOM_AUTH_ORIGIN = "https://accounts.google.com";
export const GOOGLE_CLASSROOM_TOKEN_ORIGIN = "https://oauth2.googleapis.com";
export const GOOGLE_CLASSROOM_API_ORIGIN = "https://classroom.googleapis.com";

function canonicalOrigin(value: string, allowHttpTestOrigin = false): string {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" && !(allowHttpTestOrigin && !isProdLike() && process.env.LMS_ALLOW_TEST_ORIGINS === "true")) {
    throw new Error("LMS destinations must use HTTPS.");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("LMS destinations must be origins without credentials, paths, queries, or fragments.");
  }
  return url.origin;
}

function configuredOrigins(name: string, allowHttpTestOrigin = false): Set<string> {
  const values = (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const origins = new Set<string>();
  for (const value of values) origins.add(canonicalOrigin(value, allowHttpTestOrigin));
  return origins;
}

export function getApprovedCanvasOrigins(): Set<string> {
  const origins = configuredOrigins("CANVAS_ALLOWED_ORIGINS");
  if (!isProdLike() && process.env.LMS_ALLOW_TEST_ORIGINS === "true") {
    for (const origin of configuredOrigins("LMS_TEST_ALLOWED_ORIGINS", true)) origins.add(origin);
  }
  return origins;
}

export function getAllowedGoogleOrigins(): Set<string> {
  const origins = new Set([
    GOOGLE_CLASSROOM_AUTH_ORIGIN,
    GOOGLE_CLASSROOM_TOKEN_ORIGIN,
    GOOGLE_CLASSROOM_API_ORIGIN,
  ]);
  if (!isProdLike() && process.env.LMS_ALLOW_TEST_ORIGINS === "true") {
    for (const origin of configuredOrigins("LMS_TEST_ALLOWED_ORIGINS", true)) origins.add(origin);
  }
  return origins;
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map(Number);
  return octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? octets : null;
}

export function isPrivateOrReservedIp(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ipv4 = parseIpv4(mappedIpv4 ?? normalized);
  if (ipv4) {
    const [a, b, c] = ipv4;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  if (net.isIP(normalized) === 6) {
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith("ff") ||
      normalized.startsWith("2001:db8:")
    );
  }
  return true;
}

function permitsPrivateTestOrigin(origin: string): boolean {
  return (
    !isProdLike() &&
    process.env.LMS_ALLOW_TEST_ORIGINS === "true" &&
    configuredOrigins("LMS_TEST_ALLOWED_ORIGINS", true).has(origin)
  );
}

export async function assertPublicApprovedUrl(
  input: string | URL,
  approvedOrigins: ReadonlySet<string>,
  expectedOrigin?: string,
): Promise<URL> {
  const url = input instanceof URL ? new URL(input.toString()) : new URL(input);
  if (url.protocol !== "https:" && !permitsPrivateTestOrigin(url.origin)) {
    throw new Error("LMS destinations must use HTTPS.");
  }
  if (url.username || url.password) throw new Error("LMS destination credentials are not allowed.");
  if (!approvedOrigins.has(url.origin)) throw new Error("LMS destination has not been administratively approved.");
  if (expectedOrigin && url.origin !== expectedOrigin) throw new Error("LMS request escaped its approved origin.");

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    if (!permitsPrivateTestOrigin(url.origin)) throw new Error("Private LMS destinations are not allowed.");
    return url;
  }

  const literalKind = net.isIP(hostname);
  const addresses = literalKind
    ? [{ address: hostname }]
    : await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length) throw new Error("LMS destination did not resolve.");
  if (addresses.some(({ address }) => isPrivateOrReservedIp(address)) && !permitsPrivateTestOrigin(url.origin)) {
    throw new Error("Private, reserved, loopback, link-local, and metadata LMS destinations are not allowed.");
  }
  return url;
}

export async function fetchApprovedLmsUrl(params: {
  url: string | URL;
  approvedOrigins: ReadonlySet<string>;
  expectedOrigin: string;
  init?: RequestInit;
}): Promise<Response> {
  const url = await assertPublicApprovedUrl(params.url, params.approvedOrigins, params.expectedOrigin);
  return fetch(url, {
    ...(params.init ?? {}),
    redirect: "error",
  });
}

export async function normalizeApprovedCanvasOrigin(input: string): Promise<string> {
  const origin = canonicalOrigin(input, true);
  const allowed = getApprovedCanvasOrigins();
  await assertPublicApprovedUrl(origin, allowed, origin);
  return origin;
}

export function normalizeSelectedExternalCourseIds(input: unknown): string[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 100) {
    throw Object.assign(new Error("Select between 1 and 100 LMS courses before synchronizing."), { status: 400 });
  }
  const ids = input.map((value) => typeof value === "string" ? value.trim() : "");
  if (ids.some((value) => !value || value.length > 255)) {
    throw Object.assign(new Error("Invalid LMS course selection."), { status: 400 });
  }
  return [...new Set(ids)];
}

export function assertKnownCourseSelection<T extends { id: string | number }>(
  courses: T[],
  selectedExternalCourseIds: string[],
): T[] {
  const selected = new Set(selectedExternalCourseIds);
  const result = courses.filter((course) => selected.has(String(course.id)));
  if (result.length !== selected.size) {
    throw Object.assign(new Error("One or more selected LMS courses are unknown or inaccessible."), { status: 400 });
  }
  return result;
}
