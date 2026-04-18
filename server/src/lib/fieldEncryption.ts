/**
 * Application-level field encryption using AES-256-GCM.
 *
 * Purpose: encrypt highly sensitive PII (phone numbers, etc.) before writing
 * to the database so that a database dump alone does not expose plaintext data.
 *
 * Requirements:
 *   FIELD_ENCRYPTION_KEY — 64 hex chars (32 bytes). Generate with:
 *     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Format of encrypted values stored in the DB:
 *   <hex-iv>:<hex-authTag>:<hex-ciphertext>
 *
 * If FIELD_ENCRYPTION_KEY is not set the functions are no-ops (passthrough) so
 * the app stays functional during gradual rollout, but a warning is logged once.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit IV recommended for GCM
const TAG_BYTES = 16;
const PREFIX = "enc:v1:";

let _key: Buffer | null = null;
let _warnedOnce = false;

function isProdLike(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function getKey(): Buffer | null {
  if (_key) return _key;
  const hex = process.env.FIELD_ENCRYPTION_KEY;
  if (!hex) {
    if (isProdLike()) {
      throw new Error("[fieldEncryption] FIELD_ENCRYPTION_KEY is required in production.");
    }
    if (!_warnedOnce) {
      console.warn(
        "[fieldEncryption] FIELD_ENCRYPTION_KEY is not set — sensitive fields will be stored in plaintext. " +
        "Set a 64-hex-char key in env to enable encryption."
      );
      _warnedOnce = true;
    }
    return null;
  }
  if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
    if (isProdLike()) {
      throw new Error("[fieldEncryption] FIELD_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes) in production.");
    }
    console.error("[fieldEncryption] FIELD_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Encryption disabled.");
    return null;
  }
  _key = Buffer.from(hex, "hex");
  return _key;
}

/** Encrypt a plaintext string. Returns the encrypted token, or plaintext if key is not configured. */
export function encryptField(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined) return null;
  const key = getKey();
  if (!key) return plaintext; // passthrough — key not configured

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return PREFIX + [iv.toString("hex"), authTag.toString("hex"), ciphertext.toString("hex")].join(":");
}

/** Decrypt an encrypted token. Returns plaintext, or the value as-is if it was never encrypted. */
export function decryptField(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (!value.startsWith(PREFIX)) return value; // not encrypted — return as-is

  const key = getKey();
  if (!key) {
    // Key disappeared after being set — this is a config error
    console.error("[fieldEncryption] Cannot decrypt: FIELD_ENCRYPTION_KEY is not set but encrypted data exists.");
    return null;
  }

  try {
    const parts = value.slice(PREFIX.length).split(":");
    if (parts.length !== 3) throw new Error("Invalid encrypted field format");
    const [ivHex, tagHex, ciphertextHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(tagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    if (iv.length !== IV_BYTES || authTag.length !== TAG_BYTES) throw new Error("Invalid IV or tag length");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (err) {
    console.error("[fieldEncryption] Decryption failed:", err);
    return null;
  }
}

/** Returns true if the value is an encrypted token (regardless of whether it can be decrypted). */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}
