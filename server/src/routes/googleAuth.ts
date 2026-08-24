import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import prisma from "../lib/prisma";
import { signToken, signUserToken, verifyToken } from "../middleware/auth";
import { generateToken, hashToken } from "../lib/tokenHash";
import { sendSchoolRegistrationMagicLink, CLIENT_URL } from "../services/email";
import { resolveSchoolFromUserAssociations, resolveSchoolIdFromUserAssociations } from "../lib/userAssociations";
import { linkSchoolToBeneficiaryDirectory } from "../lib/schoolBeneficiaryLink";
import { schoolCreatedBeneficiaryPlan } from "../lib/schoolBeneficiaryPolicy";
import {
  emailDomainMatchesWebsite,
  extractDomainFromWebsite,
  isPersonalEmailDomain,
} from "../lib/signupEmailPolicy";
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

const IS_PRODUCTION = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

// Set ALLOW_PERSONAL_EMAIL_DOMAINS=true to bypass personal email domain restrictions (e.g. during testing).
const ALLOW_PERSONAL_EMAIL_DOMAINS = process.env.ALLOW_PERSONAL_EMAIL_DOMAINS === "true";

// Legacy approved-domain whitelist (env-var override, rarely used).
const APPROVED_DOMAINS = (process.env.APPROVED_SCHOOL_DOMAINS || "")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

function isApprovedDomain(email: string): boolean {
  if (!IS_PRODUCTION) return true;
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
  secure: IS_PRODUCTION,
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

function isDirectoryClaimAuthorized(
  email: string,
  directory: { emailDomain?: string | null; website?: string | null },
): boolean {
  const officialDomain = directory.emailDomain ||
    (directory.website ? extractDomainFromWebsite(directory.website) : null);
  return Boolean(
    officialDomain &&
    emailDomainMatchesWebsite(getEmailDomain(email), officialDomain),
  );
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
  const regToken = signToken(
    {
      googleId: params.googleId,
      email: params.email,
      name: params.name || params.email,
      emailVerified: true,
      pendingSchoolAdmin: true,
    },
    { expiresIn: "1h" }
  );

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
  if (IS_PRODUCTION && !ALLOW_PERSONAL_EMAIL_DOMAINS && isPersonalEmailDomain(email)) {
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

if (!IS_PRODUCTION) {
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

    // Verify the registration token (contains Google profile)
    let googleProfile: any;
    try {
      googleProfile = verifyToken<any>(data.registrationToken);
    } catch {
      return res.status(400).json({ error: "Registration token is invalid or expired. Please sign in with Google again." });
    }

    if (!googleProfile.pendingSchoolAdmin) {
      return res.status(400).json({ error: "Invalid registration token" });
    }
    if (
      googleProfile.emailVerified !== true ||
      typeof googleProfile.googleId !== "string" ||
      typeof googleProfile.email !== "string"
    ) {
      return res.status(400).json({ error: "Registration token is invalid. Please sign in with Google again." });
    }

    // Block personal/consumer email providers on the contact email (production only, unless feature flag overrides)
    if (IS_PRODUCTION && !ALLOW_PERSONAL_EMAIL_DOMAINS && isPersonalEmailDomain(data.contactEmail)) {
      return res.status(400).json({
        error: "Please use your school's official email address. Personal email providers like Gmail, Yahoo, and Outlook are not accepted.",
        code: "PERSONAL_EMAIL",
      });
    }

    if (!isApprovedDomain(googleProfile.email)) {
      return res.status(403).json({
        error: "Your email domain is not approved for GoodHours. Please use your institutional school email address.",
      });
    }

    // Check if school directory entry exists and is already claimed; also validate contact email domain
    if (data.directorySchoolId) {
      const dirEntry = await prisma.schoolDirectory.findUnique({ where: { id: data.directorySchoolId } });
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

      if (
        !isDirectoryClaimAuthorized(googleProfile.email, dirEntry) ||
        !isDirectoryClaimAuthorized(data.contactEmail, dirEntry)
      ) {
        return res.status(400).json({
          error: "Google and contact email domains must match the selected school's official domain.",
          code: "DOMAIN_MISMATCH",
        });
      }
    }

    // Generate magic link token
    const magicToken = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create a placeholder school record to store the magic link
    // We need a user record to satisfy the createdById FK
    // Create a system placeholder if doesn't exist, or create school after email verification
    // Instead: store registration context in School.registrationToken before user exists

    // First create or find the user (Google user — no password needed yet)
    let adminUser = await prisma.user.findFirst({
      where: { OR: [{ googleId: googleProfile.googleId }, { email: googleProfile.email }] },
    });

    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: googleProfile.email,
          name: googleProfile.name || googleProfile.email,
          role: "SCHOOL_ADMIN",
          googleId: googleProfile.googleId,
          emailVerified: true,
          status: "ACTIVE",
        },
      });
    }

    if (adminUser.role !== "SCHOOL_ADMIN" || adminUser.status !== "ACTIVE") {
      return res.status(403).json({ error: "This Google account cannot register a school." });
    }

    // Check if this user already has a school
    if (adminUser.schoolId) {
      const school = await prisma.school.findUnique({ where: { id: adminUser.schoolId } });

      // If onboarding is already complete, just return the existing session — no email needed
      if (school?.onboardingComplete) {
        const token = signUserToken(adminUser);
        return res.json({
          alreadyRegistered: true,
          token,
          user: { id: adminUser.id, email: adminUser.email, name: adminUser.name, role: adminUser.role, schoolId: adminUser.schoolId },
          school,
        });
      }

      // School exists but onboarding is incomplete — regenerate the magic link and resend.
      // This handles the case where the previous send failed or the token expired.
      const magicToken = generateToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const contactEmail = data.contactEmail || school?.registrationEmail;

      if (!contactEmail) {
        return res.status(400).json({ error: "Cannot resend: no contact email on file. Please restart registration." });
      }

      await prisma.school.update({
        where: { id: school!.id },
        data: { registrationToken: hashToken(magicToken), registrationTokenExpires: expiresAt, registrationEmail: contactEmail },
      });

      const magicLink = `${CLIENT_URL}/school/verify-registration?token=${magicToken}`;
      let emailDeliveryFailed = false;
      try {
        await sendSchoolRegistrationMagicLink(contactEmail, school!.name, magicLink);
      } catch (emailErr) {
        emailDeliveryFailed = true;
        console.error("[register-school] Failed to resend magic link:", emailErr);
      }

      return res.json({
        message: emailDeliveryFailed
          ? "A new registration link was saved, but the email could not be delivered. Please contact support or try again."
          : "A new registration link has been sent. Please check your inbox.",
        schoolId: school!.id,
        schoolName: school!.name,
        sentTo: contactEmail,
        emailDeliveryFailed,
      });
    }

    // Create the school record with registration magic link
    const dirEntry = data.directorySchoolId
      ? await prisma.schoolDirectory.findUnique({ where: { id: data.directorySchoolId } })
      : null;

    const school = await prisma.$transaction(async (tx) => {
      const txSchool = await tx.school.create({
        data: {
          name: dirEntry?.name || data.schoolName,
          verified: false,
          registrationToken: hashToken(magicToken),
          registrationTokenExpires: expiresAt,
        },
        select: { id: true, name: true },
      });

      try {
        await tx.school.update({
          where: { id: txSchool.id },
          data: {
            type: dirEntry?.type || undefined,
            address: dirEntry?.address || undefined,
            city: dirEntry?.city || data.schoolCity || undefined,
            state: dirEntry?.state || data.schoolState || undefined,
            zip: dirEntry?.zip || data.schoolZip || undefined,
            latitude: dirEntry?.latitude ?? undefined,
            longitude: dirEntry?.longitude ?? undefined,
            directoryId: data.directorySchoolId || undefined,
            domain: dirEntry?.emailDomain || undefined,
            registrationEmail: data.contactEmail,
          },
          select: { id: true, name: true },
        });
      } catch (err) {
        console.error("[register-school] Failed to apply school metadata:", err);
      }

      if (data.directorySchoolId) {
        const claimResult = await tx.schoolDirectory.updateMany({
          where: { id: data.directorySchoolId, claimed: false },
          data: { claimed: true, claimedBySchoolId: txSchool.id },
        });
        if (claimResult.count !== 1) {
          throw Object.assign(new Error("This school is already registered."), { code: "SCHOOL_ALREADY_CLAIMED" });
        }
      }

      await tx.user.update({
        where: { id: adminUser.id },
        data: { schoolId: txSchool.id },
      });

      return txSchool;
    });


    try {
      await prisma.school.update({
        where: { id: school.id },
        data: { createdById: adminUser.id },
      });
    } catch (err) {
      console.error("[register-school] Failed to mark school creator:", err);
    }

    // Create the school's private beneficiary so it can post opportunities immediately.
    // This is best-effort so a duplicate/legacy data issue can't abort registration
    // after the school and admin user have already been created.
    try {
      const schoolBeneficiary =
        (await prisma.beneficiary.findFirst({
          where: { createdBySchoolId: school.id, visibility: "PRIVATE" },
        })) ??
        (await prisma.beneficiary.create({
          data: {
            name: school.name,
            visibility: "PRIVATE",
            status: "ACTIVE",
            createdBySchoolId: school.id,
            ...schoolCreatedBeneficiaryPlan("PRIVATE"),
          },
        }));

      await prisma.beneficiary.update({
        where: { id: schoolBeneficiary.id },
        data: schoolCreatedBeneficiaryPlan("PRIVATE"),
      });
      const existingApproval = await prisma.schoolBeneficiaryApproval.findFirst({
        where: { schoolId: school.id, beneficiaryId: schoolBeneficiary.id },
      });
      if (!existingApproval) {
        await prisma.schoolBeneficiaryApproval.create({
          data: {
            schoolId: school.id,
            beneficiaryId: schoolBeneficiary.id,
            status: "APPROVED",
            approvedAt: new Date(),
          },
        });
      }
    } catch (err) {
      console.error("[register-school] Failed to create default school beneficiary:", err);
    }

    // Link to BeneficiaryDirectory if a directory school was chosen
    try {
      await linkSchoolToBeneficiaryDirectory(school.id, data.directorySchoolId);
    } catch (err) {
      console.error("[register-school] Failed to link school to BeneficiaryDirectory:", err);
    }

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
        : "Registration link sent to the school email address. Please check the inbox to complete registration.",
      schoolId: school.id,
      schoolName: school.name,
      sentTo: data.contactEmail,
      emailDeliveryFailed,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: firstZodError(err) });
    if ((err as any)?.code === "SCHOOL_ALREADY_CLAIMED") {
      return res.status(409).json({ error: "This school is already registered." });
    }
    console.error("Register school error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const completeRegistrationSchema = strictObject({
  registrationToken: tokenSchema,
  directorySchoolId: opaqueIdSchema.optional(),
  schoolName: trimmedString(255, 1),
});

// POST /api/auth/google/complete-registration — directly create school from Google-authenticated session (no magic link needed)
router.post("/complete-registration", publicGoogleAuthLimiter, async (req: Request, res: Response) => {
  try {
    const data = completeRegistrationSchema.parse(req.body);

    let googleProfile: any;
    try {
      googleProfile = verifyToken<any>(data.registrationToken);
    } catch {
      return res.status(400).json({ error: "Registration token is invalid or expired. Please sign in with Google again." });
    }

    if (!googleProfile.pendingSchoolAdmin) {
      return res.status(400).json({ error: "Invalid registration token" });
    }
    if (
      googleProfile.emailVerified !== true ||
      typeof googleProfile.googleId !== "string" ||
      typeof googleProfile.email !== "string"
    ) {
      return res.status(400).json({ error: "Registration token is invalid. Please sign in with Google again." });
    }

    let adminUser = await prisma.user.findFirst({
      where: { OR: [{ googleId: googleProfile.googleId }, { email: googleProfile.email }] },
    });

    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: googleProfile.email,
          name: googleProfile.name || googleProfile.email,
          role: "SCHOOL_ADMIN",
          googleId: googleProfile.googleId,
          emailVerified: true,
          status: "ACTIVE",
        },
      });
    }

    if (adminUser.role !== "SCHOOL_ADMIN" || adminUser.status !== "ACTIVE") {
      return res.status(403).json({ error: "This Google account cannot register a school." });
    }

    // If user already has a school, return existing session
    if (adminUser.schoolId) {
      const fullUser = await prisma.user.findUnique({
        where: { id: adminUser.id },
        include: {
          school: true,
          cohort: { include: { school: true } },
          cohortMemberships: { where: { isActive: true }, include: { cohort: { include: { school: true } } }, orderBy: { updatedAt: "desc" as const } },
          beneficiary: true,
        },
      });
      const token = signUserToken(adminUser);
      return res.json({ token, user: buildUserPayload(fullUser) });
    }

    const dirEntry = data.directorySchoolId
      ? await prisma.schoolDirectory.findUnique({ where: { id: data.directorySchoolId } })
      : null;

    if (data.directorySchoolId && !dirEntry) {
      return res.status(400).json({ error: "Selected school is no longer available. Please search again." });
    }

    if (data.directorySchoolId) {
      if (!isDirectoryClaimAuthorized(googleProfile.email, dirEntry!)) {
        return res.status(400).json({
          error: "Google email domain does not match the selected school's official domain.",
          code: "DOMAIN_MISMATCH",
        });
      }
      const existing = await prisma.school.findFirst({ where: { directoryId: data.directorySchoolId } });
      if (existing) {
        return res.status(409).json({ error: "This school is already registered." });
      }
    }

    const school = await prisma.$transaction(async (tx) => {
      const txSchool = await tx.school.create({
        data: {
          name: dirEntry?.name || data.schoolName,
          verified: true,
          registrationEmail: googleProfile.email,
        },
        select: { id: true, name: true },
      });

      if (dirEntry) {
        await tx.school.update({
          where: { id: txSchool.id },
          data: {
            type: dirEntry.type || undefined,
            address: dirEntry.address || undefined,
            city: dirEntry.city || undefined,
            state: dirEntry.state || undefined,
            zip: dirEntry.zip || undefined,
            latitude: dirEntry.latitude ?? undefined,
            longitude: dirEntry.longitude ?? undefined,
            directoryId: data.directorySchoolId,
            domain: dirEntry.emailDomain || undefined,
          },
        }).catch((err: any) => console.error("[complete-registration] metadata update failed:", err));
      }

      if (data.directorySchoolId) {
        const claimResult = await tx.schoolDirectory.updateMany({
          where: { id: data.directorySchoolId, claimed: false },
          data: { claimed: true, claimedBySchoolId: txSchool.id },
        });
        if (claimResult.count !== 1) {
          throw Object.assign(new Error("This school is already registered."), { code: "SCHOOL_ALREADY_CLAIMED" });
        }
      }

      await tx.user.update({ where: { id: adminUser.id }, data: { schoolId: txSchool.id } });
      return txSchool;
    });


    await prisma.school.update({ where: { id: school.id }, data: { createdById: adminUser.id } })
      .catch((err: any) => console.error("[complete-registration] createdBy update failed:", err));

    try {
      const schoolBeneficiary =
        (await prisma.beneficiary.findFirst({ where: { createdBySchoolId: school.id, visibility: "PRIVATE" } })) ??
        (await prisma.beneficiary.create({
          data: {
            name: school.name,
            visibility: "PRIVATE",
            status: "ACTIVE",
            createdBySchoolId: school.id,
            ...schoolCreatedBeneficiaryPlan("PRIVATE"),
          },
        }));
      await prisma.beneficiary.update({
        where: { id: schoolBeneficiary.id },
        data: schoolCreatedBeneficiaryPlan("PRIVATE"),
      });
      const existingApproval = await prisma.schoolBeneficiaryApproval.findFirst({
        where: { schoolId: school.id, beneficiaryId: schoolBeneficiary.id },
      });
      if (!existingApproval) {
        await prisma.schoolBeneficiaryApproval.create({
          data: { schoolId: school.id, beneficiaryId: schoolBeneficiary.id, status: "APPROVED", approvedAt: new Date() },
        });
      }
    } catch (err) {
      console.error("[complete-registration] Failed to create default beneficiary:", err);
    }

    try {
      await linkSchoolToBeneficiaryDirectory(school.id, data.directorySchoolId);
    } catch (err) {
      console.error("[complete-registration] Failed to link to BeneficiaryDirectory:", err);
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: adminUser.id },
      include: {
        school: true,
        cohort: { include: { school: true } },
        cohortMemberships: { where: { isActive: true }, include: { cohort: { include: { school: true } } }, orderBy: { updatedAt: "desc" as const } },
        beneficiary: true,
      },
    });

    const token = signUserToken(adminUser);
    res.json({ token, user: buildUserPayload(fullUser) });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: firstZodError(err) });
    if ((err as any)?.code === "SCHOOL_ALREADY_CLAIMED") {
      return res.status(409).json({ error: "This school is already registered." });
    }
    console.error("Complete registration error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
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
      },
      include: { createdBy: true },
    });

    if (!school) {
      return res.status(400).json({ error: "Invalid or expired registration link. Please restart registration." });
    }

    if (!school.createdBy) {
      return res.status(400).json({ error: "School registration is incomplete. Please restart registration." });
    }
    if (school.createdBy.role !== "SCHOOL_ADMIN" || school.createdBy.status !== "ACTIVE") {
      return res.status(403).json({ error: "School registration administrator is not active." });
    }

    // Consume the token as part of the verification write so a replay cannot
    // verify the same registration twice.
    const consumed = await prisma.school.updateMany({
      where: {
        id: school.id,
        registrationToken: hashToken(token),
        registrationTokenExpires: { gt: new Date() },
      },
      data: {
        verified: true,
        registrationToken: null,
        registrationTokenExpires: null,
      },
    });
    if (consumed.count !== 1) {
      return res.status(400).json({ error: "Invalid or expired registration link. Please restart registration." });
    }

    // Return auth token for the admin
    const adminUser = school.createdBy;
    const jwtToken = signUserToken(adminUser);

    res.json({
      token: jwtToken,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        schoolId: school.id,
        emailVerified: true,
      },
      school: {
        id: school.id,
        name: school.name,
        verified: true,
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
