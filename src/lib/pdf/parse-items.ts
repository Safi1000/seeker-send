import type { ExtractedItem } from "@/lib/types";

/**
 * Parse the ten required fields out of raw RFQ text.
 *
 * Tuned for the SAP / MARAFIQ-style RFQ layout, where pdf-parse emits lines like:
 *
 *   00010201165572PMP;ACID FEED,1S3AZ-0.8V-40E1D,NIKKISO   <- item code + material# + short text (glued)
 *                             1     each                     <- quantity + unit (no label)
 *   Manufacturer part number                                <- label on its own line …
 *   1S3AZ-0.8V-40E1D                                        <- … value on the next line
 *   APPLICATION: ACID FEED                                  <- LABEL: value
 *   MODEL: 1S3AZ-0.8V-40E1D
 *   MNFR: NIKKISO CO.LTD
 *   TAG NO: 8D-AFP-1/2
 *
 * Item codes are zero-padded (00010, 00020, …) and are renumbered sequentially
 * to 1, 2, 3 for display. Only the ten required fields are extracted.
 */

// An item starts on a line beginning with a zero-padded line-item code
// (0010 / 00010). Material number and short text may be glued on with no
// spaces. Leading-zero requirement avoids matching vendor/phone/page numbers.
const SAP_ITEM = /^\s*(0\d{3,4})(\d*)(.*)$/;
// Alternative explicit form: "Item 10", "Pos 20", "Line 30".
const LABELLED_ITEM = /^\s*(?:item|pos(?:ition)?|line)\s*[:#.]?\s*(\d{1,5})\b/i;

interface FieldSpec {
  key: keyof Omit<ExtractedItem, "rawItemNumber" | "itemNumber">;
  labels: string[];
}

const FIELD_SPECS: FieldSpec[] = [
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
    ],
  },
  { key: "manufacturer", labels: ["manufacturer", "mnfr", "mfr", "make", "brand"] },
  { key: "product", labels: ["product", "description", "material description", "item description"] },
  { key: "boxSize", labels: ["box size", "box"] },
  { key: "application", labels: ["application", "app"] },
  { key: "analyzerModel", labels: ["analyzer model", "analyser model", "analyzer", "model"] },
  { key: "tagNumber", labels: ["tag number", "tag no", "tag #", "tag"] },
  { key: "unit", labels: ["unit", "uom", "unit of measure"] },
  { key: "quantity", labels: ["quantity", "qty", "qnty"] },
];

// Flattened (key,label) pairs, longest-label-first so specific labels win over
// short prefixes (e.g. "manufacturer part number" before "manufacturer").
const FLAT_LABELS = FIELD_SPECS.flatMap((s) =>
  s.labels.map((label) => ({ key: s.key, label })),
).sort((a, b) => b.label.length - a.label.length);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanValue(v: string): string {
  return v.replace(/^[\s:.\-–—]+/, "").replace(/\s+$/, "").trim();
}

/** `LABEL: value` on a single line — returns the value, or null. */
function matchInlineLabel(line: string, label: string): string | null {
  const re = new RegExp(`^\\s*${escapeRe(label)}\\s*[:#\\-]\\s*(.+)$`, "i");
  const m = line.match(re);
  if (m && cleanValue(m[1]).length > 0) return cleanValue(m[1]);
  return null;
}

function bestInlineMatch(line: string): { key: FieldSpec["key"]; value: string } | null {
  for (const { key, label } of FLAT_LABELS) {
    const value = matchInlineLabel(line, label);
    if (value != null) return { key, value };
  }
  return null;
}

/** A line that is *only* a label (value lives on the next line) — returns the field key. */
function labelOnly(line: string): FieldSpec["key"] | null {
  const t = line.trim().toLowerCase().replace(/[:#.\s]+$/, "");
  for (const { key, label } of FLAT_LABELS) {
    if (t === label) return key;
  }
  return null;
}

/** A bare "<qty> <unit>" line, e.g. "1     each". */
function matchQtyUnit(line: string): { quantity: number; unit: string | null } | null {
  const m = line.match(/^\s*(\d+(?:\.\d+)?)\s+([A-Za-z][A-Za-z.]{0,9})\s*$/);
  if (!m) return null;
  return { quantity: Number(m[1]), unit: m[2] || null };
}

function isTerminator(line: string): boolean {
  const t = line.trim();
  if (t === "") return false;
  if (/^[_\-=]{5,}$/.test(t)) return true; // separator rules
  if (/^page\s+\d+\s*\/\s*\d+/i.test(t)) return true;
  if (/^(to:|rfq\b|delivery location|bid closing|special (note|instructions)|conditions of|your vendor number|vendor contact)/i.test(t))
    return true;
  return false;
}

interface ItemStart {
  index: number;
  rawItemNumber: string;
  headerText: string; // short text/description left on the header line
}

/** Locate every item header and the description text glued to it. */
function findItemStarts(lines: string[]): ItemStart[] {
  const starts: ItemStart[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sap = line.match(SAP_ITEM);
    if (sap) {
      // sap[1]=code, sap[2]=material number (glued digits), sap[3]=short text.
      starts.push({ index: i, rawItemNumber: sap[1], headerText: cleanValue(sap[3] ?? "") });
      continue;
    }
    const labelled = line.match(LABELLED_ITEM);
    if (labelled) {
      const rest = line.replace(LABELLED_ITEM, "").trim();
      starts.push({ index: i, rawItemNumber: labelled[1], headerText: cleanValue(rest) });
    }
  }
  return starts;
}

export function parseRfqItems(text: string): ExtractedItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/ /g, " ").trimEnd());
  const starts = findItemStarts(lines);

  const items: ExtractedItem[] = starts.map((start, idx) => {
    const item: ExtractedItem = {
      rawItemNumber: start.rawItemNumber,
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

    // Block = lines after the header until the next item start or a terminator.
    const blockEnd = idx + 1 < starts.length ? starts[idx + 1].index : lines.length;
    const block: string[] = [];
    for (let i = start.index + 1; i < blockEnd; i++) {
      if (isTerminator(lines[i])) break;
      block.push(lines[i]);
    }

    const consumed = new Set<number>();
    let standaloneProduct: string | null = null;

    for (let i = 0; i < block.length; i++) {
      if (consumed.has(i)) continue;
      const line = block[i];
      if (line.trim() === "") continue;

      // 1. Quantity / unit (bare "1  each").
      if (item.quantity == null) {
        const qu = matchQtyUnit(line);
        if (qu) {
          item.quantity = qu.quantity;
          if (qu.unit && !item.unit) item.unit = qu.unit;
          continue;
        }
      }

      // 2. Label on its own line -> value on the next non-empty line.
      const lonely = labelOnly(line);
      if (lonely) {
        const next = block.findIndex((l, j) => j > i && l.trim() !== "");
        if (next !== -1) {
          const val = cleanValue(block[next]);
          applyField(item, lonely, val);
          consumed.add(next);
        }
        continue;
      }

      // 3. "LABEL: value" on one line.
      const inline = bestInlineMatch(line);
      if (inline) {
        applyField(item, inline.key, inline.value);
        continue;
      }

      // 4. First plain line (no label, not qty) is the product type, e.g. "PUMP".
      if (!standaloneProduct && line.trim().length >= 2) {
        standaloneProduct = cleanValue(line);
      }
    }

    // Product preference: explicit label > standalone line (e.g. "PUMP") > header short text.
    if (!item.product) item.product = standaloneProduct ?? (start.headerText || null);

    return item;
  });

  // Keep only rows that carry a part number or a product description.
  return items.filter((i) => i.partNumber || i.product);
}

function applyField(item: ExtractedItem, key: FieldSpec["key"], value: string): void {
  if (key === "quantity") {
    const m = value.match(/(\d+(?:\.\d+)?)\s*([A-Za-z]+)?/);
    if (m) {
      if (item.quantity == null) item.quantity = Number(m[1]);
      if (m[2] && !item.unit) item.unit = m[2];
    }
    return;
  }
  if (key === "unit") {
    if (!item.unit) item.unit = value;
    return;
  }
  if (item[key] == null) (item[key] as string | null) = value;
}
