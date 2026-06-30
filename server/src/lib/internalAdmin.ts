const IS_PROD_LIKE =
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production" ||
  process.env.APP_ENV === "production";

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

  // Local fallback so the internal queue is testable without production allowlist config.
  if (!IS_PROD_LIKE && input.role === "SCHOOL_ADMIN") return true;

  return false;
}
