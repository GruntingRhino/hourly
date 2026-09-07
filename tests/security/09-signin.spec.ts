/**
 * Sign-in acceptance: identifier + password, and Google OAuth.
 *
 * This file covers the two entry points a real person uses to get a session.
 * Everything here runs against a real API process and a real database — no
 * stubs, no mocked Prisma.
 *
 * SCOPE BOUNDARY, read this before quoting a result:
 *   * Password sign-in is verified END TO END. Nothing about it is simulated.
 *   * Google sign-in is verified up to, and starting again after, the parts
 *     Google itself performs. This suite proves the authorization URL we send a
 *     browser to, the CSRF state binding, the rejection of forged/replayed
 *     callbacks, and the session the server issues once an identity is
 *     established. It does NOT and cannot prove that a human successfully
 *     authenticated at accounts.google.com — that needs a real Google account
 *     and consent, which no automated run here is allowed to perform.
 *     Tests whose identity did not come from Google are named "(local identity)".
 *
 * Tests run serially (workers:1) and share the seeded accounts.
 */
import { test, expect, request as playwrightRequest } from "@playwright/test";
import { BASE, ACCOUNTS, PW, getToken, auth } from "./helpers/tokens";
import { expectNoUserAccount } from "./helpers/qaDb";

const STUDENT = ACCOUNTS.student1.email;
const SCHOOL_ADMIN = ACCOUNTS.schoolA.email;

/** A fresh context per call: these tests care about cookies and must not share a jar. */
async function ctx() {
  return playwrightRequest.newContext();
}

// ═══════════════════════════════════════════════════════════════════════════
// Password sign-in — happy path
// ═══════════════════════════════════════════════════════════════════════════

test("PW-01: valid credentials → 200 with a JWT and a user payload", async () => {
  const c = await ctx();
  const res = await c.post(`${BASE}/api/auth/login`, {
    data: { email: STUDENT, password: PW },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(typeof body.token).toBe("string");
  expect(body.token.split(".")).toHaveLength(3); // real JWT, not an opaque stub
  expect(body.user.email).toBe(STUDENT);
  expect(body.user.role).toBe("STUDENT");
  expect(body.user).not.toHaveProperty("passwordHash");
  await c.dispose();
});

test("PW-02: the issued token actually authenticates /api/auth/me", async () => {
  const c = await ctx();
  const login = await c.post(`${BASE}/api/auth/login`, {
    data: { email: STUDENT, password: PW },
  });
  const { token } = await login.json();

  const me = await c.get(`${BASE}/api/auth/me`, auth(token));
  expect(me.status()).toBe(200);
  const profile = await me.json();
  expect(profile.email).toBe(STUDENT);
  await c.dispose();
});

test("PW-03: login sets an HttpOnly session cookie", async () => {
  const c = await ctx();
  const res = await c.post(`${BASE}/api/auth/login`, {
    data: { email: STUDENT, password: PW },
  });
  expect(res.status()).toBe(200);

  const setCookie = res.headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value);
  expect(setCookie.length).toBeGreaterThan(0);
  const session = setCookie.find((v) => /httponly/i.test(v));
  expect(session, `no HttpOnly cookie in: ${setCookie.join(" | ")}`).toBeTruthy();
  expect(session!).toMatch(/samesite/i);
  await c.dispose();
});

test("PW-04: the cookie alone authenticates, without an Authorization header", async () => {
  const c = await ctx();
  await c.post(`${BASE}/api/auth/login`, { data: { email: STUDENT, password: PW } });

  // Same context → the cookie jar carries the session, and no bearer token is sent.
  const me = await c.get(`${BASE}/api/auth/me`);
  expect(me.status()).toBe(200);
  expect((await me.json()).email).toBe(STUDENT);
  await c.dispose();
});

test("PW-05: email is matched case-insensitively", async () => {
  const c = await ctx();
  const res = await c.post(`${BASE}/api/auth/login`, {
    data: { email: STUDENT.toUpperCase(), password: PW },
  });
  expect(res.status()).toBe(200);
  expect((await res.json()).user.email).toBe(STUDENT);
  await c.dispose();
});

test("PW-06: surrounding whitespace in the email is tolerated", async () => {
  const c = await ctx();
  const res = await c.post(`${BASE}/api/auth/login`, {
    data: { email: `  ${STUDENT}  `, password: PW },
  });
  expect(res.status()).toBe(200);
  await c.dispose();
});

test("PW-07: a school admin can sign in and gets SCHOOL_ADMIN", async () => {
  const c = await ctx();
  const res = await c.post(`${BASE}/api/auth/login`, {
    data: { email: SCHOOL_ADMIN, password: PW },
  });
  expect(res.status()).toBe(200);
  expect((await res.json()).user.role).toBe("SCHOOL_ADMIN");
  await c.dispose();
});

// ═══════════════════════════════════════════════════════════════════════════
// Password sign-in — rejection paths
// ═══════════════════════════════════════════════════════════════════════════

test("PW-10: wrong password → 401", async () => {
  const c = await ctx();
  const res = await c.post(`${BASE}/api/auth/login`, {
    data: { email: STUDENT, password: "definitely-not-the-password" },
  });
  expect(res.status()).toBe(401);
  await c.dispose();
});

test("PW-11: unknown email → 401, byte-identical to a wrong password (no enumeration)", async () => {
  const c = await ctx();
  const wrongPw = await c.post(`${BASE}/api/auth/login`, {
    data: { email: STUDENT, password: "wrong-password-for-a-real-account" },
  });
  const unknown = await c.post(`${BASE}/api/auth/login`, {
    data: { email: "no-such-user-9f2a@example.invalid", password: "wrong-password-for-a-real-account" },
  });

  expect(wrongPw.status()).toBe(401);
  expect(unknown.status()).toBe(401);
  // An attacker must not be able to tell "this account exists" from the response.
  expect(await unknown.text()).toBe(await wrongPw.text());
  await c.dispose();
});

test("PW-12: no password field → 400 and no session", async () => {
  const c = await ctx();
  const res = await c.post(`${BASE}/api/auth/login`, { data: { email: STUDENT } });
  expect(res.status()).toBe(400);
  expect(await res.text()).not.toContain("token");
  await c.dispose();
});

test("PW-13: empty password is rejected, never treated as a match", async () => {
  const c = await ctx();
  const res = await c.post(`${BASE}/api/auth/login`, {
    data: { email: STUDENT, password: "" },
  });
  expect([400, 401]).toContain(res.status());
  expect(await res.text()).not.toContain('"token"');
  await c.dispose();
});

test("PW-14: a malformed email is rejected without a lookup", async () => {
  const c = await ctx();
  const res = await c.post(`${BASE}/api/auth/login`, {
    data: { email: "not-an-email", password: PW },
  });
  expect([400, 401]).toContain(res.status());
  await c.dispose();
});

test("PW-15: a NoSQL-style operator object in the email is rejected, not coerced", async () => {
  const c = await ctx();
  const res = await c.post(`${BASE}/api/auth/login`, {
    data: { email: { $ne: null }, password: PW },
  });
  expect(res.status()).toBe(400);
  expect(await res.text()).not.toContain('"token"');
  await c.dispose();
});

// ═══════════════════════════════════════════════════════════════════════════
// Session token integrity
// ═══════════════════════════════════════════════════════════════════════════

test("SES-01: a token with a tampered payload is rejected", async () => {
  const token = await getToken("student1");
  const [header, payload, sig] = token.split(".");

  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  claims.role = "SCHOOL_ADMIN"; // privilege escalation attempt
  const forged = Buffer.from(JSON.stringify(claims)).toString("base64url");

  const c = await ctx();
  const res = await c.get(`${BASE}/api/auth/me`, auth(`${header}.${forged}.${sig}`));
  expect(res.status()).toBe(401);
  await c.dispose();
});

test("SES-02: an alg=none token is rejected", async () => {
  const token = await getToken("student1");
  const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");

  const c = await ctx();
  const res = await c.get(`${BASE}/api/auth/me`, auth(`${header}.${payload}.`));
  expect(res.status()).toBe(401);
  await c.dispose();
});

test("SES-03: a token signed with the wrong secret is rejected", async () => {
  // Correctly structured, correct claims, attacker-chosen key.
  const jwt = await import("jsonwebtoken");
  const claims = JSON.parse(
    Buffer.from((await getToken("student1")).split(".")[1], "base64url").toString("utf8"),
  );
  const forged = jwt.default.sign(claims, "an-attacker-chosen-secret");

  const c = await ctx();
  const res = await c.get(`${BASE}/api/auth/me`, auth(forged));
  expect(res.status()).toBe(401);
  await c.dispose();
});

test("SES-04: garbage and empty bearer values are rejected", async () => {
  const c = await ctx();
  for (const value of ["", "not.a.jwt", "Bearer", "null", "undefined"]) {
    const res = await c.get(`${BASE}/api/auth/me`, auth(value));
    expect(res.status(), `bearer "${value}" was accepted`).toBe(401);
  }
  await c.dispose();
});

test("SES-05: no credentials at all → 401", async () => {
  const c = await ctx();
  const res = await c.get(`${BASE}/api/auth/me`);
  expect(res.status()).toBe(401);
  await c.dispose();
});

// ═══════════════════════════════════════════════════════════════════════════
// Brute-force throttling (proves the limiter fires — it is NOT relaxed anywhere)
// ═══════════════════════════════════════════════════════════════════════════

test("PW-20: repeated failures on one account are throttled with 429", async () => {
  // Dedicated address so this cannot consume a seeded account's bucket.
  const victim = "throttle-probe-4c1e@example.invalid";
  const c = await ctx();

  const statuses: number[] = [];
  for (let i = 0; i < 12; i++) {
    const res = await c.post(`${BASE}/api/auth/login`, {
      data: { email: victim, password: `attempt-${i}` },
    });
    statuses.push(res.status());
    if (res.status() === 429) break;
  }

  expect(
    statuses,
    `expected a 429 within 12 failed attempts, saw ${statuses.join(",")}`,
  ).toContain(429);
  await c.dispose();
});

test("PW-21: throttling does not lock out a different, valid account", async () => {
  // The credential bucket is keyed per (IP, email) precisely so one hammered
  // address cannot deny service to everyone else behind the same NAT.
  const c = await ctx();
  const res = await c.post(`${BASE}/api/auth/login`, {
    data: { email: SCHOOL_ADMIN, password: PW },
  });
  expect(res.status()).toBe(200);
  await c.dispose();
});

// ═══════════════════════════════════════════════════════════════════════════
// Google OAuth — the parts that are ours
// ═══════════════════════════════════════════════════════════════════════════

test("GO-01: /google/url returns a real accounts.google.com authorization URL", async () => {
  const c = await ctx();
  const res = await c.get(`${BASE}/api/auth/google/url?state=login`);

  if (res.status() === 503) {
    throw new Error(
      "Google OAuth is not configured on this API (503). This suite requires " +
      "GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET so the authorization URL can be asserted.",
    );
  }
  expect(res.status()).toBe(200);

  const url = new URL((await res.json()).url);
  expect(url.origin).toBe("https://accounts.google.com");
  expect(url.pathname).toBe("/o/oauth2/v2/auth");
  expect(url.searchParams.get("response_type")).toBe("code");
  expect(url.searchParams.get("client_id")).toBeTruthy();
  expect(url.searchParams.get("redirect_uri")).toBeTruthy();
  // openid+email+profile only — no Drive/Gmail/Classroom scope creep on sign-in.
  expect(url.searchParams.get("scope")!.split(" ").sort()).toEqual(["email", "openid", "profile"]);
  await c.dispose();
});

test("GO-02: the authorization URL carries a state bound to a cookie on this browser", async () => {
  const c = await ctx();
  const res = await c.get(`${BASE}/api/auth/google/url?state=login`);
  expect(res.status()).toBe(200);

  const state = new URL((await res.json()).url).searchParams.get("state")!;
  expect(state.startsWith("login.")).toBe(true);
  const nonce = state.slice("login.".length);
  expect(nonce).toMatch(/^[0-9a-f]{32}$/); // 16 random bytes, hex

  const setCookie = res.headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value)
    .join(" | ");
  expect(setCookie).toContain(nonce);
  expect(setCookie).toMatch(/httponly/i);
  await c.dispose();
});

test("GO-03: two authorization requests never reuse a state nonce", async () => {
  const c = await ctx();
  const seen = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const res = await c.get(`${BASE}/api/auth/google/url?state=login`);
    seen.add(new URL((await res.json()).url).searchParams.get("state")!);
  }
  expect(seen.size).toBe(5);
  await c.dispose();
});

test("GO-04: a callback with no state is refused (login CSRF)", async () => {
  const c = await ctx();
  const res = await c.post(`${BASE}/api/auth/google/callback`, {
    data: { code: "attacker-supplied-authorization-code" },
  });
  expect(res.status()).toBe(403);
  expect(await res.text()).not.toContain('"token"');
  await c.dispose();
});

test("GO-05: a callback whose state does not match this browser's cookie is refused", async () => {
  const c = await ctx();
  // This browser starts a legitimate flow...
  await c.get(`${BASE}/api/auth/google/url?state=login`);
  // ...and the attacker completes their own flow inside it.
  const res = await c.post(
    `${BASE}/api/auth/google/callback?state=${encodeURIComponent("login." + "f".repeat(32))}`,
    { data: { code: "attacker-authorization-code" } },
  );
  expect(res.status()).toBe(403);
  expect(await res.text()).not.toContain('"token"');
  await c.dispose();
});

test("GO-06: a state of the right shape but from a different browser is refused", async () => {
  const victim = await ctx();
  const attacker = await ctx();

  // The attacker obtains a genuine, well-formed state on their own browser.
  const attackerState = new URL(
    (await (await attacker.get(`${BASE}/api/auth/google/url?state=login`)).json()).url,
  ).searchParams.get("state")!;

  // Replaying it in the victim's browser must fail: the nonce cookie differs.
  await victim.get(`${BASE}/api/auth/google/url?state=login`);
  const res = await victim.post(
    `${BASE}/api/auth/google/callback?state=${encodeURIComponent(attackerState)}`,
    { data: { code: "code-from-the-attackers-flow" } },
  );
  expect(res.status()).toBe(403);

  await victim.dispose();
  await attacker.dispose();
});

test("GO-07: a state nonce is single-use — the cookie is cleared on the first callback", async () => {
  const c = await ctx();
  const state = new URL(
    (await (await c.get(`${BASE}/api/auth/google/url?state=login`)).json()).url,
  ).searchParams.get("state")!;

  // First use: the state matches, so it gets *past* the CSRF check and fails
  // later, in the token exchange, on the bogus code. Assert that specific
  // outcome — a bare `not.toBe(403)` would also accept a 400/500 raised before
  // the state comparison ever ran, which would make the 403 on replay below
  // attributable to something other than nonce consumption.
  const first = await c.post(
    `${BASE}/api/auth/google/callback?state=${encodeURIComponent(state)}`,
    { data: { code: "a-code-google-will-reject" } },
  );
  expect(first.status()).toBe(400);
  expect(await first.text()).toContain("Failed to exchange Google auth code");

  // Replaying the same state must now fail the CSRF check.
  const replay = await c.post(
    `${BASE}/api/auth/google/callback?state=${encodeURIComponent(state)}`,
    { data: { code: "a-code-google-will-reject" } },
  );
  expect(replay.status()).toBe(403);
  await c.dispose();
});

test("GO-08: a bogus authorization code never yields a session", async () => {
  const c = await ctx();
  const state = new URL(
    (await (await c.get(`${BASE}/api/auth/google/url?state=login`)).json()).url,
  ).searchParams.get("state")!;

  const res = await c.post(
    `${BASE}/api/auth/google/callback?state=${encodeURIComponent(state)}`,
    { data: { code: "not-a-real-google-authorization-code" } },
  );
  expect(res.ok()).toBe(false);
  const text = await res.text();
  expect(text).not.toContain('"token"');
  await c.dispose();
});

test("GO-09: the redirect bridge preserves code and state and stays on our origin", async () => {
  const c = await ctx();
  const res = await c.get(
    `${BASE}/api/auth/google/callback?code=abc123&state=${encodeURIComponent("login.deadbeef")}`,
    { maxRedirects: 0 },
  );
  expect([301, 302, 303, 307, 308]).toContain(res.status());

  const location = new URL(res.headers()["location"]);
  // The origin is the point of the test: the bridge must build its target
  // against the server-side CLIENT_URL, never against request input. Pinned to
  // the client origin under test (override with CLIENT_ORIGIN when the QA
  // client is served elsewhere).
  const expectedOrigin = process.env.CLIENT_ORIGIN ?? "http://127.0.0.1:5312";
  expect(location.origin).toBe(expectedOrigin);
  expect(location.pathname).toBe("/login");
  expect(location.searchParams.get("code")).toBe("abc123");
  expect(location.searchParams.get("state")).toBe("login.deadbeef");

  // ...and it does not move when the attacker-controlled query changes — an
  // open-redirect regression that let `state`/`code` steer the base would show
  // up as a different origin here.
  for (const query of [
    `code=abc123&state=${encodeURIComponent("login.//evil.example")}`,
    `code=${encodeURIComponent("https://evil.example/")}&state=${encodeURIComponent("login.deadbeef")}`,
    `code=abc123&state=${encodeURIComponent("register.deadbeef")}`,
  ]) {
    const probe = await c.get(`${BASE}/api/auth/google/callback?${query}`, { maxRedirects: 0 });
    expect([301, 302, 303, 307, 308]).toContain(probe.status());
    expect(new URL(probe.headers()["location"]).origin).toBe(expectedOrigin);
  }
  await c.dispose();
});

test("GO-10: the bridge sends a school-registration flow to /school/register", async () => {
  const c = await ctx();
  const res = await c.get(
    `${BASE}/api/auth/google/callback?code=abc123&state=${encodeURIComponent("register.deadbeef")}`,
    { maxRedirects: 0 },
  );
  expect(new URL(res.headers()["location"]).pathname).toBe("/school/register");
  await c.dispose();
});

test("GO-11: a provider error is carried through instead of being swallowed", async () => {
  const c = await ctx();
  const res = await c.get(
    `${BASE}/api/auth/google/callback?error=access_denied&state=${encodeURIComponent("login.deadbeef")}`,
    { maxRedirects: 0 },
  );
  const location = new URL(res.headers()["location"]);
  expect(location.searchParams.get("error")).toBe("access_denied");
  expect(location.searchParams.get("code")).toBeNull();
  await c.dispose();
});

// ═══════════════════════════════════════════════════════════════════════════
// Google sign-in, post-identity — LOCAL IDENTITY, NOT A GOOGLE ACCOUNT
//
// `/google/dev-signin` is mounted only when the deployment is not public. It
// runs the *same* `handleGoogleIdentity` + `sendGoogleIdentityResult` code the
// real callback runs after Google returns a verified profile. These tests
// therefore prove what our server does with an identity — they prove nothing
// about Google having authenticated anybody.
// ═══════════════════════════════════════════════════════════════════════════

test("GID-01 (local identity): an existing user's Google identity signs them in", async () => {
  const c = await ctx();
  const res = await c.post(`${BASE}/api/auth/google/dev-signin`, {
    data: { email: STUDENT, name: "PW Student 1", state: "login" },
  });

  if (res.status() === 404) {
    throw new Error(
      "/api/auth/google/dev-signin is absent — the API under test believes it is " +
      "publicly deployed. Run this suite against the local QA API.",
    );
  }
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(typeof body.token).toBe("string");
  expect(body.user.email).toBe(STUDENT);

  // The session is real: it works on a protected route.
  const me = await c.get(`${BASE}/api/auth/me`, auth(body.token));
  expect(me.status()).toBe(200);
  await c.dispose();
});

test("GID-02 (local identity): an unknown address does not silently create an account", async () => {
  const stranger = "unknown-google-user-77b3@example.invalid";
  const c = await ctx();
  const res = await c.post(`${BASE}/api/auth/google/dev-signin`, {
    data: { email: stranger, name: "Stranger", state: "login" },
  });

  // Whatever the product decides here, it must not hand out a STUDENT session
  // for an address nobody invited.
  if (res.status() === 200) {
    const body = await res.json();
    expect(
      body.token,
      "an uninvited Google address was given a session token",
    ).toBeFalsy();
  } else {
    expect(res.ok()).toBe(false);
  }
  await c.dispose();

  // The response alone cannot prove "no account was created" — a route that
  // created the row and answered with a token-less registration payload would
  // satisfy the checks above while doing the exact thing this test is named
  // after. Assert the database postcondition (see helpers/qaDb.ts: it fails
  // closed and proves it is reading the API's own QA database first).
  await expectNoUserAccount(stranger);
});

test("GID-03 (local identity): a malformed address is rejected", async () => {
  const c = await ctx();
  const res = await c.post(`${BASE}/api/auth/google/dev-signin`, {
    data: { email: "not-an-email", state: "login" },
  });
  expect(res.status()).toBe(400);
  await c.dispose();
});

test("GO-12: domain classification does not leak account existence", async () => {
  const c = await ctx();
  const known = await c.get(
    `${BASE}/api/auth/google/classify-domain?email=${encodeURIComponent(STUDENT)}`,
  );
  const unknown = await c.get(
    `${BASE}/api/auth/google/classify-domain?email=${encodeURIComponent("nobody-here-1a2b@gmail.com")}`,
  );

  // Both are gmail.com. If the response differed, this endpoint would be an
  // unauthenticated "does this account exist" oracle. Assert the successful
  // status too — guarding the comparison behind `if (ok)` would let this test
  // pass vacuously on a route that started failing for both addresses.
  expect(known.status()).toBe(200);
  expect(unknown.status()).toBe(200);
  expect(await known.text()).toBe(await unknown.text());
  await c.dispose();
});
