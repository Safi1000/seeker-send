import { NextResponse } from "next/server";
import { getItem, getSupplier, createEmailLog, updateItemStatus } from "@/lib/repo";
import { sendOutlookEmail } from "@/lib/email/smtp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/emails/send — send the (user-reviewed) RFQ email via Outlook.
 * Body: { itemId, supplierId, to, subject, body }
 *
 * Sending is ALWAYS user-initiated; this endpoint is only ever called after
 * explicit review + click in the UI.
 */
export async function POST(req: Request) {
  const { itemId, supplierId, to, subject, body } = (await req.json()) as {
    itemId?: string;
    supplierId?: string;
    to?: string;
    subject?: string;
    body?: string;
  };

  if (!itemId || !supplierId || !to || !subject || !body) {
    return NextResponse.json(
      { error: "itemId, supplierId, to, subject and body are all required." },
      { status: 400 },
    );
  }

  const item = await getItem(itemId);
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  const supplier = await getSupplier(supplierId);
  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const result = await sendOutlookEmail({ to, subject, body });

  await createEmailLog({
    supplier_id: supplierId,
    recipient_email: to,
    message_id: result.messageId,
    status: result.status,
  });

  const newStatus = result.status === "SENT" ? "EMAIL_SENT" : "EMAIL_FAILED";
  await updateItemStatus(itemId, newStatus);

  if (result.status === "FAILED") {
    return NextResponse.json(
      { status: newStatus, error: result.error ?? "Send failed" },
      { status: 502 },
    );
  }

  return NextResponse.json({ status: newStatus, messageId: result.messageId });
}
