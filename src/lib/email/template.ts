import type { RfqItem } from "@/lib/types";

/**
 * Generate the RFQ email exactly per the required format. Fields that are
 * empty/null are omitted entirely — no blank lines for missing data.
 *
 * Two flavours:
 *   - generateEmail()      — a single item (kept for the per-item flow).
 *   - generateGroupEmail() — several items addressed to the same recipient,
 *     with one header/closing and one block per item.
 */

export interface GeneratedEmail {
  subject: string;
  body: string;
}

function hasValue(v: unknown): v is string | number {
  return v !== null && v !== undefined && String(v).trim() !== "";
}

/**
 * The per-item detail block (everything between the header and the closing).
 *
 * The body is the item's FULL description from the RFQ, verbatim — every spec
 * line (TYPE, MATERIAL, MODEL, DRAWING NO, SERIAL NO, FFT1..n, ADDRESS, …), not
 * just a handful of recognised fields. The part number and quantity are pulled
 * out as labelled lines for clarity; everything else is sent exactly as written.
 */
function itemBlock(item: RfqItem): string[] {
  const lines: string[] = [];
  lines.push(`Item ${item.item_number}`);
  lines.push("");

  if (hasValue(item.part_number)) {
    lines.push(`Manufacturer part number: ${item.part_number}`);
    lines.push("");
  }

  // The entire description, exactly as it appears in the RFQ. Fall back to the
  // short product text if no description block was captured.
  const description = hasValue(item.description) ? String(item.description) : "";
  const body = description || (hasValue(item.product) ? String(item.product) : "");
  if (body) {
    lines.push(body);
    lines.push("");
  }

  if (hasValue(item.quantity)) {
    const unit = hasValue(item.unit) ? ` ${item.unit}` : "";
    lines.push(`Qty: ${item.quantity}${unit}`);
    lines.push("");
  }

  return lines;
}

function header(referenceNumber: string, date: string): string[] {
  return [
    "Dear Sales / Purchasing Team,",
    "",
    "Please quote your lowest best prices for the following items with gross weight & dimensions.",
    "",
    "ITEMS SHOULD BE BRAND NEW FACTORY PACKAGE",
    "",
    `Our Ref. No. ${referenceNumber}`,
    `Dated: ${date}`,
    "",
  ];
}

export function generateEmail(
  item: RfqItem,
  referenceNumber: string,
  date: string,
): GeneratedEmail {
  const lines = [...header(referenceNumber, date), ...itemBlock(item), "Best regards."];
  const subject = `RFQ ${referenceNumber} — Item ${item.item_number}${
    hasValue(item.part_number) ? ` (${item.part_number})` : ""
  }`;
  return { subject, body: lines.join("\n") };
}

/**
 * One email covering several items addressed to the same supplier/recipient.
 * Items are ordered by their display number.
 */
export function generateGroupEmail(
  items: RfqItem[],
  referenceNumber: string,
  date: string,
): GeneratedEmail {
  const ordered = [...items].sort((a, b) => a.item_number - b.item_number);
  const lines = [...header(referenceNumber, date)];
  for (const item of ordered) lines.push(...itemBlock(item));
  lines.push("Best regards.");

  const nums = ordered.map((i) => i.item_number).join(", ");
  const subject =
    ordered.length === 1
      ? `RFQ ${referenceNumber} — Item ${nums}`
      : `RFQ ${referenceNumber} — Items ${nums}`;

  return { subject, body: lines.join("\n") };
}
