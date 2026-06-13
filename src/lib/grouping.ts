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
  const byEmail = new Map<string, SupplierGroup>();
  const noContact: RfqItem[] = [];

  for (const { item, suppliers } of input) {
    const primary = choosePrimarySupplier(item, suppliers);
    if (!primary || !primary.email) {
      noContact.push(item);
      continue;
    }
    const key = primary.email.toLowerCase();
    const primaryMatch = primary.match_type ?? "PART_NUMBER";
    let group = byEmail.get(key);
    if (!group) {
      group = {
        email: key,
        supplierName: primary.supplier_name ?? item.manufacturer ?? key,
        website: primary.website,
        supplierId: primary.id,
        matchType: primaryMatch,
        entries: [],
      };
      byEmail.set(key, group);
    } else {
      group.matchType = bestMatch(group.matchType, primaryMatch);
    }
    group.entries.push({ item, supplier: primary });
  }

  // Order groups by their lowest item number for a stable, readable layout.
  const groups = [...byEmail.values()].sort(
    (a, b) =>
      Math.min(...a.entries.map((e) => e.item.item_number)) -
      Math.min(...b.entries.map((e) => e.item.item_number)),
  );
  noContact.sort((a, b) => a.item_number - b.item_number);

  return { groups, noContact };
}
