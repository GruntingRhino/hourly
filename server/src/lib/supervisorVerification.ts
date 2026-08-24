import crypto from "node:crypto";
export interface SupervisorVerificationPayload { verificationId: string; serviceRecordId: string; supervisorEmail: string; expiresAt: number; }
function sign(encoded: string, secret: string) { return crypto.createHmac("sha256", secret).update(encoded).digest("base64url"); }
export function createSupervisorVerificationToken(params: { verificationId: string; serviceRecordId: string; supervisorEmail: string; expiresAt: Date; secret: string }): string {
  if (!params.secret || !params.supervisorEmail.includes("@")) throw new Error("Invalid supervisor verification parameters");
  const encoded = Buffer.from(JSON.stringify({ verificationId: params.verificationId, serviceRecordId: params.serviceRecordId, supervisorEmail: params.supervisorEmail.toLowerCase(), expiresAt: params.expiresAt.getTime() })).toString("base64url");
  return `${encoded}.${sign(encoded, params.secret)}`;
}
export function consumeSupervisorVerificationToken(token: string, params: { secret: string; now?: Date; authorizedDomains: string[]; consumedIds: Set<string> }): SupervisorVerificationPayload {
  const separator = token.lastIndexOf("."); if (separator <= 0) throw new Error("Invalid verification token");
  const encoded = token.slice(0, separator); const supplied = Buffer.from(token.slice(separator + 1), "base64url"); const expected = Buffer.from(sign(encoded, params.secret), "base64url");
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) throw new Error("Invalid verification token");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SupervisorVerificationPayload;
  if (payload.expiresAt <= (params.now ?? new Date()).getTime() || params.consumedIds.has(payload.verificationId)) throw new Error("Expired or replayed verification token");
  const domain = payload.supervisorEmail.split("@")[1]?.toLowerCase();
  if (!domain || !params.authorizedDomains.map((item) => item.toLowerCase()).includes(domain)) throw new Error("Supervisor email domain is not authorized");
  params.consumedIds.add(payload.verificationId); return payload;
}
