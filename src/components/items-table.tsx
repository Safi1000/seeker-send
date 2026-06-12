import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import type { RfqItem } from "@/lib/types";

export function ItemsTable({ items }: { items: RfqItem[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
          <th className="px-5 py-2.5 font-medium">Item</th>
          <th className="px-5 py-2.5 font-medium">Part Number</th>
          <th className="px-5 py-2.5 font-medium">Manufacturer</th>
          <th className="px-5 py-2.5 font-medium">Product</th>
          <th className="px-5 py-2.5 font-medium">Qty</th>
          <th className="px-5 py-2.5 font-medium">Status</th>
          <th className="px-5 py-2.5"></th>
        </tr>
      </thead>
      <tbody>
        {items.map((it) => (
          <tr key={it.id} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
            <td className="px-5 py-3 font-medium tabular-nums">Item {it.item_number}</td>
            <td className="px-5 py-3 font-mono text-xs">{it.part_number ?? "—"}</td>
            <td className="px-5 py-3">{it.manufacturer ?? "—"}</td>
            <td className="px-5 py-3 max-w-xs truncate">{it.product ?? "—"}</td>
            <td className="px-5 py-3 tabular-nums">
              {it.quantity ?? "—"} {it.unit ?? ""}
            </td>
            <td className="px-5 py-3">
              <StatusBadge status={it.status} />
            </td>
            <td className="px-5 py-3 text-right">
              <Link href={`/items/${it.id}`} className="text-primary hover:underline">
                Details
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
