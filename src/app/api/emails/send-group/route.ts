import { NextResponse } from "next/server";
import { getSupplier, createEmailLog, setItemsStatus } from "@/lib/repo";
import { sendOutlookEmail } from "@/lib/email/smtp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/emails/send-group — send ONE RFQ email covering several items that
 * share the same recipient. Body: { supplierId, itemIds[], to, subject, body }.
 *
 * Always user-initiated (called after review + click). Logs once against the
 * group's primary supplier and marks every covered item EMAIL_SENT / EMAIL_FAILED.
 */
export async function POST(req: Request) {
  const { supplierId, itemIds, to, subject, body } = (await req.json()) as {
    supplierId?: string;
    itemIds?: string[];
    to?: string;
    subject?: string;
    body?: string;
  };

  if (!supplierId || !itemIds?.length || !to || !subject || !body) {
    return NextResponse.json(
      { error: "supplierId, itemIds, to, subject and body are all required." },
      { status: 400 },
    );
  }

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
  await setItemsStatus(itemIds, newStatus);

  if (result.status === "FAILED") {
    return NextResponse.json(
      { status: newStatus, error: result.error ?? "Send failed" },
      { status: 502 },
    );
  }
  return NextResponse.json({ status: newStatus, messageId: result.messageId });
}
