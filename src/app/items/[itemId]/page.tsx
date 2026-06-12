import Link from "next/link";
import { notFound } from "next/navigation";
import { getItem, getRfq, getSuppliersForItem } from "@/lib/repo";
import { Card } from "@/components/ui/card";
import type { RfqItem } from "@/lib/types";
import { SupplierPanel } from "./supplier-panel";

export const dynamic = "force-dynamic";

const FIELDS: { label: string; key: keyof RfqItem }[] = [
  { label: "Part Number", key: "part_number" },
  { label: "Manufacturer", key: "manufacturer" },
  { label: "Product", key: "product" },
  { label: "Box Size", key: "box_size" },
  { label: "Application", key: "application" },
  { label: "Analyzer Model", key: "analyzer_model" },
  { label: "Tag Number", key: "tag_number" },
];

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const item = await getItem(itemId);
  if (!item) notFound();
  const [rfq, suppliers] = await Promise.all([
    getRfq(item.rfq_id),
    getSuppliersForItem(itemId),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">
          Dashboard
        </Link>
        <span>/</span>
        {rfq && (
          <>
            <Link href={`/rfqs/${rfq.id}`} className="hover:underline">
              {rfq.reference_number}
            </Link>
            <span>/</span>
          </>
        )}
        <span>Item {item.item_number}</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Item {item.item_number}</h1>
        <p className="text-sm text-muted-foreground">
          {item.product ?? "Item details"}
          {item.quantity != null && (
            <>
              {" · "}
              {item.quantity} {item.unit ?? ""}
            </>
          )}
        </p>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold">Item Details</h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {FIELDS.map((f) => {
            const value = item[f.key];
            return (
              <div key={f.key} className="flex flex-col">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                <dd className="text-sm">
                  {value ? (
                    f.key === "part_number" ? (
                      <span className="font-mono">{String(value)}</span>
                    ) : (
                      String(value)
                    )
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
              </div>
            );
          })}
          <div className="flex flex-col">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Quantity</dt>
            <dd className="text-sm">
              {item.quantity != null ? `${item.quantity} ${item.unit ?? ""}` : "—"}
            </dd>
          </div>
        </dl>
      </Card>

      <SupplierPanel
        itemId={item.id}
        hasPartNumber={Boolean(item.part_number)}
        initialSuppliers={suppliers}
        initialStatus={item.status}
      />
    </div>
  );
}
