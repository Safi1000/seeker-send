import "server-only";
import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { deleteRfqPdf } from "@/lib/storage";
import type {
  DashboardStats,
  EmailLog,
  EmailStatus,
  ExtractedItem,
  ItemStatus,
  Rfq,
  RfqItem,
  Supplier,
  SupplierCandidate,
} from "@/lib/types";

/**
 * Data-access layer. When Supabase is configured every call goes to Postgres
 * via the service-role client. Otherwise an in-memory store (seeded with
 * sample data) is used so the whole app is browsable with zero setup.
 *
 * The platform is single-user and low-volume, so this thin repository is all
 * the abstraction that is warranted — no ORM, no query builder layer.
 */

// ---------------------------------------------------------------------------
// In-memory fallback store (dev / no-Supabase mode)
// ---------------------------------------------------------------------------

interface MemStore {
  rfqs: Rfq[];
  items: RfqItem[];
  suppliers: Supplier[];
  emailLogs: EmailLog[];
}

function seed(): MemStore {
  const rfqId = "seed-rfq-0001";
  const items: RfqItem[] = [
    {
      id: "seed-item-1",
      rfq_id: rfqId,
      item_number: 1,
      part_number: "2010B-2111-MS",
      manufacturer: "Servomex",
      product: "Oxygen Analyzer Sensor Cell",
      description:
        "Oxygen Analyzer Sensor Cell\nAPPLICATION: Combustion control\nANALYZER MODEL: SERVOTOUGH OxyExact 2200\nTAG NO: AT-4501",
      box_size: "1",
      application: "Combustion control",
      analyzer_model: "SERVOTOUGH OxyExact 2200",
      tag_number: "AT-4501",
      quantity: 2,
      unit: "pcs",
      status: "FOUND",
    },
    {
      id: "seed-item-2",
      rfq_id: rfqId,
      item_number: 2,
      part_number: "M400-FF-N1",
      manufacturer: "Mettler Toledo",
      product: "pH Transmitter",
      description:
        "pH Transmitter\nAPPLICATION: Effluent monitoring\nANALYZER MODEL: M400\nTAG NO: AIT-2210",
      box_size: "1",
      application: "Effluent monitoring",
      analyzer_model: "M400",
      tag_number: "AIT-2210",
      quantity: 4,
      unit: "pcs",
      status: "READY_TO_SEND",
    },
    {
      id: "seed-item-3",
      rfq_id: rfqId,
      item_number: 3,
      part_number: "X-9921-CUSTOM",
      manufacturer: null,
      product: "Custom analyzer manifold",
      description: "Custom analyzer manifold",
      box_size: null,
      application: null,
      analyzer_model: null,
      tag_number: null,
      quantity: 1,
      unit: "set",
      status: "NOT_FOUND",
    },
  ];
  const suppliers: Supplier[] = [
    {
      id: "seed-sup-1",
      rfq_item_id: "seed-item-1",
      supplier_name: "Servomex Direct",
      website: "https://www.servomex.com",
      product_url: "https://www.servomex.com/parts/2010b-2111-ms",
      email: "sales@servomex.com",
      email_source_url: "https://www.servomex.com/contact",
      match_type: "PART_NUMBER",
    },
    {
      id: "seed-sup-2",
      rfq_item_id: "seed-item-2",
      supplier_name: "Mettler Toledo Process",
      website: "https://www.mt.com",
      product_url: "https://www.mt.com/m400",
      email: "process.sales@mt.com",
      email_source_url: "https://www.mt.com/about",
      match_type: "PART_NUMBER",
    },
  ];
  return {
    rfqs: [
      {
        id: rfqId,
        reference_number: "RFQ-2026-0142",
        uploaded_at: "2026-06-10T09:00:00.000Z",
        file_path: null,
      },
    ],
    items,
    suppliers,
    emailLogs: [],
  };
}

// Persist across Next.js hot reloads in dev.
const g = globalThis as unknown as { __rfqMemStore?: MemStore };
function mem(): MemStore {
  if (!g.__rfqMemStore) g.__rfqMemStore = seed();
  return g.__rfqMemStore;
}

// ---------------------------------------------------------------------------
// Public repository API
// ---------------------------------------------------------------------------

export async function listRfqs(): Promise<Rfq[]> {
  const db = createSupabaseAdminClient();
  if (db) {
    const { data, error } = await db
      .from("rfqs")
      .select("*")
      .order("uploaded_at", { ascending: false });
    if (error) throw error;
    return data as Rfq[];
  }
  return [...mem().rfqs].sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
}

export async function getRfq(id: string): Promise<Rfq | null> {
  const db = createSupabaseAdminClient();
  if (db) {
    const { data, error } = await db.from("rfqs").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as Rfq) ?? null;
  }
  return mem().rfqs.find((r) => r.id === id) ?? null;
}

export async function createRfq(input: {
  reference_number: string;
  file_path: string | null;
}): Promise<Rfq> {
  const db = createSupabaseAdminClient();
  if (db) {
    const { data, error } = await db
      .from("rfqs")
      .insert({ reference_number: input.reference_number, file_path: input.file_path })
      .select("*")
      .single();
    if (error) throw error;
    return data as Rfq;
  }
  const rfq: Rfq = {
    id: randomUUID(),
    reference_number: input.reference_number,
    file_path: input.file_path,
    uploaded_at: new Date().toISOString(),
  };
  mem().rfqs.push(rfq);
  return rfq;
}

/**
 * Delete an RFQ and ALL its data: items, suppliers and email logs (via DB
 * cascade) plus the stored PDF. In-memory mode cascades manually.
 */
export async function deleteRfq(id: string): Promise<void> {
  const rfq = await getRfq(id);
  if (!rfq) return;

  await deleteRfqPdf(rfq.file_path);

  const db = createSupabaseAdminClient();
  if (db) {
    // FKs are ON DELETE CASCADE: rfq_items -> suppliers -> email_logs.
    const { error } = await db.from("rfqs").delete().eq("id", id);
    if (error) throw error;
    return;
  }

  const store = mem();
  const itemIds = store.items.filter((i) => i.rfq_id === id).map((i) => i.id);
  const supplierIds = store.suppliers
    .filter((s) => itemIds.includes(s.rfq_item_id))
    .map((s) => s.id);
  store.emailLogs = store.emailLogs.filter((l) => !supplierIds.includes(l.supplier_id));
  store.suppliers = store.suppliers.filter((s) => !itemIds.includes(s.rfq_item_id));
  store.items = store.items.filter((i) => i.rfq_id !== id);
  store.rfqs = store.rfqs.filter((r) => r.id !== id);
}

export async function insertItems(
  rfqId: string,
  extracted: ExtractedItem[],
): Promise<RfqItem[]> {
  const rows = extracted.map((e) => ({
    rfq_id: rfqId,
    item_number: e.itemNumber,
    part_number: e.partNumber,
    manufacturer: e.manufacturer,
    product: e.product,
    description: e.description,
    box_size: e.boxSize,
    application: e.application,
    analyzer_model: e.analyzerModel,
    tag_number: e.tagNumber,
    quantity: e.quantity,
    unit: e.unit,
    status: "PENDING_SEARCH" as ItemStatus,
  }));

  const db = createSupabaseAdminClient();
  if (db) {
    const { data, error } = await db.from("rfq_items").insert(rows).select("*");
    if (error) throw error;
    return data as RfqItem[];
  }
  const created: RfqItem[] = rows.map((r) => ({ id: randomUUID(), ...r }));
  mem().items.push(...created);
  return created;
}

export async function listItems(): Promise<RfqItem[]> {
  const db = createSupabaseAdminClient();
  if (db) {
    const { data, error } = await db
      .from("rfq_items")
      .select("*")
      .order("item_number", { ascending: true });
    if (error) throw error;
    return data as RfqItem[];
  }
  return [...mem().items];
}

export async function getItemsForRfq(rfqId: string): Promise<RfqItem[]> {
  const db = createSupabaseAdminClient();
  if (db) {
    const { data, error } = await db
      .from("rfq_items")
      .select("*")
      .eq("rfq_id", rfqId)
      .order("item_number", { ascending: true });
    if (error) throw error;
    return data as RfqItem[];
  }
  return mem()
    .items.filter((i) => i.rfq_id === rfqId)
    .sort((a, b) => a.item_number - b.item_number);
}

export async function getItem(id: string): Promise<RfqItem | null> {
  const db = createSupabaseAdminClient();
  if (db) {
    const { data, error } = await db
      .from("rfq_items")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as RfqItem) ?? null;
  }
  return mem().items.find((i) => i.id === id) ?? null;
}

export async function updateItemStatus(id: string, status: ItemStatus): Promise<void> {
  const db = createSupabaseAdminClient();
  if (db) {
    const { error } = await db.from("rfq_items").update({ status }).eq("id", id);
    if (error) throw error;
    return;
  }
  const item = mem().items.find((i) => i.id === id);
  if (item) item.status = status;
}

/** Items of an RFQ, each paired with its discovered suppliers. */
export async function getItemsWithSuppliersForRfq(
  rfqId: string,
): Promise<{ item: RfqItem; suppliers: Supplier[] }[]> {
  const items = await getItemsForRfq(rfqId);
  const pairs = await Promise.all(
    items.map(async (item) => ({ item, suppliers: await getSuppliersForItem(item.id) })),
  );
  return pairs;
}

/** Mark several items with the same status in one call. */
export async function setItemsStatus(ids: string[], status: ItemStatus): Promise<void> {
  if (ids.length === 0) return;
  const db = createSupabaseAdminClient();
  if (db) {
    const { error } = await db.from("rfq_items").update({ status }).in("id", ids);
    if (error) throw error;
    return;
  }
  for (const item of mem().items) if (ids.includes(item.id)) item.status = status;
}

export async function getSuppliersForItem(itemId: string): Promise<Supplier[]> {
  const db = createSupabaseAdminClient();
  if (db) {
    const { data, error } = await db
      .from("suppliers")
      .select("*")
      .eq("rfq_item_id", itemId);
    if (error) throw error;
    return data as Supplier[];
  }
  return mem().suppliers.filter((s) => s.rfq_item_id === itemId);
}

/** Replace the supplier set for an item with freshly-discovered candidates. */
export async function replaceSuppliers(
  itemId: string,
  candidates: SupplierCandidate[],
): Promise<Supplier[]> {
  const db = createSupabaseAdminClient();
  if (db) {
    await db.from("suppliers").delete().eq("rfq_item_id", itemId);
    if (candidates.length === 0) return [];
    const rows = candidates.map((c) => ({
      rfq_item_id: itemId,
      supplier_name: c.supplierName,
      website: c.website,
      product_url: c.productUrl,
      email: c.email,
      email_source_url: c.emailSourceUrl,
      match_type: c.matchType,
    }));
    const { data, error } = await db.from("suppliers").insert(rows).select("*");
    if (error) throw error;
    return data as Supplier[];
  }
  const store = mem();
  store.suppliers = store.suppliers.filter((s) => s.rfq_item_id !== itemId);
  const created: Supplier[] = candidates.map((c) => ({
    id: randomUUID(),
    rfq_item_id: itemId,
    supplier_name: c.supplierName,
    website: c.website,
    product_url: c.productUrl,
    email: c.email,
    email_source_url: c.emailSourceUrl,
    match_type: c.matchType,
  }));
  store.suppliers.push(...created);
  return created;
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const db = createSupabaseAdminClient();
  if (db) {
    const { data, error } = await db
      .from("suppliers")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as Supplier) ?? null;
  }
  return mem().suppliers.find((s) => s.id === id) ?? null;
}

export async function createEmailLog(input: {
  supplier_id: string;
  recipient_email: string;
  message_id: string | null;
  status: EmailStatus;
}): Promise<EmailLog> {
  const db = createSupabaseAdminClient();
  const sent_at = new Date().toISOString();
  if (db) {
    const { data, error } = await db
      .from("email_logs")
      .insert({ ...input, sent_at })
      .select("*")
      .single();
    if (error) throw error;
    return data as EmailLog;
  }
  const log: EmailLog = { id: randomUUID(), sent_at, ...input };
  mem().emailLogs.push(log);
  return log;
}

export async function listEmailLogs(): Promise<EmailLog[]> {
  const db = createSupabaseAdminClient();
  if (db) {
    const { data, error } = await db
      .from("email_logs")
      .select("*")
      .order("sent_at", { ascending: false });
    if (error) throw error;
    return data as EmailLog[];
  }
  return [...mem().emailLogs].sort((a, b) =>
    (b.sent_at ?? "").localeCompare(a.sent_at ?? ""),
  );
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [rfqs, items, logs] = await Promise.all([listRfqs(), listItems(), listEmailLogs()]);
  let suppliersCount = 0;
  const db = createSupabaseAdminClient();
  if (db) {
    const { count } = await db.from("suppliers").select("*", { count: "exact", head: true });
    suppliersCount = count ?? 0;
  } else {
    suppliersCount = mem().suppliers.length;
  }
  return {
    rfqsUploaded: rfqs.length,
    itemsFound: items.filter((i) =>
      ["FOUND", "READY_TO_SEND", "EMAIL_SENT"].includes(i.status),
    ).length,
    suppliersFound: suppliersCount,
    emailsSent: logs.filter((l) => l.status === "SENT").length,
  };
}
