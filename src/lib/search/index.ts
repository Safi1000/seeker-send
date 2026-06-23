import "server-only";
import { getEnv } from "@/lib/env";
import type { MatchType, RfqItem, SupplierCandidate } from "@/lib/types";
import {
  deriveSupplierName,
  extractEmails,
  originOf,
  pageContainsExactPartNumber,
  pickBestEmail,
} from "./matching";

/**
 * Supplier discovery — an escalating ladder, stopping at the first stage that
 * yields a supplier we can email:
 *
 *   1. PART_NUMBER  — search the exact part number; accept only pages where it
 *                     literally appears (highest confidence).
 *   2. DESCRIPTION  — search the full item description; still verify the part
 *                     number appears on the page.
 *   3. MANUFACTURER — find the manufacturer's own site + contact email and email
 *                     them directly, regardless of whether they list the part
 *                     (lowest confidence; flagged in the UI).
 *   4. (none)       — nothing emailable found; the item is flagged.
 *
 * Result URLs come from the Serper API; each page is fetched over plain HTTP
 * (no headless browser) to apply the gate and harvest a contact email. This
 * keeps memory flat (~no Chromium), so large RFQs run on a 512MB host. Mock
 * mode returns deterministic fakes.
 */

export interface SearchOutcome {
  candidates: SupplierCandidate[];
  /** "FOUND" when at least one emailable supplier, else "NOT_FOUND" (flagged). */
  result: "FOUND" | "NOT_FOUND";
  usedMock: boolean;
}

export async function searchSuppliersForItem(item: RfqItem): Promise<SearchOutcome> {
  const env = getEnv();
  const pn = item.part_number?.trim() ?? "";

  if (env.mockSearch) {
    const candidates = mockCandidates(pn || item.manufacturer || "item");
    return { candidates, result: candidates.length ? "FOUND" : "NOT_FOUND", usedMock: true };
  }

  if (!env.serperApiKey) {
    console.error(
      "[search] SERPER_API_KEY is not set — cannot run supplier search. " +
        "Get a free key at https://serper.dev, or use MOCK_SEARCH=true.",
    );
    return { candidates: [], result: "NOT_FOUND", usedMock: false };
  }

  try {
    // Stage 1 — exact part number. Include the manufacturer in the QUERY so
    // results are biased toward the right industrial/technical listings (a
    // bare part number like "900063" otherwise matches real-estate listing
    // IDs etc.). The on-page gate still requires the exact part number.
    if (pn) {
      const query = [pn, item.manufacturer?.trim()].filter(Boolean).join(" ");
      const urls = await serperUrls(query, env.serperApiKey, env.searchMaxResults);
      const found = await inspectUrls(urls, { partNumber: pn, matchType: "PART_NUMBER" });
      if (found.length) return done(found);
    }

    // Stage 2 — full description (part number still verified on page).
    const descQuery = buildDescriptionQuery(item);
    if (descQuery && descQuery !== pn) {
      const urls = await serperUrls(descQuery, env.serperApiKey, env.searchMaxResults);
      const found = await inspectUrls(urls, {
        partNumber: pn || null,
        matchType: "DESCRIPTION",
      });
      if (found.length) return done(found);
    }

    // Stage 3 — manufacturer direct (no part-number gate).
    if (item.manufacturer) {
      const found = await findManufacturerContact(item.manufacturer, env);
      if (found.length) return done(found);
    }

    // Stage 4 — nothing emailable; flag the item.
    return { candidates: [], result: "NOT_FOUND", usedMock: false };
  } catch (err) {
    console.error("[search] supplier search failed:", err);
    return { candidates: [], result: "NOT_FOUND", usedMock: false };
  }
}

function done(candidates: SupplierCandidate[]): SearchOutcome {
  // Collapse duplicate emails so the same supplier is never stored — and so a
  // bulk send can't email the same address twice for one item.
  const seen = new Set<string>();
  const deduped: SupplierCandidate[] = [];
  for (const c of candidates) {
    const key = c.email?.toLowerCase();
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    deduped.push(c);
  }
  return { candidates: deduped, result: deduped.length ? "FOUND" : "NOT_FOUND", usedMock: false };
}

/** Build a description query from the most identifying item fields. */
function buildDescriptionQuery(item: RfqItem): string {
  return [item.product, item.manufacturer, item.part_number, item.analyzer_model, item.application]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 256);
}

// ---------------------------------------------------------------------------
// Serper.dev (Google results via API)
// ---------------------------------------------------------------------------

async function serperUrls(query: string, apiKey: string, maxResults: number): Promise<string[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    // Unquoted: Serper's free tier rejects quoted/exact-phrase patterns.
    body: JSON.stringify({ q: query, num: 20 }),
  });
  if (!res.ok) throw new Error(`Serper ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { organic?: { link?: string }[] };
  const raw = (json.organic ?? []).map((r) => r.link ?? "").filter(Boolean);
  return dedupeByDomain(raw).slice(0, maxResults);
}

// ---------------------------------------------------------------------------
// Plain-HTTP page fetch — no headless browser.
//
// We only need each page's text + emails, so a raw GET (assets never
// requested) is dramatically lighter than Chromium and runs on tiny hosts.
// Trade-off vs. Playwright: pages whose content is injected purely by
// client-side JS won't expose their text/emails. Most supplier product and
// contact pages are server-rendered, so coverage stays high.
// ---------------------------------------------------------------------------

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

async function fetchHtml(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    const ctype = res.headers.get("content-type") ?? "";
    // Skip binaries (PDFs, images) — we only parse HTML/text.
    if (ctype && !/text\/html|application\/xhtml|text\/plain|application\/xml/i.test(ctype)) {
      return null;
    }
    return await res.text();
  } catch {
    return null; // timeout, DNS failure, TLS error, etc. — just skip the page
  } finally {
    clearTimeout(timer);
  }
}

/** Strip HTML to visible-ish text so the exact part-number gate can run. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ");
}

/** Pull the <title> text out of a page's HTML. */
function htmlTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  return m[1].replace(/\s+/g, " ").trim() || null;
}

// ---------------------------------------------------------------------------
// Open candidates, gate, harvest email
// ---------------------------------------------------------------------------

interface InspectOpts {
  /** When set, a page is only accepted if it contains this exact part number. */
  partNumber: string | null;
  matchType: MatchType;
}

async function inspectUrls(urls: string[], opts: InspectOpts): Promise<SupplierCandidate[]> {
  const out: SupplierCandidate[] = [];
  const seen = new Set<string>();

  for (const url of urls) {
    const domain = safeDomain(url);
    if (!domain || seen.has(domain)) continue;
    const html = await fetchHtml(url, 20000);
    if (!html) continue;
    if (opts.partNumber) {
      const text = htmlToText(html);
      if (!pageContainsExactPartNumber(text, opts.partNumber)) continue;
    }
    seen.add(domain);
    const { email, emailSourceUrl } = await findEmail(url, html);
    out.push({
      supplierName: deriveSupplierName(url, htmlTitle(html)),
      website: originOf(url),
      productUrl: url,
      email,
      emailSourceUrl,
      matchType: opts.matchType,
    });
  }
  return out;
}

/**
 * Stage 3: locate the manufacturer's own website and a contact email. We accept
 * the result whose domain best matches the manufacturer name (or the first
 * result), without requiring the part number on the page.
 */
async function findManufacturerContact(
  manufacturer: string,
  env: ReturnType<typeof getEnv>,
): Promise<SupplierCandidate[]> {
  const urls = await serperUrls(`${manufacturer} official website contact`, env.serperApiKey!, 8);
  const words = manufacturer.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  // Prefer a result whose domain contains a manufacturer word.
  const ranked = [...urls].sort((a, b) => score(b) - score(a));
  function score(u: string): number {
    const d = safeDomain(u) ?? "";
    return words.some((w) => d.includes(w)) ? 1 : 0;
  }

  for (const url of ranked) {
    const html = await fetchHtml(url, 20000);
    if (!html) continue;
    const { email, emailSourceUrl } = await findEmail(url, html);
    if (!email) continue; // only useful if we can actually contact them
    return [
      {
        supplierName: manufacturer,
        website: originOf(url),
        productUrl: url,
        email,
        emailSourceUrl,
        matchType: "MANUFACTURER",
      },
    ];
  }
  return [];
}

/** Look for an email on the page, then common contact/about pages. */
async function findEmail(
  productUrl: string,
  productHtml: string,
): Promise<{ email: string | null; emailSourceUrl: string | null }> {
  const onPage = pickBestEmail(extractEmails(productHtml));
  if (onPage) return { email: onPage, emailSourceUrl: productUrl };

  const origin = originOf(productUrl);
  const paths = ["/contact", "/contact-us", "/about"];
  for (const path of paths) {
    const target = origin + path;
    const html = await fetchHtml(target, 15000);
    if (!html) continue;
    const email = pickBestEmail(extractEmails(html));
    if (email) return { email, emailSourceUrl: target };
  }
  return { email: null, emailSourceUrl: null };
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function safeDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function dedupeByDomain(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const d = safeDomain(u);
    if (!d || seen.has(d)) continue;
    // Skip search engines, social, marketplaces, and irrelevant verticals
    // (real estate, jobs, Q&A) that pollute bare-number searches.
    if (
      /duckduckgo|google|bing|yahoo|facebook|youtube|linkedin|twitter|x\.com|reddit|pinterest|instagram|tiktok|wikipedia|quora|zillow|realtor|trulia|redfin|realestate|apartments?|rent\.com|homes?\.com|housing|indeed|glassdoor|craigslist|scribd|slideshare|issuu|academia\.edu|coursehero|studocu/.test(
        d,
      )
    )
      continue;
    seen.add(d);
    out.push(u);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mock implementation
// ---------------------------------------------------------------------------

function mockCandidates(seed: string): SupplierCandidate[] {
  const slug = seed.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return [
    {
      supplierName: "Acme Process Instruments",
      website: "https://www.acme-process.example",
      productUrl: `https://www.acme-process.example/parts/${slug}`,
      email: "sales@acme-process.example",
      emailSourceUrl: "https://www.acme-process.example/contact",
      matchType: "PART_NUMBER",
    },
    {
      supplierName: "Global Analyzer Supply",
      website: "https://www.gas-supply.example",
      productUrl: `https://www.gas-supply.example/catalog/${slug}`,
      email: "purchasing@gas-supply.example",
      emailSourceUrl: "https://www.gas-supply.example/about",
      matchType: "PART_NUMBER",
    },
  ];
}
