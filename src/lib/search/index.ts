import "server-only";
import { getEnv } from "@/lib/env";
import type { SupplierCandidate } from "@/lib/types";
import {
  deriveSupplierName,
  extractEmails,
  originOf,
  pageContainsExactPartNumber,
  pickBestEmail,
} from "./matching";

/**
 * Supplier discovery.
 *
 * Real mode: DuckDuckGo -> open each result with Playwright -> accept only
 * pages where the EXACT part number appears -> harvest a contact email from
 * the page and its contact/about pages.
 *
 * Mock mode (MOCK_SEARCH=true or no Playwright browser available): returns
 * deterministic fake suppliers so the full workflow is testable offline.
 */

export interface SearchOutcome {
  candidates: SupplierCandidate[];
  /** "FOUND" when at least one exact match, else "NOT_FOUND". */
  result: "FOUND" | "NOT_FOUND";
  usedMock: boolean;
}

export async function searchSuppliers(partNumber: string): Promise<SearchOutcome> {
  const env = getEnv();
  const pn = partNumber.trim();
  if (!pn) return { candidates: [], result: "NOT_FOUND", usedMock: false };

  if (env.mockSearch) {
    const candidates = mockCandidates(pn);
    return {
      candidates,
      result: candidates.length ? "FOUND" : "NOT_FOUND",
      usedMock: true,
    };
  }

  try {
    const candidates = await playwrightSearch(pn, env.searchMaxResults);
    return {
      candidates,
      result: candidates.length ? "FOUND" : "NOT_FOUND",
      usedMock: false,
    };
  } catch (err) {
    console.error("[search] Playwright search failed:", err);
    // Surface as not-found rather than crashing the request.
    return { candidates: [], result: "NOT_FOUND", usedMock: false };
  }
}

// ---------------------------------------------------------------------------
// Mock implementation
// ---------------------------------------------------------------------------

function mockCandidates(pn: string): SupplierCandidate[] {
  // Deterministic: derived from the part number so results are stable.
  const slug = pn.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return [
    {
      supplierName: "Acme Process Instruments",
      website: "https://www.acme-process.example",
      productUrl: `https://www.acme-process.example/parts/${slug}`,
      email: "sales@acme-process.example",
      emailSourceUrl: "https://www.acme-process.example/contact",
    },
    {
      supplierName: "Global Analyzer Supply",
      website: "https://www.gas-supply.example",
      productUrl: `https://www.gas-supply.example/catalog/${slug}`,
      email: "purchasing@gas-supply.example",
      emailSourceUrl: "https://www.gas-supply.example/about",
    },
  ];
}

// ---------------------------------------------------------------------------
// Real implementation (Playwright + DuckDuckGo)
// ---------------------------------------------------------------------------

async function playwrightSearch(
  partNumber: string,
  maxResults: number,
): Promise<SupplierCandidate[]> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const candidates: SupplierCandidate[] = [];
  const seenDomains = new Set<string>();

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    });
    const page = await context.newPage();

    // DuckDuckGo HTML endpoint returns a simple, scrapeable result list.
    const query = encodeURIComponent(`"${partNumber}"`);
    await page.goto(`https://html.duckduckgo.com/html/?q=${query}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const resultUrls: string[] = await page.$$eval("a.result__a", (links) =>
      links.map((l) => (l as HTMLAnchorElement).href),
    );

    // DuckDuckGo wraps targets in redirect links — normalise them.
    const targets = dedupeByDomain(resultUrls.map(unwrapDuckDuckGo)).slice(0, maxResults);

    for (const url of targets) {
      const domain = safeDomain(url);
      if (!domain || seenDomains.has(domain)) continue;

      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
        const bodyText = await page.evaluate(() => document.body?.innerText ?? "");

        // EXACT match gate — the heart of the requirement.
        if (!pageContainsExactPartNumber(bodyText, partNumber)) continue;

        seenDomains.add(domain);
        const title = await page.title();
        const html = await page.content();

        const { email, emailSourceUrl } = await findEmail(page, url, html);

        candidates.push({
          supplierName: deriveSupplierName(url, title),
          website: originOf(url),
          productUrl: url,
          email,
          emailSourceUrl,
        });
      } catch (err) {
        console.warn(`[search] failed to inspect ${url}:`, (err as Error).message);
      }
    }
  } finally {
    await browser.close();
  }

  return candidates;
}

/** Look for an email on the product page, then contact/about pages, then footer. */
async function findEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  productUrl: string,
  productHtml: string,
): Promise<{ email: string | null; emailSourceUrl: string | null }> {
  // 1. The product page itself (includes footer markup).
  const onPage = pickBestEmail(extractEmails(productHtml));
  if (onPage) return { email: onPage, emailSourceUrl: productUrl };

  // 2. Common contact / about pages on the same origin.
  const origin = originOf(productUrl);
  const candidates = ["/contact", "/contact-us", "/about", "/about-us", "/support"];
  for (const path of candidates) {
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

function unwrapDuckDuckGo(href: string): string {
  try {
    const u = new URL(href, "https://duckduckgo.com");
    const uddg = u.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : href;
  } catch {
    return href;
  }
}

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
    // Skip search engines / social / marketplaces noise.
    if (/duckduckgo|google|bing|facebook|youtube|linkedin|twitter|x\.com|reddit/.test(d)) continue;
    seen.add(d);
    out.push(u);
  }
  return out;
}
