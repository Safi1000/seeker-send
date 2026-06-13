import { NextResponse } from "next/server";
import { deleteRfq, getRfq } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE /api/rfqs/[rfqId] — remove the RFQ and all its data (items, suppliers, logs, PDF). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ rfqId: string }> }) {
  const { rfqId } = await params;
  const rfq = await getRfq(rfqId);
  if (!rfq) return NextResponse.json({ error: "RFQ not found" }, { status: 404 });

  await deleteRfq(rfqId);
  return NextResponse.json({ ok: true });
}
