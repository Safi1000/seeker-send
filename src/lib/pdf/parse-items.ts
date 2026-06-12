import type { ExtractedItem } from "@/lib/types";

/**
 * Parse the ten required fields out of raw RFQ text.
 *
 * RFQ layouts vary, so this is a tolerant, label-driven parser:
 *   1. The document is split into per-item blocks. A new block begins at an
 *      RFQ item marker — either a 5-digit code on its own line ("00010") or an
 *      explicit "Item 10" / "Pos 20" label.
 *   2. Within each block we look for labelled fields using a synonym table.
 *   3. Raw item codes (00010, 00020, ...) are renumbered sequentially to
 *      1, 2, 3 for display, as required by the spec.
 *
 * Only the ten required fields are extracted; everything else is ignored.
 */

const ITEM_MARKER =
  /^\s*(?:item|pos(?:ition)?|line)?\s*[:#.]?\s*(\d{3,6})\b/i;

/** A bare 5-/6-digit code on its own line, e.g. "00010". */
const BARE_CODE = /^\s*(\d{5,6})\s*$/;

interface FieldSpec {
  key: keyof Omit<ExtractedItem, "rawItemNumber" | "itemNumber">;
  labels: string[];
}

const FIELD_SPECS: FieldSpec[] = [
  { key: "manufacturer", labels: ["manufacturer", "mnfr", "mfr", "make", "brand"] },
  {
    key: "partNumber",
    labels: [
      "manufacturer part number",
      "manufacturer part no",
      "mfr part number",
      "mfr part no",
      "mfg part number",
      "mfg part no",
      "part number",
      "part no",
      "part #",
      "p/n",
      "pn",
      "model number",
      "catalog number",
      "cat no",
    ],
  },
  { key: "product", labels: ["product", "description", "material description", "item description"] },
  { key: "boxSize", labels: ["box size", "box"] },
  { key: "application", labels: ["application", "app"] },
  { key: "analyzerModel", labels: ["analyzer model", "analyser model", "analyzer", "model"] },
  { key: "tagNumber", labels: ["tag number", "tag no", "tag #", "tag"] },
  { key: "unit", labels: ["unit", "uom", "unit of measure"] },
  { key: "quantity", labels: ["quantity", "qty", "qnty"] },
];

function cleanValue(v: string): string {
  return v
    .replace(/^[\s:.\-–—]+/, "")
    .replace(/[\s]+$/, "")
    .trim();
}

// Flattened (key,label) pairs sorted longest-label-first so specific labels
// (e.g. "mfr part no") win over short prefixes (e.g. "mfr").
const FLAT_LABELS = FIELD_SPECS.flatMap((s) => s.labels.map((label) => ({ key: s.key, label }))).sort(
  (a, b) => b.label.length - a.label.length,
);

/** Match a single label against a line. Returns the value or null. */
function matchOneLabel(line: string, label: string): string | null {
  const re = new RegExp(`^\\s*${escapeRe(label)}\\s*[:#\\-]?\\s*(.+)$`, "i");
  const m = line.match(re);
  if (m && m[1] && cleanValue(m[1]).length > 0) return cleanValue(m[1]);
  return null;
}

/** Find the most specific (longest) field label that matches this line. */
function bestFieldMatch(line: string): { key: FieldSpec["key"]; value: string } | null {
  for (const { key, label } of FLAT_LABELS) {
    const value = matchOneLabel(line, label);
    if (value != null) return { key, value };
  }
  return null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseQuantityAndUnit(value: string): { quantity: number | null; unit: string | null } {
  // e.g. "2 pcs", "4", "10 EA", "1 set"
  const m = value.match(/(\d+(?:\.\d+)?)\s*([A-Za-z]+)?/);
  if (!m) return { quantity: null, unit: null };
  return {
    quantity: m[1] ? Number(m[1]) : null,
    unit: m[2] ? m[2] : null,
  };
}

interface Block {
  rawItemNumber: string;
  lines: string[];
}

function splitIntoBlocks(text: string): Block[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/ /g, " ").trimEnd());

  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const line of lines) {
    const bare = line.match(BARE_CODE);
    const marker = line.match(ITEM_MARKER);
    const code = bare?.[1] ?? (marker && /item|pos|line/i.test(line) ? marker[1] : null);

    if (code) {
      if (current) blocks.push(current);
      current = { rawItemNumber: code, lines: [] };
      // Keep any trailing content after the marker on the same line.
      const rest = line.replace(ITEM_MARKER, "").replace(BARE_CODE, "").trim();
      if (rest) current.lines.push(rest);
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

export function parseRfqItems(text: string): ExtractedItem[] {
  const blocks = splitIntoBlocks(text);

  const items: ExtractedItem[] = blocks.map((block, idx) => {
    const item: ExtractedItem = {
      rawItemNumber: block.rawItemNumber,
      itemNumber: idx + 1, // sequential display numbering
      quantity: null,
      unit: null,
      manufacturer: null,
      partNumber: null,
      product: null,
      boxSize: null,
      application: null,
      analyzerModel: null,
      tagNumber: null,
    };

    for (const line of block.lines) {
      const match = bestFieldMatch(line);
      if (!match) continue;
      const { key, value } = match;

      if (key === "quantity") {
        const { quantity, unit } = parseQuantityAndUnit(value);
        if (quantity != null) item.quantity = quantity;
        if (unit && !item.unit) item.unit = unit;
      } else if (key === "unit") {
        item.unit = item.unit ?? value;
      } else if (item[key] == null) {
        // First value wins for single-value fields.
        (item[key] as string | null) = value;
      }
    }

    // If no explicit "product" label but the first non-label line looks like a
    // description, use it as a sensible fallback.
    if (!item.product) {
      const candidate = block.lines.find((l) => l.length > 4 && !bestFieldMatch(l));
      if (candidate) item.product = cleanValue(candidate);
    }

    return item;
  });

  // Keep only items that have at least a part number or a product description.
  return items.filter((i) => i.partNumber || i.product);
}
