/**
 * Canonical domain model. These mirror the Supabase tables defined in
 * supabase/migrations/0001_init.sql.
 */

/** The six workflow statuses for an RFQ item, per the spec. */
export type ItemStatus =
  | "PENDING_SEARCH"
  | "FOUND"
  | "NOT_FOUND"
  | "READY_TO_SEND"
  | "EMAIL_SENT"
  | "EMAIL_FAILED";

export const ITEM_STATUSES: ItemStatus[] = [
  "PENDING_SEARCH",
  "FOUND",
  "NOT_FOUND",
  "READY_TO_SEND",
  "EMAIL_SENT",
  "EMAIL_FAILED",
];

export type EmailStatus = "SENT" | "FAILED";

export interface Rfq {
  id: string;
  reference_number: string;
  uploaded_at: string;
  /** Path in Supabase Storage (or local) of the source PDF. */
  file_path: string | null;
}

export interface RfqItem {
  id: string;
  rfq_id: string;
  /** Sequential display number (1, 2, 3 ...). Derived from the raw RFQ item. */
  item_number: number;
  part_number: string | null;
  manufacturer: string | null;
  product: string | null;
  box_size: string | null;
  application: string | null;
  analyzer_model: string | null;
  tag_number: string | null;
  quantity: number | null;
  unit: string | null;
  status: ItemStatus;
}

/** How a supplier was matched, in descending confidence. */
export type MatchType = "PART_NUMBER" | "DESCRIPTION" | "MANUFACTURER";

export interface Supplier {
  id: string;
  rfq_item_id: string;
  supplier_name: string | null;
  website: string | null;
  product_url: string | null;
  email: string | null;
  email_source_url: string | null;
  /**
   * PART_NUMBER  = exact part number found on the page (highest confidence)
   * DESCRIPTION  = found via full-description search (part number still verified)
   * MANUFACTURER = manufacturer-direct, listing NOT confirmed (lowest confidence)
   */
  match_type: MatchType | null;
  created_at?: string;
}

export interface EmailLog {
  id: string;
  supplier_id: string;
  recipient_email: string;
  sent_at: string | null;
  message_id: string | null;
  status: EmailStatus;
}

/** The ten fields extracted from an RFQ PDF item. */
export interface ExtractedItem {
  rawItemNumber: string; // e.g. "00010"
  itemNumber: number; // sequential display number e.g. 1
  quantity: number | null;
  unit: string | null;
  manufacturer: string | null;
  partNumber: string | null;
  product: string | null;
  boxSize: string | null;
  application: string | null;
  analyzerModel: string | null;
  tagNumber: string | null;
}

/** A candidate supplier discovered during search (before DB persistence). */
export interface SupplierCandidate {
  supplierName: string;
  website: string;
  productUrl: string;
  email: string | null;
  emailSourceUrl: string | null;
  matchType: MatchType;
}

/** Aggregate shapes used by pages. */
export interface RfqItemWithSuppliers extends RfqItem {
  suppliers: Supplier[];
}

export interface RfqWithItems extends Rfq {
  items: RfqItem[];
}

export interface DashboardStats {
  rfqsUploaded: number;
  itemsFound: number;
  suppliersFound: number;
  emailsSent: number;
}
