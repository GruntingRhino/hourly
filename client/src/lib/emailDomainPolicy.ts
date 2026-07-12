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
  "yandex.com", "yandex.ru",
  "qq.com", "163.com", "126.com",
  "mail.ru", "inbox.com", "rediffmail.com",
  "comcast.net", "att.net", "sbcglobal.net", "cox.net",
]);

export type EmailDomainStatus = "personal" | "edu" | "custom" | null;

export function classifyEmailDomain(
  email: string,
  isProduction: boolean,
  allowPersonalEmailDomains: boolean,
): EmailDomainStatus {
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return null;

  const domain = email.slice(atIdx + 1).toLowerCase().trim();
  if (!domain || !domain.includes(".")) return null;
  if (isProduction && !allowPersonalEmailDomains && PERSONAL_EMAIL_DOMAINS.has(domain)) {
    return "personal";
  }
  return domain.endsWith(".edu") ? "edu" : "custom";
}
