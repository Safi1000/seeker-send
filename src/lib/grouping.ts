import type { MatchType, RfqItem, Supplier } from "@/lib/types";

/**
 * Turn per-item supplier matches into recipient groups: every item is assigned
 * one "primary" supplier (preferring the actual manufacturer), then items that
 * resolve to the same email address are grouped so a single RFQ email covers
 * all of them — no duplicate emails to the same recipient.
 */

export interface ItemWithSuppliers {
  item: RfqItem;
  suppliers: Supplier[];
}

export interface SupplierGroup {
  /** Lowercased recipient email — the grouping key. */
  email: string;
  supplierName: string;
  website: string | null;
  /** Supplier id used for logging the send (the primary supplier of the first item). */
  supplierId: string;
  /** Most-confident match type across the group's entries. */
  matchType: MatchType;
  /** Items addressed to this recipient, with each one's chosen supplier. */
  entries: { item: RfqItem; supplier: Supplier }[];
}

/** PART_NUMBER (best) -> DESCRIPTION -> MANUFACTURER (weakest). */
const MATCH_RANK: Record<MatchType, number> = {
  PART_NUMBER: 3,
  DESCRIPTION: 2,
  MANUFACTURER: 1,
};

function bestMatch(a: MatchType, b: MatchType): MatchType {
  return MATCH_RANK[a] >= MATCH_RANK[b] ? a : b;
}

export interface GroupingResult {
  groups: SupplierGroup[];
  /** Items that were searched but have no supplier with an email to send to. */
  noContact: RfqItem[];
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The domain part of an email, lowercased (e.g. "sales@x.com" -> "x.com"). */
function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return (at >= 0 ? email.slice(at + 1) : email).toLowerCase();
}

// Shared free-mail providers. Two *different* suppliers may both use one of
// these, so items landing on the same free domain must NOT be merged — they're
// grouped by full address instead.
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "yahoo.co.in",
  "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com", "msn.com",
  "aol.com", "icloud.com", "me.com", "protonmail.com", "proton.me", "gmx.com",
  "gmx.net", "mail.com", "yandex.com", "yandex.ru", "zoho.com", "qq.com",
  "163.com", "126.com", "sina.com", "rediffmail.com",
]);

/**
 * Grouping key for a recipient. For a company domain it's just the domain, so
 * every mailbox at that domain (sales@, info@, contact@…) collapses into ONE
 * email. For a shared free-mail domain it's the full address, so unrelated
 * suppliers on the same provider stay separate.
 */
function groupKey(email: string): string {
  const domain = emailDomain(email);
  return FREE_EMAIL_DOMAINS.has(domain) ? email.toLowerCase() : domain;
}

// Preferred mailbox roles when one company domain exposed several addresses.
const RECIPIENT_PRIORITY = [
  "sales", "purchasing", "quote", "rfq", "info", "contact", "enquir", "support",
];

/** Choose the single best address to actually send to for a group. */
function bestRecipient(emails: string[]): string {
  const unique = [...new Set(emails.map((e) => e.toLowerCase()))];
  for (const role of RECIPIENT_PRIORITY) {
    const hit = unique.find((e) => e.split("@")[0].includes(role));
    if (hit) return hit;
  }
  return unique[0];
}

/** Does this supplier look like it belongs to the item's stated manufacturer? */
function matchesManufacturer(item: RfqItem, supplier: Supplier): boolean {
  if (!item.manufacturer) return false;
  const haystack = norm(`${supplier.supplier_name ?? ""} ${supplier.website ?? ""}`);
  // Use each significant manufacturer word (>=4 chars) as a signal.
  const words = item.manufacturer.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  return words.some((w) => haystack.includes(w));
}

/**
 * Pick the single supplier to contact for an item: must have an email; prefer
 * one that looks like the manufacturer; otherwise the first emailable one.
 */
export function choosePrimarySupplier(item: RfqItem, suppliers: Supplier[]): Supplier | null {
  const withEmail = suppliers.filter((s) => s.email);
  if (withEmail.length === 0) return null;
  return withEmail.find((s) => matchesManufacturer(item, s)) ?? withEmail[0];
}

export function groupItemsBySupplier(input: ItemWithSuppliers[]): GroupingResult {
  // Keyed by recipient domain (or full address for free-mail providers), so
  // every item bound for the same company collapses into a single email even
  // when different pages exposed different mailboxes at that domain.
  const byKey = new Map<string, SupplierGroup & { _emails: string[] }>();
  const noContact: RfqItem[] = [];

  for (const { item, suppliers } of input) {
    const primary = choosePrimarySupplier(item, suppliers);
    if (!primary || !primary.email) {
      noContact.push(item);
      continue;
    }
    const key = groupKey(primary.email);
    const primaryMatch = primary.match_type ?? "PART_NUMBER";
    let group = byKey.get(key);
    if (!group) {
      group = {
        email: primary.email.toLowerCase(), // provisional; finalised below
        supplierName: primary.supplier_name ?? item.manufacturer ?? key,
        website: primary.website,
        supplierId: primary.id,
        matchType: primaryMatch,
        entries: [],
        _emails: [],
      };
      byKey.set(key, group);
    } else {
      group.matchType = bestMatch(group.matchType, primaryMatch);
    }
    group._emails.push(primary.email.toLowerCase());
    group.entries.push({ item, supplier: primary });
  }

  // Finalise each group's single recipient address, then drop the scratch field.
  const groups: SupplierGroup[] = [...byKey.values()]
    .map(({ _emails, ...g }) => ({ ...g, email: bestRecipient(_emails) }))
    // Order groups by their lowest item number for a stable, readable layout.
    .sort(
      (a, b) =>
        Math.min(...a.entries.map((e) => e.item.item_number)) -
        Math.min(...b.entries.map((e) => e.item.item_number)),
    );
  noContact.sort((a, b) => a.item_number - b.item_number);

  return { groups, noContact };
}
