import { NextResponse } from "next/server";
import { getItem, replaceSuppliers, updateItemStatus, getSuppliersForItem } from "@/lib/repo";
import { searchSuppliersForItem } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/items/[id]/search — run the escalating supplier ladder for an item
 * (part number -> description -> manufacturer-direct), replace its supplier set,
 * and update its status to FOUND / NOT_FOUND (flagged).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const outcome = await searchSuppliersForItem(item);
  const suppliers = await replaceSuppliers(id, outcome.candidates);
  await updateItemStatus(id, outcome.result);

  return NextResponse.json({
    status: outcome.result,
    usedMock: outcome.usedMock,
    suppliers,
  });
}

/** GET — convenience to read current suppliers without re-searching. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const suppliers = await getSuppliersForItem(id);
  return NextResponse.json({ suppliers });
}
