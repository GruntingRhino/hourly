import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import prisma from "../lib/prisma";
import { signUserToken } from "../middleware/auth";
import { generateToken, hashToken } from "../lib/tokenHash";
import { sendSchoolRegistrationMagicLink, CLIENT_URL } from "../services/email";
import { resolveSchoolFromUserAssociations, resolveSchoolIdFromUserAssociations } from "../lib/userAssociations";

import { isInternalAdminUser } from "../lib/internalAdmin";
import { isPubliclyDeployed } from "../lib/isProdLike";
import { assertExactSchoolDomain, evaluateSessionEligibility } from "../lib/schoolAuthority";
import { extractDomainFromWebsite, isPersonalEmailDomain } from "../lib/signupEmailPolicy";
import { createEmailSendRateLimit, createHybridRateLimit } from "../middleware/rateLimit";
import {
  firstZodError,
  opaqueIdSchema,
  optionalTrimmedString,
  strictObject,
  tokenSchema,
  trimmedString,
} from "../lib/validation";

const router = Router();
const publicGoogleAuthLimiter = createHybridRateLimit({
  namespace: "google-auth-public",
  windowMs: 15 * 60 * 1000,
  maxPerIp: 90,
  maxPerUser: 180,
});

function normalizeContactEmail(email: unknown): string {
  return typeof email === "string" && email.trim()
    ? email.trim().toLowerCase()
    : "unknown";
}

// 3 registration attempts per IP/contact-email pair per hour — prevents inbox-bombing the contact address
const registerSchoolLimiter = createHybridRateLimit({
  namespace: "register-school",
  windowMs: 60 * 60 * 1000,
  maxPerIp: 10,
  keySuffix: (req) => normalizeContactEmail(req.body?.contactEmail),
});

const registerSchoolEmailLimiter = createEmailSendRateLimit({
  namespace: "register-school-email",
  recipientKey: (req) => {
    const email = normalizeContactEmail(req.body?.contactEmail);
    return email === "unknown" ? null : email;
  },
});

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL ?? `${CLIENT_URL}/school/register`;

// Set ALLOW_PERSONAL_EMAIL_DOMAINS=true to bypass personal email domain restrictions (e.g. during testing).
const ALLOW_PERSONAL_EMAIL_DOMAINS = process.env.ALLOW_PERSONAL_EMAIL_DOMAINS === "true";

// Legacy approved-domain whitelist (env-var override, rarely used).
const APPROVED_DOMAINS = (process.env.APPROVED_SCHOOL_DOMAINS || "")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

function isApprovedDomain(email: string): boolean {
  if (!isPubliclyDeployed()) return true;
  if (APPROVED_DOMAINS.length === 0) return true;
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return APPROVED_DOMAINS.some((allowed) =>
    domain === allowed || domain.endsWith(`.${allowed}`)
  );
}

// ─── OAuth CSRF protection ───────────────────────────────────────────────────
// The `state` sent to Google is `<flow>.<nonce>`; the nonce is also stored in a
// short-lived cookie. At token exchange the two must match, so an attacker
// cannot complete an OAuth flow they initiated in someone else's browser
// (login CSRF). The flow prefix ("login" / "") selects UX only.
const OAUTH_STATE_COOKIE = "gh_oauth_state";
const OAUTH_STATE_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isPubliclyDeployed(),
  path: "/api/auth/google",
};

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function splitOauthState(state: string): { flow: string; nonce: string } {
  const idx = state.lastIndexOf(".");
  if (idx === -1) return { flow: state, nonce: "" };
  return { flow: state.slice(0, idx), nonce: state.slice(idx + 1) };
}

const classifyDomainQuerySchema = strictObject({
  email: optionalTrimmedString(255),
});

const googleUrlQuerySchema = strictObject({
  state: optionalTrimmedString(50),
});

const callbackBridgeQuerySchema = strictObject({
  code: optionalTrimmedString(2048),
  state: optionalTrimmedString(50),
  error: optionalTrimmedString(255),
});

const googleCallbackBodySchema = strictObject({
  code: trimmedString(2048, 1),
});

const schoolSearchQuerySchema = strictObject({
  search: optionalTrimmedString(120),
  state: optionalTrimmedString(50),
  domain: optionalTrimmedString(255),
});

const registerSchoolSchema = strictObject({
  registrationToken: tokenSchema,
  directorySchoolId: opaqueIdSchema.optional(),
  schoolName: trimmedString(255, 1),
  schoolState: optionalTrimmedString(50),
  schoolCity: optionalTrimmedString(100),
  schoolZip: z.string().trim().regex(/^\d{5}$/).optional(),
  contactEmail: z.string().trim().toLowerCase().email().max(255),
});

const verifySchoolQuerySchema = strictObject({
  token: tokenSchema,
});

// ─── Three-layer domain security ────────────────────────────────────────────

function getEmailDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase().trim() || "";
}

/** Layer 2: true if the domain ends with .edu (US institutional fast-track). */
function isEduDomain(email: string): boolean {
  return getEmailDomain(email).endsWith(".edu");
}

function serializeCohorts(memberships: Array<{ cohort?: { id: string; name: string; serviceEndDate?: Date | null } | null; source?: string }> | null | undefined) {
  return (memberships ?? [])
    .filter((membership): membership is { cohort: { id: string; name: string; serviceEndDate?: Date | null }; source?: string } => Boolean(membership?.cohort))
    .map((membership) => ({
      id: membership.cohort.id,
      name: membership.cohort.name,
      source: membership.source,
      serviceEndDate: membership.cohort.serviceEndDate ?? null,
    }));
}

function buildUserPayload(user: any) {
  const studentSchool = resolveSchoolFromUserAssociations(user);
  const schoolId = resolveSchoolIdFromUserAssociations(user);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    schoolId,
    school: studentSchool,
    cohortId: user.cohortId,
    cohort: user.cohort,
    cohorts: serializeCohorts(user.cohortMemberships),
    beneficiaryId: user.beneficiaryId,
    beneficiary: user.beneficiary,
    emailVerified: true,
  };
}

async function findDomainSuggestions(email: string) {
  const emailDomain = getEmailDomain(email);
  if (!emailDomain) {
    return [];
  }

  return prisma.schoolDirectory.findMany({
    where: { emailDomain: { equals: emailDomain, mode: "insensitive" } },
    select: {
      id: true, name: true, type: true, city: true, state: true,
      zip: true, claimed: true, gradeRange: true, enrollment: true, website: true,
    },
    take: 5,
  });
}

async function handleGoogleIdentity(params: {
  googleId: string;
  email: string;
  name: string;
  state?: string;
  persistGoogleId?: boolean;
}) {
  const userIncludes = {
    school: true,
    cohort: { include: { school: true } },
    cohortMemberships: {
      where: { isActive: true },
      include: { cohort: { include: { school: true } } },
      orderBy: { updatedAt: "desc" as const },
    },
    beneficiary: true,
  };

  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId: params.googleId }, { email: params.email }] },
    include: userIncludes,
  });

  if (user) {
    if (params.persistGoogleId && !user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: params.googleId, emailVerified: true },
        include: userIncludes,
      }) as any;
    }

    const existingUser = user!;
    const eligibility = evaluateSessionEligibility({
      ...existingUser,
      isInternalAdmin: isInternalAdminUser(existingUser),
    });
    if (eligibility.allowed === false) {
      return {
        status: eligibility.status,
        body: {
          error: eligibility.error,
          code: eligibility.code,
          requiresSchoolOwnershipReview: eligibility.code === "SCHOOL_OWNERSHIP_PENDING",
        },
      };
    }
    const token = signUserToken(existingUser);
    return {
      status: 200 as const,
      body: {
        token,
        user: buildUserPayload(existingUser),
      },
    };
  }

  if (params.state === "login") {
    return {
      status: 404 as const,
      body: {
        error: "No GoodHours account found for this Google account. If you're a school administrator, please register your school first.",
      },
    };
  }

  const domainSuggestions = await findDomainSuggestions(params.email);
  const regToken = generateToken();
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.schoolRegistrationIntent.updateMany({
      where: { email: params.email, consumedAt: null },
      data: { consumedAt: now },
    });
    await tx.schoolRegistrationIntent.create({
      data: {
        tokenHash: hashToken(regToken),
        googleId: params.googleId,
        email: params.email,
        name: params.name || params.email,
        expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      },
    });
  });

  return {
    status: 202 as const,
    body: {
      requiresSchoolRegistration: true,
      registrationToken: regToken,
      email: params.email,
      name: params.name || "",
      domainSuggestions,
    },
  };
}

// GET /api/auth/google/classify-domain?email=xxx — classify a contact email domain (unauthenticated)
// Returns: { status: "personal" | "edu" | "custom", blocked: boolean }
router.get("/classify-domain", publicGoogleAuthLimiter, (req: Request, res: Response) => {
  const parsed = classifyDomainQuerySchema.safeParse({
    email: typeof req.query.email === "string" ? req.query.email : undefined,
  });
  if (!parsed.success) {
    return res.status(400).json({ error: firstZodError(parsed.error) });
  }
  const { email = "" } = parsed.data;
  if (!email || !email.includes("@")) {
    return res.json({ status: "unknown", blocked: false });
  }
  // Personal emails are only blocked in production (unless feature flag overrides)
  if (isPubliclyDeployed() && !ALLOW_PERSONAL_EMAIL_DOMAINS && isPersonalEmailDomain(email)) {
    return res.json({ status: "personal", blocked: true });
  }
  if (isEduDomain(email)) {
    return res.json({ status: "edu", blocked: false });
  }
  return res.json({ status: "custom", blocked: false });
});

// GET /api/auth/google — returns redirect URL for Google OAuth
// The client redirects to Google using this URL
// Optional ?state= query param is forwarded to Google and returned in callback
router.get("/url", publicGoogleAuthLimiter, (req: Request, res: Response) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: "Google OAuth is not configured" });
  }
  const parsed = googleUrlQuerySchema.safeParse({
    state: typeof req.query.state === "string" ? req.query.state : undefined,
  });
  if (!parsed.success) {
    return res.status(400).json({ error: firstZodError(parsed.error) });
  }
  const { state: flow = "" } = parsed.data;
  // Bind this OAuth attempt to the requesting browser (see OAUTH_STATE_COOKIE)
  const nonce = crypto.randomBytes(16).toString("hex");
  res.cookie(OAUTH_STATE_COOKIE, nonce, { ...OAUTH_STATE_COOKIE_OPTS, maxAge: 10 * 60 * 1000 });
  const state = `${flow}.${nonce}`;
  const scope = encodeURIComponent("openid email profile");
  const redirectUri = encodeURIComponent(GOOGLE_CALLBACK_URL);
  const stateParam = `&state=${encodeURIComponent(state)}`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=select_account${stateParam}`;
  res.json({ url });
});

// GET /api/auth/google/callback — browser redirect bridge for Google OAuth
// Supports legacy/prod Google Console setups that still point at the API URL.
// The frontend page reads ?code= and POSTs it back to this route for token exchange.
router.get("/callback", publicGoogleAuthLimiter, (req: Request, res: Response) => {
  const parsed = callbackBridgeQuerySchema.safeParse({
    code: typeof req.query.code === "string" ? req.query.code : undefined,
    state: typeof req.query.state === "string" ? req.query.state : undefined,
    error: typeof req.query.error === "string" ? req.query.error : undefined,
  });
  if (!parsed.success) {
    return res.status(400).json({ error: firstZodError(parsed.error) });
  }
  const { code = "", state = "", error = "" } = parsed.data;

  const target = new URL(splitOauthState(state).flow === "login" ? "/login" : "/school/register", CLIENT_URL);
  if (code) target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);
  if (error) target.searchParams.set("error", error);

  res.redirect(target.toString());
});

if (!isPubliclyDeployed()) {
  router.post("/dev-signin", publicGoogleAuthLimiter, async (req: Request, res: Response) => {
    try {
      const { email, name, state } = strictObject({
        email: z.string().trim().toLowerCase().email().max(255),
        name: optionalTrimmedString(255, 1),
        state: optionalTrimmedString(50),
      }).parse(req.body);

      const effectiveName = name?.trim() || email.split("@")[0];
      const result = await handleGoogleIdentity({
        googleId: `dev-google:${email.toLowerCase()}`,
        email,
        name: effectiveName,
        state,
        persistGoogleId: false,
      });

      return res.status(result.status).json(result.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: firstZodError(err) });
      }
      console.error("Dev Google sign-in error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
}

// POST /api/auth/google/callback — exchange code for tokens, sign in or start school registration
router.post("/callback", publicGoogleAuthLimiter, async (req: Request, res: Response) => {
  try {
    const { code } = googleCallbackBodySchema.parse(req.body);

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(503).json({ error: "Google OAuth is not configured on server" });
    }

    // CSRF check: the state nonce returned by Google must match the cookie set
    // when this browser requested the auth URL. Without this, an attacker could
    // complete their own OAuth flow inside a victim's browser (login CSRF).
    const rawState = typeof req.query.state === "string" ? req.query.state : "";
    const { flow, nonce } = splitOauthState(rawState);
    const cookieNonce = parseCookies(req)[OAUTH_STATE_COOKIE] || "";
    res.clearCookie(OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE_OPTS);
    const nonceBuf = Buffer.from(nonce, "utf8");
    const cookieBuf = Buffer.from(cookieNonce, "utf8");
    if (!nonce || nonceBuf.length !== cookieBuf.length || !crypto.timingSafeEqual(nonceBuf, cookieBuf)) {
      return res.status(403).json({ error: "Sign-in session expired or invalid. Please try signing in again." });
    }

    // Exchange code for token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_CALLBACK_URL,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("[google-auth] Token exchange failed:", errBody);
      return res.status(400).json({ error: "Failed to exchange Google auth code" });
    }

    const tokenData: any = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Get user info from Google
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoRes.ok) {
      return res.status(400).json({ error: "Failed to fetch Google user info" });
    }

    const googleUser: any = await userInfoRes.json();
    const { id: googleId, email, name } = googleUser;

    if (!email) return res.status(400).json({ error: "Google account must have an email address" });

    // Only link Google identities whose email Google has verified — otherwise an
    // attacker could claim an unverified address and take over the matching account.
    if (googleUser.verified_email !== true) {
      return res.status(403).json({ error: "Your Google account email address is unverified. Please verify it with Google first." });
    }

    // In production, enforce approved domain whitelist
    if (!isApprovedDomain(email)) {
      return res.status(403).json({
        error: "Your email domain is not approved for GoodHours. Please use your institutional school email address.",
        domain: email.split("@")[1],
      });
    }

    const result = await handleGoogleIdentity({
      googleId,
      email,
      name: name || email,
      state: flow || undefined,
      persistGoogleId: true,
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: firstZodError(err) });
    console.error("Google auth callback error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/google/schools — search school directory (unauthenticated, for registration)
// Supports ?search= (fuzzy name match) and/or ?domain= (exact email domain match)
router.get("/schools", publicGoogleAuthLimiter, async (req: Request, res: Response) => {
  try {
    const { search = "", state = "", domain = "" } = schoolSearchQuerySchema.parse({
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      state: typeof req.query.state === "string" ? req.query.state : undefined,
      domain: typeof req.query.domain === "string" ? req.query.domain.toLowerCase() : undefined,
    });

    // Domain-only lookup — return schools whose emailDomain matches
    if (domain && !search) {
      const results = await prisma.schoolDirectory.findMany({
        where: { emailDomain: { equals: domain, mode: "insensitive" } },
        select: {
          id: true, name: true, type: true, city: true, state: true,
          zip: true, claimed: true, gradeRange: true, enrollment: true, website: true,
        },
        take: 5,
      });
      return res.json(results);
    }

    if (search.length < 2) {
      return res.json([]);
    }

    // Build a broad pool: if state is known fetch all schools there;
    // otherwise use the first 3 chars of the query as a loose prefix filter.
    const firstChars = search.slice(0, 3);
    const whereClause = state
      ? { state: { equals: state, mode: "insensitive" as const } }
      : {
          OR: [
            { name: { contains: firstChars, mode: "insensitive" as const } },
            { city: { contains: search, mode: "insensitive" as const } },
          ],
        };
    const pool = await prisma.schoolDirectory.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        type: true,
        city: true,
        state: true,
        zip: true,
        claimed: true,
        gradeRange: true,
        enrollment: true,
        website: true,
      },
      take: 2000,
    });

    const Fuse = (await import("fuse.js")).default;
    const fuse = new Fuse(pool, {
      keys: [
        { name: "name", weight: 0.8 },
        { name: "city", weight: 0.15 },
        { name: "state", weight: 0.05 },
      ],
      threshold: 0.45,   // 0 = perfect match, 1 = match anything; 0.45 is comfortably fuzzy
      distance: 200,     // allow matches far into the string
      includeScore: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
    });

    const results = fuse.search(search, { limit: 10 });
    const ranked = results.map((r) => r.item);

    res.json(ranked);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: firstZodError(err) });
    }
    console.error("School directory search error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/google/register-school — initiate school registration via magic link
router.post("/register-school", publicGoogleAuthLimiter, registerSchoolLimiter, registerSchoolEmailLimiter, async (req: Request, res: Response) => {
  try {
    const data = registerSchoolSchema.parse(req.body);

    const registrationIntent = await prisma.schoolRegistrationIntent.findFirst({
      where: {
        tokenHash: hashToken(data.registrationToken),
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!registrationIntent) {
      return res.status(400).json({ error: "Registration token is invalid, expired, or already used. Please sign in with Google again." });
    }

    // Block personal/consumer email providers on the contact email (production only, unless feature flag overrides)
    if (isPubliclyDeployed() && !ALLOW_PERSONAL_EMAIL_DOMAINS && isPersonalEmailDomain(data.contactEmail)) {
      return res.status(400).json({
        error: "Please use your school's official email address. Personal email providers like Gmail, Yahoo, and Outlook are not accepted.",
        code: "PERSONAL_EMAIL",
      });
    }

    if (!isApprovedDomain(registrationIntent.email)) {
      return res.status(403).json({
        error: "Your email domain is not approved for GoodHours. Please use your institutional school email address.",
      });
    }

    const dirEntry = data.directorySchoolId
      ? await prisma.schoolDirectory.findUnique({ where: { id: data.directorySchoolId } })
      : null;
    if (data.directorySchoolId) {
      const existingSchool = await prisma.school.findFirst({
        where: { directoryId: data.directorySchoolId },
        include: { createdBy: { select: { email: true } } },
      });
      if (dirEntry?.claimed || existingSchool) {
        return res.status(409).json({
          error: "This school is already registered.",
        });
      }

      if (!dirEntry) {
        return res.status(400).json({
          error: "Selected school is no longer available. Please search again.",
        });
      }

      const schoolDomain = dirEntry.emailDomain || (dirEntry.website ? extractDomainFromWebsite(dirEntry.website) : null);
      if (schoolDomain && (isPubliclyDeployed() || !ALLOW_PERSONAL_EMAIL_DOMAINS)) {
        try {
          assertExactSchoolDomain(registrationIntent.email, schoolDomain);
          assertExactSchoolDomain(data.contactEmail, schoolDomain);
        } catch {
          return res.status(403).json({
            error: `Google and contact email domains must exactly match the school's domain (${schoolDomain}).`,
            code: "SCHOOL_DOMAIN_MISMATCH",
          });
        }
      }
    }

    // Generate magic link token
    const magicToken = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const registrationDigest = hashToken(data.registrationToken);

    const school = await prisma.$transaction(async (tx) => {
      const consumed = await tx.schoolRegistrationIntent.updateMany({
        where: {
          id: registrationIntent.id,
          tokenHash: registrationDigest,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw Object.assign(new Error("Registration token is no longer available"), { status: 409 });
      }

      const existingUser = await tx.user.findFirst({
        where: {
          OR: [
            { googleId: registrationIntent.googleId },
            { email: registrationIntent.email },
          ],
        },
        select: { id: true },
      });
      if (existingUser) {
        throw Object.assign(new Error("This Google account is already registered"), { status: 409 });
      }

      const adminUser = await tx.user.create({
        data: {
          email: registrationIntent.email,
          name: registrationIntent.name,
          role: "SCHOOL_ADMIN",
          googleId: registrationIntent.googleId,
          emailVerified: true,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      const txSchool = await tx.school.create({
        data: {
          name: dirEntry?.name || data.schoolName,
          verified: false,
          ownershipStatus: "PENDING",
          registrationToken: hashToken(magicToken),
          registrationTokenExpires: expiresAt,
          registrationEmail: data.contactEmail,
          createdById: adminUser.id,
          type: dirEntry?.type || undefined,
          address: dirEntry?.address || undefined,
          city: dirEntry?.city || data.schoolCity || undefined,
          state: dirEntry?.state || data.schoolState || undefined,
          zip: dirEntry?.zip || data.schoolZip || undefined,
          latitude: dirEntry?.latitude ?? undefined,
          longitude: dirEntry?.longitude ?? undefined,
          directoryId: data.directorySchoolId || undefined,
          domain: dirEntry?.emailDomain || undefined,
        },
        select: { id: true, name: true },
      });

      await tx.user.update({
        where: { id: adminUser.id },
        data: { schoolId: txSchool.id },
      });

      return txSchool;
    });

    // Send magic link to contact email
    const magicLink = `${CLIENT_URL}/school/verify-registration?token=${magicToken}`;
    let emailDeliveryFailed = false;
    try {
      await sendSchoolRegistrationMagicLink(data.contactEmail, school.name, magicLink);
    } catch (emailErr) {
      emailDeliveryFailed = true;
      console.error("[register-school] Failed to send magic link:", emailErr);
    }

    res.json({
      message: emailDeliveryFailed
        ? "Registration saved, but the magic-link email could not be delivered. Please contact support or try again."
        : "Registration link sent. Contact verification and independent ownership review are both required before sign-in.",
      schoolId: school.id,
      schoolName: school.name,
      sentTo: data.contactEmail,
      emailDeliveryFailed,
      requiresSchoolOwnershipReview: true,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: firstZodError(err) });
    const status = typeof err === "object" && err && "status" in err
      ? Number((err as { status: unknown }).status)
      : 500;
    if (status >= 400 && status < 500) {
      return res.status(status).json({ error: err instanceof Error ? err.message : "Registration failed" });
    }
    console.error("Register school error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Direct Google identity is not school-authority evidence. Keep this legacy
// endpoint as an explicit fail-closed compatibility response.
router.post("/complete-registration", publicGoogleAuthLimiter, (_req: Request, res: Response) => {
  return res.status(410).json({
    error: "Direct school claiming is disabled. Submit the independently reviewed school-registration flow.",
    code: "SCHOOL_AUTHORITY_REVIEW_REQUIRED",
  });
});

// GET /api/auth/google/verify-school?token=xxx — complete school registration from magic link
router.get("/verify-school", publicGoogleAuthLimiter, async (req: Request, res: Response) => {
  try {
    const { token } = verifySchoolQuerySchema.parse({
      token: typeof req.query.token === "string" ? req.query.token : undefined,
    });

    const school = await prisma.school.findFirst({
      where: {
        registrationToken: hashToken(token),
        registrationTokenExpires: { gt: new Date() },
        ownershipStatus: "PENDING",
      },
      select: { id: true, name: true },
    });

    if (!school) {
      return res.status(400).json({ error: "Invalid or expired registration link. Please restart registration." });
    }

    const consumed = await prisma.school.updateMany({
      where: {
        id: school.id,
        registrationToken: hashToken(token),
        registrationTokenExpires: { gt: new Date() },
        ownershipStatus: "PENDING",
        ownershipEvidenceVerifiedAt: null,
      },
      data: {
        ownershipEvidenceVerifiedAt: new Date(),
        registrationToken: null,
        registrationTokenExpires: null,
      },
    });
    if (consumed.count !== 1) {
      return res.status(409).json({ error: "Registration link has already been used." });
    }

    res.json({
      message: "School contact verified. Independent ownership review is pending.",
      requiresSchoolOwnershipReview: true,
      school: {
        id: school.id,
        name: school.name,
        verified: false,
        ownershipStatus: "PENDING",
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: firstZodError(err) });
    }
    console.error("Verify school registration error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
