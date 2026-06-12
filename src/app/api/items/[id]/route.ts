import { NextResponse } from "next/server";
import { getItem, getSuppliersForItem } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/items/[id] — item with its suppliers. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  const suppliers = await getSuppliersForItem(id);
  return NextResponse.json({ item, suppliers });
}
