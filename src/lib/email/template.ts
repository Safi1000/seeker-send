import type { RfqItem } from "@/lib/types";

/**
 * Generate the RFQ email exactly per the required format. Fields that are
 * empty/null are omitted entirely — no blank lines for missing data.
 */

export interface GeneratedEmail {
  subject: string;
  body: string;
}

function hasValue(v: unknown): v is string | number {
  return v !== null && v !== undefined && String(v).trim() !== "";
}

export function generateEmail(
  item: RfqItem,
  referenceNumber: string,
  date: string,
): GeneratedEmail {
  const lines: string[] = [];

  lines.push("Dear Sales / Purchasing Team,");
  lines.push("");
  lines.push(
    "Please quote your lowest best prices for the following items with gross weight & dimensions.",
  );
  lines.push("");
  lines.push("ITEMS SHOULD BE BRAND NEW FACTORY PACKAGE");
  lines.push("");
  lines.push(`Our Ref. No. ${referenceNumber}`);
  lines.push(`Dated: ${date}`);
  lines.push("");
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

  // The labelled spec block — only render fields that exist.
  if (hasValue(item.box_size)) lines.push(`BOX SIZE: ${item.box_size}`);
  if (hasValue(item.application)) lines.push(`APPLICATION: ${item.application}`);
  if (hasValue(item.analyzer_model)) lines.push(`ANALYZER MODEL: ${item.analyzer_model}`);
  if (hasValue(item.tag_number)) lines.push(`TAG NO: ${item.tag_number}`);

  // Add spacing only if at least one of the labelled fields rendered.
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

  lines.push("Best regards.");

  const body = lines.join("\n");
  const subject = `RFQ ${referenceNumber} — Item ${item.item_number}${
    hasValue(item.part_number) ? ` (${item.part_number})` : ""
  }`;

  return { subject, body };
}
