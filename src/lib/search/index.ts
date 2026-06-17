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
 * Result URLs come from the Serper API; Playwright opens each page to apply the
 * gate and harvest a contact email. Mock mode returns deterministic fakes.
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

  let ctx: import("playwright").BrowserContext | null = null;
  try {
    const browser = await getSharedBrowser();
    ctx = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    });
      // We only need each page's text + emails — block images/fonts/CSS/media.
      // This is the single biggest memory + speed win on a small instance.
      await ctx.route("**/*", (route) => {
        const t = route.request().resourceType();
        if (t === "image" || t === "media" || t === "font" || t === "stylesheet") {
          return route.abort();
        }
        return route.continue();
      });
      const page = await ctx.newPage();

      // Stage 1 — exact part number. Include the manufacturer in the QUERY so
      // results are biased toward the right industrial/technical listings (a
      // bare part number like "900063" otherwise matches real-estate listing
      // IDs etc.). The on-page gate still requires the exact part number.
      if (pn) {
        const query = [pn, item.manufacturer?.trim()].filter(Boolean).join(" ");
        const urls = await serperUrls(query, env.serperApiKey, env.searchMaxResults);
        const found = await inspectUrls(page, urls, { partNumber: pn, matchType: "PART_NUMBER" });
        if (found.length) return done(found);
      }

      // Stage 2 — full description (part number still verified on page).
      const descQuery = buildDescriptionQuery(item);
      if (descQuery && descQuery !== pn) {
        const urls = await serperUrls(descQuery, env.serperApiKey, env.searchMaxResults);
        const found = await inspectUrls(page, urls, {
          partNumber: pn || null,
          matchType: "DESCRIPTION",
        });
        if (found.length) return done(found);
      }

      // Stage 3 — manufacturer direct (no part-number gate).
      if (item.manufacturer) {
        const found = await findManufacturerContact(page, item.manufacturer, env);
        if (found.length) return done(found);
      }

    // Stage 4 — nothing emailable; flag the item.
    return { candidates: [], result: "NOT_FOUND", usedMock: false };
  } catch (err) {
    console.error("[search] supplier search failed:", err);
    return { candidates: [], result: "NOT_FOUND", usedMock: false };
  } finally {
    // Close only the per-item context; the browser is shared and reused.
    if (ctx) await ctx.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Shared Chromium — launched once and reused across items.
//
// Re-launching Chromium per item caused big memory spikes that OOM-crash small
// (512MB) hosts. A single long-lived browser (with a fresh, throwaway context
// per item) plus low-memory flags keeps the footprint flat and stable.
// ---------------------------------------------------------------------------
let sharedBrowser: import("playwright").Browser | null = null;

const LOW_MEM_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage", // critical: containers have a tiny /dev/shm
  "--disable-gpu",
  "--disable-software-rasterizer",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-default-apps",
  "--no-zygote",
  "--js-flags=--max-old-space-size=128",
];

async function getSharedBrowser(): Promise<import("playwright").Browser> {
  if (sharedBrowser && sharedBrowser.isConnected()) return sharedBrowser;
  const { chromium } = await import("playwright");
  sharedBrowser = await chromium.launch({ headless: true, args: LOW_MEM_ARGS });
  sharedBrowser.on("disconnected", () => {
    sharedBrowser = null;
  });
  return sharedBrowser;
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
// Playwright — open candidates, gate, harvest email
// ---------------------------------------------------------------------------

interface InspectOpts {
  /** When set, a page is only accepted if it contains this exact part number. */
  partNumber: string | null;
  matchType: MatchType;
}

async function inspectUrls(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  urls: string[],
  opts: InspectOpts,
): Promise<SupplierCandidate[]> {
  const out: SupplierCandidate[] = [];
  const seen = new Set<string>();

  for (const url of urls) {
    const domain = safeDomain(url);
    if (!domain || seen.has(domain)) continue;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      if (opts.partNumber) {
        const bodyText = await page.evaluate(() => document.body?.innerText ?? "");
        if (!pageContainsExactPartNumber(bodyText, opts.partNumber)) continue;
      }
      seen.add(domain);
      const title = await page.title();
      const html = await page.content();
      const { email, emailSourceUrl } = await findEmail(page, url, html);
      out.push({
        supplierName: deriveSupplierName(url, title),
        website: originOf(url),
        productUrl: url,
        email,
        emailSourceUrl,
        matchType: opts.matchType,
      });
    } catch (err) {
      console.warn(`[search] failed to inspect ${url}:`, (err as Error).message);
    }
  }
  return out;
}

/**
 * Stage 3: locate the manufacturer's own website and a contact email. We accept
 * the result whose domain best matches the manufacturer name (or the first
 * result), without requiring the part number on the page.
 */
async function findManufacturerContact(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
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
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      const title = await page.title();
      const html = await page.content();
      const { email, emailSourceUrl } = await findEmail(page, url, html);
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
    } catch {
      // try the next candidate
    }
  }
  return [];
}

/** Look for an email on the page, then common contact/about pages. */
async function findEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  productUrl: string,
  productHtml: string,
): Promise<{ email: string | null; emailSourceUrl: string | null }> {
  const onPage = pickBestEmail(extractEmails(productHtml));
  if (onPage) return { email: onPage, emailSourceUrl: productUrl };

  const origin = originOf(productUrl);
  const paths = ["/contact", "/contact-us", "/about"];
  for (const path of paths) {
    const target = origin + path;
    try {
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 15000 });
      const html = await page.content();
      const email = pickBestEmail(extractEmails(html));
      if (email) return { email, emailSourceUrl: target };
    } catch {
      // page may not exist — keep trying
    }
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
      /duckduckgo|google|bing|yahoo|facebook|youtube|linkedin|twitter|x\.com|reddit|pinterest|instagram|tiktok|wikipedia|quora|zillow|realtor|trulia|redfin|realestate|apartments?|rent\.com|homes?\.com|housing|indeed|glassdoor|craigslist/.test(
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
