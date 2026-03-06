import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import prisma from "../lib/prisma";
import { signToken } from "../middleware/auth";
import { sendSchoolRegistrationMagicLink, CLIENT_URL } from "../services/email";

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL ?? `${CLIENT_URL}/api/auth/google/callback`;

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

    // New user — they need to complete school registration
    // Return a temporary token containing their Google profile for the frontend
    // to use in the school search + registration flow
    const tempToken = crypto.randomBytes(32).toString("hex");
    // Store temp registration state in a short-lived token record
    // We encode data in the temp token itself (signed with JWT secret)
    const regToken = signToken(
      { googleId, email, name: name || email, pendingSchoolAdmin: true },
      { expiresIn: "1h" }
    );

    return res.status(202).json({
      requiresSchoolRegistration: true,
      registrationToken: regToken,
      email,
      name: name || "",
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Google auth callback error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/google/schools — search school directory (unauthenticated, for registration)
router.get("/schools", async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string || "").trim();
    const state = (req.query.state as string || "").trim();

    if (search.length < 2) {
      return res.json([]);
    }

    const schools = await prisma.schoolDirectory.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { city: { contains: search, mode: "insensitive" } },
            ],
          },
          ...(state ? [{ state: { equals: state, mode: "insensitive" as any } }] : []),
        ],
      },
      take: 20,
      orderBy: { name: "asc" },
    });

    res.json(schools);
  } catch (err) {
    console.error("School directory search error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/google/register-school — initiate school registration via magic link
router.post("/register-school", async (req: Request, res: Response) => {
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
      googleProfile = jwt.default.verify(data.registrationToken, process.env.JWT_SECRET || "dev-secret");
    } catch {
      return res.status(400).json({ error: "Registration token is invalid or expired. Please sign in with Google again." });
    }

    if (!googleProfile.pendingSchoolAdmin) {
      return res.status(400).json({ error: "Invalid registration token" });
    }

    // Check if school directory entry exists and is already claimed
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
      const token = signToken({ userId: adminUser.id, email: adminUser.email, role: adminUser.role });
      return res.json({
        alreadyRegistered: true,
        token,
        user: { id: adminUser.id, email: adminUser.email, name: adminUser.name, role: adminUser.role, schoolId: adminUser.schoolId },
        school,
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
