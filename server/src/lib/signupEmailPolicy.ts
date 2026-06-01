const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "yahoo.com", "ymail.com", "yahoo.co.uk", "yahoo.co.in", "yahoo.com.au",
  "yahoo.fr", "yahoo.de", "yahoo.es", "yahoo.it", "yahoo.ca",
  "hotmail.com", "outlook.com", "live.com", "msn.com",
  "hotmail.co.uk", "hotmail.fr", "hotmail.de", "hotmail.es",
  "live.co.uk", "live.fr",
  "icloud.com", "me.com", "mac.com",
  "aol.com", "aim.com", "verizon.net",
  "protonmail.com", "pm.me", "proton.me",
  "tutanota.com", "tuta.com",
  "gmx.com", "gmx.net", "mail.com",
  "zoho.com", "zohomail.com",
  "yandex.com", "yandex.ru",
  "qq.com", "163.com", "126.com",
  "mail.ru", "inbox.com", "rediffmail.com",
  "comcast.net", "att.net", "sbcglobal.net", "cox.net",
]);

export const QA_SIGNUP_BYPASS_PATTERNS = [
  /^abhay\.sivaram\+[^@]+@gmail\.com$/i,
  /^vaneeta\.singh\+[^@]+@gmail\.com$/i,
];

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isPersonalEmailDomain(email: string): boolean {
  const domain = normalizeEmail(email).split("@")[1]?.trim() || "";
  return PERSONAL_EMAIL_DOMAINS.has(domain);
}

/** Strips https://, http://, www. and any path/query from a URL to get the bare domain. */
export function extractDomainFromWebsite(website: string): string | null {
  if (!website?.trim()) return null;
  try {
    let url = website.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) url = "https://" + url;
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Returns true if emailDomain matches or is a subdomain of websiteDomain. */
export function emailDomainMatchesWebsite(emailDomain: string, websiteDomain: string): boolean {
  const normalizedEmailDomain = emailDomain.trim().toLowerCase();
  const normalizedWebsiteDomain = websiteDomain.trim().toLowerCase();
  return (
    normalizedEmailDomain === normalizedWebsiteDomain ||
    normalizedEmailDomain.endsWith("." + normalizedWebsiteDomain)
  );
}

export function isQaSignupBypassEmail(
  email: string,
  allowQaSignupBypass: boolean,
  patterns: readonly RegExp[] = QA_SIGNUP_BYPASS_PATTERNS,
): boolean {
  if (!allowQaSignupBypass) return false;
  const normalized = normalizeEmail(email);
  return patterns.some((pattern) => pattern.test(normalized));
}
