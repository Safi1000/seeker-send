import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { findItem } from "@/lib/mock-data";
import type { Supplier } from "@/lib/mock-data";
import { StatusBadge } from "@/components/status-badge";
import { Check, X, ExternalLink, Mail } from "lucide-react";

export const Route = createFileRoute("/items/$itemId")({
  head: ({ params }) => ({ meta: [{ title: `Item ${params.itemId} — Procura AI` }] }),
  loader: ({ params }) => {
    const r = findItem(params.itemId);
    if (!r) throw notFound();
    return r;
  },
  component: ItemPage,
  notFoundComponent: () => <div className="p-6">Item not found.</div>,
  errorComponent: ({ error }) => <div className="p-6 text-rose-600">{error.message}</div>,
});

function ItemPage() {
  const { rfq, item } = Route.useLoaderData();
  const fields: Array<[string, string]> = [
    ["Item Number", String(item.itemNumber)],
    ["Part Number", item.partNumber],
    ["Manufacturer", item.manufacturer],
    ["Product", item.product],
    ["Box Size", item.boxSize ?? "—"],
    ["Application", item.application ?? "—"],
    ["Analyzer Model", item.analyzerModel ?? "—"],
    ["Tag Number", item.tagNumber ?? "—"],
    ["Quantity", String(item.quantity)],
    ["Unit", item.unit],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground">
            <Link to="/rfqs/$rfqId" params={{ rfqId: rfq.id }} className="hover:underline">{rfq.number}</Link> / Item {item.itemNumber}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{item.product}</h1>
          <div className="mt-1 font-mono text-xs text-muted-foreground">{item.partNumber}</div>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">Specifications</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3 lg:grid-cols-5">
          {fields.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold">Supplier Results</h2>
            <p className="text-xs text-muted-foreground">{item.suppliers.length} candidate{item.suppliers.length === 1 ? "" : "s"} found.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Supplier</th>
                <th className="px-5 py-3 font-medium">Website</th>
                <th className="px-5 py-3 font-medium">Product Link</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Confidence</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {item.suppliers.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-muted-foreground">No suppliers matched. Try the Verification Queue.</td></tr>
              )}
              {item.suppliers.map((s: Supplier) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-5 py-3 font-medium">{s.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{s.website}</td>
                  <td className="px-5 py-3">
                    <a href={s.productLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{s.email}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary" style={{ width: `${Math.round(s.confidence * 100)}%` }} />
                      </div>
                      <span className="tabular-nums text-xs text-muted-foreground">{Math.round(s.confidence * 100)}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-accent">
                        <Check className="h-3 w-3" /> Approve
                      </button>
                      <button className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-accent">
                        <X className="h-3 w-3" /> Reject
                      </button>
                      <Link
                        to="/emails/$itemId"
                        params={{ itemId: item.id }}
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        <Mail className="h-3 w-3" /> Email
                      </Link>
                    </div>
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