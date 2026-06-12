import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { findRfq } from "@/lib/mock-data";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/rfqs/$rfqId")({
  head: ({ params }) => ({ meta: [{ title: `RFQ ${params.rfqId} — Procura AI` }] }),
  loader: ({ params }) => {
    const rfq = findRfq(params.rfqId);
    if (!rfq) throw notFound();
    return { rfq };
  },
  component: RfqPage,
  notFoundComponent: () => <div className="p-6">RFQ not found.</div>,
  errorComponent: ({ error }) => <div className="p-6 text-rose-600">{error.message}</div>,
});

function RfqPage() {
  const { rfq } = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{rfq.number}</h1>
          <p className="text-sm text-muted-foreground">Uploaded {rfq.uploadDate} · {rfq.totalItems} items</p>
        </div>
        <StatusBadge status={rfq.status} />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">#</th>
                <th className="px-5 py-3 font-medium">Part Number</th>
                <th className="px-5 py-3 font-medium">Manufacturer</th>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Qty</th>
                <th className="px-5 py-3 font-medium">Unit</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {rfq.items.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-muted-foreground">No items loaded.</td></tr>
              )}
              {rfq.items.map((i) => (
                <tr key={i.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-5 py-3 tabular-nums text-muted-foreground">{i.itemNumber}</td>
                  <td className="px-5 py-3 font-mono text-xs">{i.partNumber}</td>
                  <td className="px-5 py-3">{i.manufacturer}</td>
                  <td className="px-5 py-3">{i.product}</td>
                  <td className="px-5 py-3 tabular-nums">{i.quantity}</td>
                  <td className="px-5 py-3 text-muted-foreground">{i.unit}</td>
                  <td className="px-5 py-3"><StatusBadge status={i.status} /></td>
                  <td className="px-5 py-3 text-right">
                    <Link to="/items/$itemId" params={{ itemId: i.id }} className="text-sm text-primary hover:underline">Details</Link>
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