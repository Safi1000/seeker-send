import Link from "next/link";
import { ExternalLink, Globe, Mail, ShieldCheck } from "lucide-react";
import { listItems, getSuppliersForItem } from "@/lib/repo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import type { RfqItem, Supplier } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VerificationPage() {
  const items = await listItems();
  // Items that have been searched and have suppliers to verify.
  const relevant = items.filter((i) =>
    ["FOUND", "READY_TO_SEND", "EMAIL_SENT", "EMAIL_FAILED"].includes(i.status),
  );

  const rows: { item: RfqItem; supplier: Supplier }[] = [];
  for (const item of relevant) {
    const suppliers = await getSuppliersForItem(item.id);
    for (const supplier of suppliers) rows.push({ item, supplier });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Verification Queue</h1>
        <p className="text-sm text-muted-foreground">
          Confirmed exact part-number matches awaiting review and email dispatch.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card className="px-5 py-12 text-center text-sm text-muted-foreground">
          Nothing to verify yet. Run supplier search on RFQ items to populate this queue.
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map(({ item, supplier }) => (
            <Card key={supplier.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/items/${item.id}`} className="font-medium hover:underline">
                      Item {item.item_number}
                    </Link>
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.part_number}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="text-sm">{supplier.supplier_name}</div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {supplier.website ?? "—"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {supplier.email ?? "No email"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-3 w-3" /> 100 · Exact match
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {supplier.website && (
                    <Button asChild size="sm" variant="outline">
                      <a href={supplier.website} target="_blank" rel="noreferrer">
                        <Globe className="mr-1 h-3.5 w-3.5" /> Open Website
                      </a>
                    </Button>
                  )}
                  {supplier.product_url && (
                    <Button asChild size="sm" variant="outline">
                      <a href={supplier.product_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open Product
                      </a>
                    </Button>
                  )}
                  <Button asChild size="sm" disabled={!supplier.email}>
                    <Link href={`/emails/${item.id}?supplier=${supplier.id}`}>
                      <Mail className="mr-1 h-3.5 w-3.5" /> Send Email
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
