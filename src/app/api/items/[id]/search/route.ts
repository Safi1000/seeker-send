import { NextResponse } from "next/server";
import { getItem, replaceSuppliers, updateItemStatus, getSuppliersForItem } from "@/lib/repo";
import { searchSuppliers } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/items/[id]/search — run exact-part-number supplier discovery for
 * an item, replace its supplier set, and update its status to FOUND/NOT_FOUND.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  if (!item.part_number) {
    await updateItemStatus(id, "NOT_FOUND");
    return NextResponse.json(
      { error: "Item has no part number to search.", status: "NOT_FOUND", suppliers: [] },
      { status: 422 },
    );
  }

  const outcome = await searchSuppliers(item.part_number);
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
