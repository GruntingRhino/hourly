import { isPubliclyDeployed } from "./isProdLike";

function parseEmailAllowlist(raw: string | undefined): Set<string> {
  return new Set(
    (raw || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

const INTERNAL_ADMIN_EMAILS = parseEmailAllowlist(
  process.env.GOODHOURS_INTERNAL_ADMIN_EMAILS || process.env.INTERNAL_ADMIN_EMAILS
);

export function isInternalAdminUser(input: { email?: string | null; role?: string | null }): boolean {
  const email = (input.email || "").trim().toLowerCase();
  if (email && INTERNAL_ADMIN_EMAILS.has(email)) return true;

  // Local-only fallback so the internal queue is testable without allowlist config.
  // isPubliclyDeployed (not isProdLike) so this never activates on a Vercel preview
  // deployment — every SCHOOL_ADMIN account would otherwise silently gain internal-
  // operator privileges (impersonation review-queue access, billing/internal routes)
  // on any preview URL, not just genuinely local dev.
  if (!isPubliclyDeployed() && input.role === "SCHOOL_ADMIN") return true;

  return false;
}
