import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// JWT_SECRET must be set. env.ts calls process.exit(1) at startup if missing,
// so this cast is safe — but we still refuse to fall back to any default.
const JWT_SECRET = process.env.JWT_SECRET as string;

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
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
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function signToken(payload: object, options?: { expiresIn?: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: options?.expiresIn ?? "7d" } as any);
}
