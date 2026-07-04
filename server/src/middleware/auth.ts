import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

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

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = header.slice(7);
  void (async () => {
    try {
      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, role: true, status: true, tokenVersion: true },
      });

      if (!user || user.status !== "ACTIVE") {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      // Tokens issued before a password change/reset carry an older version
      // (or none at all) and are no longer accepted.
      if ((payload.tv ?? 0) !== user.tokenVersion) {
        return res.status(401).json({ error: "Invalid or expired token" });
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
  return signToken({ userId: user.id, email: user.email, role: user.role, tv: user.tokenVersion });
}
