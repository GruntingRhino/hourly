import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { isInternalAdminUser } from "../lib/internalAdmin";
import { evaluateSessionEligibility } from "../lib/schoolAuthority";
import { AUTH_COOKIE_NAME } from "../lib/authCookies";

const PENDING_SETUP_PATHS = ["/me", "/profile", "/password", "/ownership-approval/resend", "/eligibility/attest"];
function isPendingSetupRoute(req: Request): boolean {
  return req.baseUrl === "/api/auth" && PENDING_SETUP_PATHS.includes(req.path);
}

// JWT_SECRET must be set. env.ts calls process.exit(1) at startup if missing,
// so this cast is safe — but we still refuse to fall back to any default.
const JWT_SECRET = process.env.JWT_SECRET as string;

// Optional previous secret for zero-downtime rotation: new tokens are signed
// with JWT_SECRET; verification falls back to JWT_SECRET_PREVIOUS so sessions
// issued before a rotation stay valid until they expire (max 7 days).
// See docs/jwt-secret-rotation.md for the rotation runbook.
const JWT_SECRET_PREVIOUS = process.env.JWT_SECRET_PREVIOUS || "";

/**
 * Verify a JWT against the current signing secret, falling back to the
 * previous secret during a rotation window. Throws like jwt.verify on failure.
 */
export function verifyToken<T = AuthPayload>(token: string): T {
  try {
    return jwt.verify(token, JWT_SECRET) as T;
  } catch (err) {
    if (JWT_SECRET_PREVIOUS && JWT_SECRET_PREVIOUS !== JWT_SECRET) {
      return jwt.verify(token, JWT_SECRET_PREVIOUS) as T;
    }
    throw err;
  }
}

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
  /** Token version — must match User.tokenVersion or the token is revoked. */
  tv?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * Prefer the HttpOnly session cookie (§15 migration); fall back to the
 * Authorization header for any client/tooling not yet switched over.
 */
function extractToken(req: Request): string | null {
  const cookieToken = (req as unknown as { cookies?: Record<string, string> }).cookies?.[AUTH_COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return null;
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  void (async () => {
    try {
      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          tokenVersion: true,
          emailVerified: true,
          eligibilityAttestation: { select: { eligible13Plus: true } },
          school: {
            select: { verified: true, ownershipStatus: true },
          },
        },
      });

      if (!user) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      // Tokens issued before a password change/reset carry an older version
      // (or none at all) and are no longer accepted.
      if ((payload.tv ?? 0) !== user.tokenVersion) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      const eligibility = evaluateSessionEligibility({
        ...user,
        isInternalAdmin: isInternalAdminUser(user),
      });
      if (eligibility.allowed === false) {
        return res.status(eligibility.status).json({
          error: eligibility.error,
          code: eligibility.code,
        });
      }

      if (eligibility.setupOnly && !isPendingSetupRoute(req)) {
        return res.status(403).json({
          error: user.eligibilityAttestation?.eligible13Plus === true
            ? "School ownership approval is pending. Only account setup is available."
            : "Age eligibility confirmation is required before continuing.",
          code: user.eligibilityAttestation?.eligible13Plus === true ? "SCHOOL_SETUP_ONLY" : "AGE_ELIGIBILITY_REQUIRED",
        });
      }

      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };
      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  })();
}

export function signToken(payload: object, options?: { expiresIn?: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: options?.expiresIn ?? "7d" } as any);
}

/**
 * Sign a session token for a user. Embeds the user's current tokenVersion so
 * the token can be revoked by bumping User.tokenVersion (password change/reset).
 */
export function signUserToken(user: {
  id: string;
  email: string;
  role: string;
  tokenVersion: number;
}): string {
  const expiresIn = user.role === "STUDENT" ? "24h" : "7d";
  return signToken({ userId: user.id, email: user.email, role: user.role, tv: user.tokenVersion }, { expiresIn });
}
