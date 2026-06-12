import { NextResponse } from "next/server";
import { getItem, getRfq, getSuppliersForItem, updateItemStatus } from "@/lib/repo";
import { generateEmail } from "@/lib/email/template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/emails/preview — generate the RFQ email draft for an item.
 * Body: { itemId: string }
 */
export async function POST(req: Request) {
  const { itemId } = (await req.json()) as { itemId?: string };
  if (!itemId) return NextResponse.json({ error: "itemId is required" }, { status: 400 });

  const item = await getItem(itemId);
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const rfq = await getRfq(item.rfq_id);
  const date = new Date().toLocaleDateString("en-GB"); // DD/MM/YYYY
  const referenceNumber = rfq?.reference_number ?? "N/A";

  const email = generateEmail(item, referenceNumber, date);
  const suppliers = await getSuppliersForItem(itemId);

  // Advance the workflow: once an exact-match item has a draft and at least one
  // supplier we can email, it is ready for the operator's review + send.
  // (FOUND -> READY_TO_SEND). Never downgrade an already-sent item.
  let status = item.status;
  if (item.status === "FOUND" && suppliers.some((s) => s.email)) {
    await updateItemStatus(itemId, "READY_TO_SEND");
    status = "READY_TO_SEND";
  }

  return NextResponse.json({
    subject: email.subject,
    body: email.body,
    suppliers,
    referenceNumber,
    status,
  });
}
