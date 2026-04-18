import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import prisma from "../lib/prisma";
import { signToken } from "../middleware/auth";
import { sendSchoolRegistrationMagicLink, CLIENT_URL } from "../services/email";
import { linkSchoolToBeneficiaryDirectory } from "../lib/schoolBeneficiaryLink";
import { extractDomainFromWebsite } from "./auth";

const router = Router();

// 3 registration attempts per IP per hour — prevents email-bombing the contact address
const registerSchoolLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many registration attempts from this IP. Please try again later." },
});

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL ?? `${CLIENT_URL}/api/auth/google/callback`;

const IS_PRODUCTION = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

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

// ─── Three-layer domain security ────────────────────────────────────────────

// Layer 1 — personal / free-tier email providers that schools would never use.
const PERSONAL_EMAIL_DOMAINS = new Set([
  // Google
  "gmail.com", "googlemail.com",
  // Yahoo
  "yahoo.com", "ymail.com", "yahoo.co.uk", "yahoo.co.in", "yahoo.com.au",
  "yahoo.fr", "yahoo.de", "yahoo.es", "yahoo.it", "yahoo.ca",
  // Microsoft consumer
  "hotmail.com", "outlook.com", "live.com", "msn.com",
  "hotmail.co.uk", "hotmail.fr", "hotmail.de", "hotmail.es",
  "live.co.uk", "live.fr",
  // Apple
  "icloud.com", "me.com", "mac.com",
  // AOL / Verizon
  "aol.com", "aim.com", "verizon.net",
  // Privacy / encrypted
  "protonmail.com", "pm.me", "proton.me",
  "tutanota.com", "tuta.com",
  // Other common consumer providers
  "gmx.com", "gmx.net", "mail.com",
  "zoho.com", "zohomail.com",
  "yandex.com", "yandex.ru",
  "qq.com", "163.com", "126.com",
  "mail.ru", "inbox.com", "rediffmail.com",
  "comcast.net", "att.net", "sbcglobal.net", "cox.net",
]);

function getEmailDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase().trim() || "";
}

/** Returns true if emailDomain matches or is a subdomain of schoolDomain. */
function emailDomainMatchesSchool(emailDomain: string, schoolDomain: string): boolean {
  return emailDomain === schoolDomain || emailDomain.endsWith("." + schoolDomain);
}

/** Returns true for Playwright test accounts that bypass the personal-domain check. */
function isTestEmail(email: string): boolean {
  return /^abhay\.sivaram(\+[^@]*)?@gmail\.com$/i.test(email);
}

/** Layer 1: true if the domain is a known personal / consumer email provider. */
function isPersonalEmailDomain(email: string): boolean {
  if (isTestEmail(email)) return false;
  return PERSONAL_EMAIL_DOMAINS.has(getEmailDomain(email));
}

/** Layer 2: true if the domain ends with .edu (US institutional fast-track). */
function isEduDomain(email: string): boolean {
  return getEmailDomain(email).endsWith(".edu");
}

// GET /api/auth/google/classify-domain?email=xxx — classify a contact email domain (unauthenticated)
// Returns: { status: "personal" | "edu" | "custom", blocked: boolean }
router.get("/classify-domain", (req: Request, res: Response) => {
  const email = ((req.query.email as string) || "").trim();
  if (!email || !email.includes("@")) {
    return res.json({ status: "unknown", blocked: false });
  }
  // Personal emails are only blocked in production
  if (IS_PRODUCTION && isPersonalEmailDomain(email)) {
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
router.get("/url", (req: Request, res: Response) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: "Google OAuth is not configured" });
  }
  const state = (req.query.state as string | undefined) || "";
  const scope = encodeURIComponent("openid email profile");
  const redirectUri = encodeURIComponent(GOOGLE_CALLBACK_URL);
  const stateParam = state ? `&state=${encodeURIComponent(state)}` : "";
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=select_account${stateParam}`;
  res.json({ url });
});

// POST /api/auth/google/callback — exchange code for tokens, sign in or start school registration
router.post("/callback", async (req: Request, res: Response) => {
  try {
    const { code } = z.object({ code: z.string() }).parse(req.body);

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(503).json({ error: "Google OAuth is not configured on server" });
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

    // In production, enforce approved domain whitelist
    if (!isApprovedDomain(email)) {
      return res.status(403).json({
        error: "Your email domain is not approved for GoodHours. Please use your institutional school email address.",
        domain: email.split("@")[1],
      });
    }

    const userIncludes = {
      school: true,
      cohort: { include: { school: true } },
      beneficiary: true,
    };

    // Find existing user by googleId or email
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
      include: userIncludes,
    });

    if (user) {
      // Existing user — link googleId if not already
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId, emailVerified: true },
          include: userIncludes,
        }) as any;
      }

      const u = user as any;
      const studentSchool = u.school || u.cohort?.school || null;
      const schoolId = u.schoolId || u.cohort?.school?.id || null;
      const token = signToken({ userId: u.id, email: u.email, role: u.role });
      return res.json({
        token,
        user: {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          schoolId,
          school: studentSchool,
          cohortId: u.cohortId,
          cohort: u.cohort,
          beneficiaryId: u.beneficiaryId,
          beneficiary: u.beneficiary,
          emailVerified: true,
        },
      });
    }

    // New user — look up schools matching their email domain before returning
    const emailDomain = getEmailDomain(email);
    let domainSuggestions: any[] = [];
    if (emailDomain && !isPersonalEmailDomain(email)) {
      domainSuggestions = await prisma.schoolDirectory.findMany({
        where: { emailDomain: { equals: emailDomain, mode: "insensitive" } },
        select: {
          id: true, name: true, type: true, city: true, state: true,
          zip: true, claimed: true, gradeRange: true, enrollment: true, website: true,
        },
        take: 5,
      });
    }

    const regToken = signToken(
      { googleId, email, name: name || email, pendingSchoolAdmin: true },
      { expiresIn: "1h" }
    );

    return res.status(202).json({
      requiresSchoolRegistration: true,
      registrationToken: regToken,
      email,
      name: name || "",
      domainSuggestions,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Google auth callback error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/google/schools — search school directory (unauthenticated, for registration)
// Supports ?search= (fuzzy name match) and/or ?domain= (exact email domain match)
router.get("/schools", async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string || "").trim();
    const state = (req.query.state as string || "").trim();
    const domain = (req.query.domain as string || "").trim().toLowerCase();

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
    console.error("School directory search error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/google/register-school — initiate school registration via magic link
router.post("/register-school", registerSchoolLimiter, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      registrationToken: z.string(), // JWT with Google profile
      directorySchoolId: z.string().optional(), // if chosen from directory
      schoolName: z.string().min(1).max(255), // fallback if not in directory
      schoolState: z.string().max(50).optional(),
      schoolCity: z.string().max(100).optional(),
      schoolZip: z.string().regex(/^\d{5}$/).optional(),
      contactEmail: z.string().email(), // where to send magic link
    });
    const data = schema.parse(req.body);

    // Verify the registration token (contains Google profile)
    let googleProfile: any;
    try {
      const jwt = await import("jsonwebtoken");
      googleProfile = jwt.default.verify(data.registrationToken, process.env.JWT_SECRET!);
    } catch {
      return res.status(400).json({ error: "Registration token is invalid or expired. Please sign in with Google again." });
    }

    if (!googleProfile.pendingSchoolAdmin) {
      return res.status(400).json({ error: "Invalid registration token" });
    }

    // Block personal/consumer email providers on the contact email (production only)
    if (IS_PRODUCTION && isPersonalEmailDomain(data.contactEmail)) {
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
      if (dirEntry?.claimed) {
        // Find the registered school and return contact info
        const existingSchool = await prisma.school.findFirst({
          where: { directoryId: data.directorySchoolId },
          include: { createdBy: { select: { email: true } } },
        });
        return res.status(409).json({
          error: "This school is already registered.",
          contactEmail: existingSchool?.registrationEmail || existingSchool?.createdBy?.email || null,
        });
      }

      // Validate contact email domain against the school's known domain.
      // Prefer the explicit emailDomain field; fall back to parsing the website URL.
      const schoolDomain = dirEntry?.emailDomain || (dirEntry?.website ? extractDomainFromWebsite(dirEntry.website) : null);
      if (schoolDomain) {
        const contactDomain = getEmailDomain(data.contactEmail);
        const isEdu = contactDomain.endsWith(".edu");
        if (!isEdu && !emailDomainMatchesSchool(contactDomain, schoolDomain)) {
          return res.status(400).json({
            error: `Contact email domain does not match the school's domain (${schoolDomain}). Please use your school's official email address.`,
            code: "DOMAIN_MISMATCH",
          });
        }
      }
    }

    // Generate magic link token
    const magicToken = crypto.randomBytes(32).toString("hex");
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

    // Check if this user already has a school
    if (adminUser.schoolId) {
      const school = await prisma.school.findUnique({ where: { id: adminUser.schoolId } });

      // If onboarding is already complete, just return the existing session — no email needed
      if (school?.onboardingComplete) {
        const token = signToken({ userId: adminUser.id, email: adminUser.email, role: adminUser.role });
        return res.json({
          alreadyRegistered: true,
          token,
          user: { id: adminUser.id, email: adminUser.email, name: adminUser.name, role: adminUser.role, schoolId: adminUser.schoolId },
          school,
        });
      }

      // School exists but onboarding is incomplete — regenerate the magic link and resend.
      // This handles the case where the previous send failed or the token expired.
      const magicToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const contactEmail = data.contactEmail || school?.registrationEmail;

      if (!contactEmail) {
        return res.status(400).json({ error: "Cannot resend: no contact email on file. Please restart registration." });
      }

      await prisma.school.update({
        where: { id: school!.id },
        data: { registrationToken: magicToken, registrationTokenExpires: expiresAt, registrationEmail: contactEmail },
      });

      const magicLink = `${CLIENT_URL}/school/verify-registration?token=${magicToken}`;
      await sendSchoolRegistrationMagicLink(contactEmail, school!.name, magicLink);

      return res.json({
        message: "A new registration link has been sent. Please check your inbox.",
        schoolId: school!.id,
        schoolName: school!.name,
        sentTo: contactEmail,
      });
    }

    // Create the school record with registration magic link
    const dirEntry = data.directorySchoolId
      ? await prisma.schoolDirectory.findUnique({ where: { id: data.directorySchoolId } })
      : null;

    const school = await prisma.school.create({
      data: {
        name: dirEntry?.name || data.schoolName,
        type: dirEntry?.type || null,
        address: dirEntry?.address || null,
        city: dirEntry?.city || data.schoolCity || null,
        state: dirEntry?.state || data.schoolState || null,
        zip: dirEntry?.zip || data.schoolZip || null,
        latitude: dirEntry?.latitude || null,
        longitude: dirEntry?.longitude || null,
        directoryId: data.directorySchoolId || null,
        domain: dirEntry?.emailDomain || null,
        verified: false,
        createdById: adminUser.id,
        registrationToken: magicToken,
        registrationTokenExpires: expiresAt,
        registrationEmail: data.contactEmail,
      },
    });

    // Link admin to school
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { schoolId: school.id },
    });

    // Mark directory entry as claimed
    if (data.directorySchoolId) {
      await prisma.schoolDirectory.update({
        where: { id: data.directorySchoolId },
        data: { claimed: true, claimedBySchoolId: school.id },
      }).catch(() => {});
    }

    // Create the school's private beneficiary so it can post opportunities immediately
    const schoolBeneficiary = await prisma.beneficiary.create({
      data: {
        name: school.name,
        visibility: "PRIVATE",
        status: "ACTIVE",
        createdBySchoolId: school.id,
      },
    });
    await prisma.schoolBeneficiaryApproval.create({
      data: {
        schoolId: school.id,
        beneficiaryId: schoolBeneficiary.id,
        status: "APPROVED",
        approvedAt: new Date(),
      },
    });

    // Link to BeneficiaryDirectory if a directory school was chosen
    try {
      await linkSchoolToBeneficiaryDirectory(school.id, data.directorySchoolId);
    } catch (err) {
      console.error("[register-school] Failed to link school to BeneficiaryDirectory:", err);
    }

    // Send magic link to contact email
    const magicLink = `${CLIENT_URL}/school/verify-registration?token=${magicToken}`;
    await sendSchoolRegistrationMagicLink(data.contactEmail, school.name, magicLink);

    res.json({
      message: "Registration link sent to the school email address. Please check the inbox to complete registration.",
      schoolId: school.id,
      schoolName: school.name,
      sentTo: data.contactEmail,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Register school error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/google/verify-school?token=xxx — complete school registration from magic link
router.get("/verify-school", async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Token is required" });
    }

    const school = await prisma.school.findFirst({
      where: {
        registrationToken: token,
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

    // Mark school as verified
    await prisma.school.update({
      where: { id: school.id },
      data: {
        verified: true,
        registrationToken: null,
        registrationTokenExpires: null,
      },
    });

    // Return auth token for the admin
    const adminUser = school.createdBy;
    const jwtToken = signToken({ userId: adminUser.id, email: adminUser.email, role: adminUser.role });

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
    console.error("Verify school registration error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
