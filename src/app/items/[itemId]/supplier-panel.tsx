"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Loader2, ExternalLink, Mail, Globe, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import type { ItemStatus, Supplier } from "@/lib/types";

export function SupplierPanel({
  itemId,
  hasPartNumber,
  initialSuppliers,
  initialStatus,
}: {
  itemId: string;
  hasPartNumber: boolean;
  initialSuppliers: Supplier[];
  initialStatus: ItemStatus;
}) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [status, setStatus] = useState<ItemStatus>(initialStatus);
  const [searching, setSearching] = useState(false);

  async function runSearch() {
    if (!hasPartNumber) {
      toast.error("This item has no part number to search.");
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/items/${itemId}/search`, { method: "POST" });
      const data = await res.json();
      if (!res.ok && res.status !== 422) {
        toast.error(data.error ?? "Search failed");
        return;
      }
      setSuppliers(data.suppliers ?? []);
      setStatus(data.status ?? "NOT_FOUND");
      if (data.status === "FOUND") {
        toast.success(
          `Found ${data.suppliers.length} exact-match supplier(s)${data.usedMock ? " (mock)" : ""}.`,
        );
      } else {
        toast.warning("No exact part-number matches found.");
      }
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Suppliers (exact part-number match)</h2>
          <StatusBadge status={status} />
        </div>
        <Button size="sm" onClick={runSearch} disabled={searching || !hasPartNumber}>
          {searching ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="mr-1.5 h-3.5 w-3.5" />
          )}
          {suppliers.length ? "Re-run Search" : "Run Supplier Search"}
        </Button>
      </div>

      {suppliers.length === 0 ? (
        <Card className="px-5 py-10 text-center text-sm text-muted-foreground">
          {status === "NOT_FOUND"
            ? "No suppliers with an exact part-number match were found."
            : "No suppliers yet. Run a supplier search to discover exact matches."}
        </Card>
      ) : (
        <div className="space-y-3">
          {suppliers.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.supplier_name ?? "Unknown supplier"}</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-3 w-3" /> 100 · Exact match
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {s.email ?? "No email found"}
                  </div>
                  {s.email_source_url && (
                    <div className="truncate text-[11px] text-muted-foreground">
                      Email source: {s.email_source_url}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="flex gap-2">
                    {s.website && (
                      <Button asChild size="sm" variant="outline">
                        <a href={s.website} target="_blank" rel="noreferrer">
                          <Globe className="mr-1 h-3.5 w-3.5" /> Website
                        </a>
                      </Button>
                    )}
                    {s.product_url && (
                      <Button asChild size="sm" variant="outline">
                        <a href={s.product_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 h-3.5 w-3.5" /> Product
                        </a>
                      </Button>
                    )}
                  </div>
                  <Button asChild size="sm" disabled={!s.email}>
                    <Link href={`/emails/${itemId}?supplier=${s.id}`}>
                      <Mail className="mr-1 h-3.5 w-3.5" /> Prepare Email
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
