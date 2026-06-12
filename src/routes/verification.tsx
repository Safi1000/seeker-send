import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { allItems } from "@/lib/mock-data";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/verification")({
  head: () => ({ meta: [{ title: "Verification Queue — Procura AI" }] }),
  component: VerificationPage,
});

const filters = ["All", "Inconclusive", "Not Found", "Needs Review"] as const;
type Filter = (typeof filters)[number];
type QueueItem = (typeof allItems)[number];

function reasonFor(item: QueueItem) {
  if (item.status === "Not Found") return "No supplier found";
  if (item.suppliers.length > 1) return "Multiple suppliers found";
  if (item.suppliers[0] && item.suppliers[0].confidence < 0.7) return "Low confidence match";
  return "Manual review";
}

function VerificationPage() {
  const [filter, setFilter] = useState<Filter>("All");

  const queue: QueueItem[] = allItems.filter((i) =>
    ["Inconclusive", "Not Found", "Pending Search"].includes(i.status) ||
    i.suppliers.length > 1 ||
    (!!i.suppliers[0] && i.suppliers[0].confidence < 0.7),
  );

  const filtered = queue.filter((i) => {
    if (filter === "All") return true;
    if (filter === "Inconclusive") return i.status === "Inconclusive";
    if (filter === "Not Found") return i.status === "Not Found";
    return i.suppliers.length > 1 || (!!i.suppliers[0] && i.suppliers[0].confidence < 0.7);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Verification Queue</h1>
        <p className="text-sm text-muted-foreground">Items that need a human to confirm the supplier match.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">RFQ</th>
                <th className="px-5 py-3 font-medium">Part Number</th>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Reason</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">Queue is empty.</td></tr>
              )}
              {filtered.map((i) => (
                <tr key={i.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-5 py-3 font-mono text-xs">{i.rfqNumber}</td>
                  <td className="px-5 py-3 font-mono text-xs">{i.partNumber}</td>
                  <td className="px-5 py-3">{i.product}</td>
                  <td className="px-5 py-3 text-muted-foreground">{reasonFor(i)}</td>
                  <td className="px-5 py-3"><StatusBadge status={i.status} /></td>
                  <td className="px-5 py-3 text-right">
                    <Link to="/items/$itemId" params={{ itemId: i.id }} className="text-sm text-primary hover:underline">Review</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}