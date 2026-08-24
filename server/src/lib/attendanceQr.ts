import crypto from "crypto";

export interface AttendanceQrTokenPayload {
  tokenId: string;
  opportunityId: string;
  expiresAt: Date;
}

interface EncodedAttendanceQrPayload {
  tokenId: string;
  opportunityId: string;
  expiresAt: number;
}

function encodePayload(payload: EncodedAttendanceQrPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function signPayload(encodedPayload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createAttendanceQrToken(params: {
  tokenId: string;
  opportunityId: string;
  expiresAt: Date;
  secret: string;
}): string {
  if (!params.secret) throw new Error("Attendance QR secret is required");
  if (!params.tokenId || !params.opportunityId) throw new Error("Attendance QR token identifiers are required");
  if (!Number.isFinite(params.expiresAt.getTime())) throw new Error("Attendance QR expiry is invalid");

  const encodedPayload = encodePayload({
    tokenId: params.tokenId,
    opportunityId: params.opportunityId,
    expiresAt: params.expiresAt.getTime(),
  });
  return `${encodedPayload}.${signPayload(encodedPayload, params.secret)}`;
}

export function parseAttendanceQrToken(
  token: string,
  secret: string,
  now = new Date(),
): AttendanceQrTokenPayload | null {
  if (!token || !secret) return null;
  const separator = token.lastIndexOf(".");
  if (separator <= 0 || separator === token.length - 1) return null;

  const encodedPayload = token.slice(0, separator);
  const suppliedSignature = token.slice(separator + 1);
  const expectedSignature = signPayload(encodedPayload, secret);
  const supplied = Buffer.from(suppliedSignature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<EncodedAttendanceQrPayload>;
    if (
      typeof payload.tokenId !== "string" ||
      typeof payload.opportunityId !== "string" ||
      typeof payload.expiresAt !== "number" ||
      !Number.isSafeInteger(payload.expiresAt) ||
      payload.expiresAt <= now.getTime()
    ) return null;

    return {
      tokenId: payload.tokenId,
      opportunityId: payload.opportunityId,
      expiresAt: new Date(payload.expiresAt),
    };
  } catch {
    return null;
  }
}

export function hashAttendanceQrToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}
