/**
 * Single-use token helpers.
 *
 * Raw tokens (password reset, email verification, invitations, registration
 * magic links) are emailed to users; only their SHA-256 digest is stored in
 * the database. A database dump therefore cannot be used to redeem a token.
 *
 * Lookups must hash the presented token and compare against the stored digest.
 */

import crypto from "crypto";

/** Generate a new single-use token (64 hex chars, 256 bits of entropy). */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Digest a raw token for storage or lookup. */
export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
