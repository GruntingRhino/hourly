const OPAQUE_ID_PATTERN = /^[a-z0-9]{20,}$/i;

function isLikelyInternalId(value: unknown): boolean {
  return typeof value === "string" && OPAQUE_ID_PATTERN.test(value.trim());
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\bId\b/g, "ID")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

export function formatAuditDetails(raw: string | null): string {
  if (!raw) return "";

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const visibleEntries = Object.entries(parsed).filter(([key, value]) => {
      if (/id$/i.test(key)) return false;
      if (isLikelyInternalId(value)) return false;
      return value !== null && value !== undefined && String(value).trim() !== "";
    });

    if (visibleEntries.length === 0) {
      return "";
    }

    return visibleEntries
      .map(([key, value]) => `${humanizeKey(key)}: ${String(value)}`)
      .join(" · ");
  } catch {
    return raw;
  }
}
