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

/** The per-item detail block (everything between the header and the closing). */
function itemBlock(item: RfqItem): string[] {
  const lines: string[] = [];
  lines.push(`Item ${item.item_number}`);
  lines.push("");

  if (hasValue(item.part_number)) {
    lines.push(`Manufacturer part number: ${item.part_number}`);
    lines.push("");
  }

  if (hasValue(item.product)) {
    lines.push(String(item.product));
    lines.push("");
  }

  if (hasValue(item.box_size)) lines.push(`BOX SIZE: ${item.box_size}`);
  if (hasValue(item.application)) lines.push(`APPLICATION: ${item.application}`);
  if (hasValue(item.analyzer_model)) lines.push(`ANALYZER MODEL: ${item.analyzer_model}`);
  if (hasValue(item.tag_number)) lines.push(`TAG NO: ${item.tag_number}`);
  if (
    hasValue(item.box_size) ||
    hasValue(item.application) ||
    hasValue(item.analyzer_model) ||
    hasValue(item.tag_number)
  ) {
    lines.push("");
  }

  if (hasValue(item.manufacturer)) {
    lines.push(`MNFR: ${item.manufacturer}`);
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
