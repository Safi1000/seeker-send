/**
 * Pure helpers for exact part-number matching and email extraction.
 * No I/O — easy to unit test and reused by both the real and mock search.
 */

/**
 * Exact part-number match.
 *
 * The part number must appear as a standalone token — not as a substring of a
 * longer alphanumeric token. This is the spec's hard rule:
 *
 *   searching "900063"
 *     page has "900063"   -> VALID
 *     page has "900064"   -> INVALID (different number)
 *     page has "900063A"  -> INVALID (longer token)
 *
 * No fuzzy / similarity / AI matching of any kind.
 */
export function pageContainsExactPartNumber(pageText: string, partNumber: string): boolean {
  const pn = partNumber.trim();
  if (!pn) return false;
  const escaped = pn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Disallow an alphanumeric character immediately before or after. Lookbehind
  // is supported in modern Node. Hyphens within the part number are treated as
  // part of the token already (e.g. "2010B-2111-MS").
  const re = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`);
  return re.test(pageText);
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const EMAIL_BLOCKLIST = [
  "example.com",
  "sentry.io",
  "wixpress.com",
  "domain.com",
  "email.com",
  "yourcompany.com",
  "@2x",
];

// Common multi-letter gTLDs. Any 2-letter (country) TLD is also accepted, so
// these only need to cover the generic ones. Anything else (e.g. ".aoewam") is
// treated as a junk / honeypot address and dropped.
const VALID_GTLDS = new Set([
  "com", "net", "org", "info", "biz", "edu", "gov", "mil", "int", "io", "co",
  "ai", "app", "dev", "tech", "online", "store", "shop", "site", "web", "cloud",
  "digital", "solutions", "services", "systems", "industries", "industrial",
  "supply", "supplies", "equipment", "company", "global", "world", "group",
  "name", "pro", "mobi", "asia", "email", "ltd", "inc", "llc", "gmbh", "agency",
  "engineering", "energy", "tools", "parts", "trade", "trading", "xyz",
]);

const ASSET_EXT = /\.(png|jpg|jpeg|gif|svg|webp|css|js|json|woff2?|ttf)$/i;

/** Reject obvious junk: bad TLD, or a random-looking domain (long consonant run). */
function isPlausibleEmail(email: string): boolean {
  const at = email.indexOf("@");
  if (at < 1) return false;
  const domain = email.slice(at + 1);
  const labels = domain.split(".");
  const tld = labels[labels.length - 1];
  if (!tld) return false;
  if (tld.length !== 2 && !VALID_GTLDS.has(tld)) return false; // ccTLD or known gTLD only

  // Random-string domains (honeypots) have long consonant runs; real ones don't.
  const sld = labels[labels.length - 2] ?? "";
  if (/[bcdfghjklmnpqrstvwxz]{5,}/i.test(sld)) return false;
  return true;
}

/** Extract plausible contact emails from a blob of HTML/text. */
export function extractEmails(text: string): string[] {
  const found = text.match(EMAIL_RE) ?? [];
  const cleaned = found
    .map((e) => e.toLowerCase().replace(/\.$/, ""))
    .filter((e) => !EMAIL_BLOCKLIST.some((b) => e.includes(b)))
    .filter((e) => !ASSET_EXT.test(e))
    .filter(isPlausibleEmail);
  return Array.from(new Set(cleaned));
}

/**
 * Pick the best email for procurement contact. Prefer sales/purchasing/info
 * mailboxes, then anything else.
 */
export function pickBestEmail(emails: string[]): string | null {
  if (emails.length === 0) return null;
  const priority = ["sales", "purchasing", "quote", "rfq", "info", "contact", "enquir", "support"];
  for (const p of priority) {
    const hit = emails.find((e) => e.split("@")[0].includes(p));
    if (hit) return hit;
  }
  return emails[0];
}

/** Derive a human-friendly supplier name from a URL + optional page title. */
export function deriveSupplierName(url: string, title?: string | null): string {
  if (title) {
    // Page titles are often "Product Name | Brand" — take the brand-ish part.
    const parts = title.split(/[|\-–—:]/).map((s) => s.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && last.length >= 2 && last.length <= 60) return last;
  }
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const base = host.split(".")[0];
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return "Unknown Supplier";
  }
}

export function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}
