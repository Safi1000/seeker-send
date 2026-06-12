import Link from "next/link";
import { listItems } from "@/lib/repo";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import { STATUS_LABELS } from "@/components/status-badge";
import { ITEM_STATUSES, type ItemStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const items = await listItems();
  const total = items.length;

  const counts = ITEM_STATUSES.reduce(
    (acc, s) => {
      acc[s] = items.filter((i) => i.status === s).length;
      return acc;
    },
    {} as Record<ItemStatus, number>,
  );

  const processed = items.filter((i) => i.status !== "PENDING_SEARCH").length;
  const pct = total === 0 ? 0 : Math.round((processed / total) * 100);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Search Progress</h1>
        <p className="text-sm text-muted-foreground">
          Supplier discovery status across all RFQ items.
        </p>
      </div>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Overall progress</span>
          <span className="tabular-nums text-muted-foreground">
            {processed}/{total} items processed
          </span>
        </div>
        <Progress value={pct} />
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {ITEM_STATUSES.map((s) => (
          <Card key={s} className="p-4">
            <div className="text-2xl font-semibold tabular-nums">{counts[s]}</div>
            <div className="mt-1 text-xs text-muted-foreground">{STATUS_LABELS[s]}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4 text-sm font-semibold">All Items</div>
        {items.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No items yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Item</th>
                <th className="px-5 py-2.5 font-medium">Part Number</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
                  <td className="px-5 py-3 font-medium tabular-nums">Item {it.item_number}</td>
                  <td className="px-5 py-3 font-mono text-xs">{it.part_number ?? "—"}</td>
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
        )}
      </Card>
    </div>
  );
}
