import Link from "next/link";
import { FileText, PackageSearch, Building2, MailCheck, ArrowRight } from "lucide-react";
import { getDashboardStats, listRfqs, getItemsForRfq } from "@/lib/repo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";

const CARDS = [
  { key: "rfqsUploaded", label: "RFQs Uploaded", icon: FileText },
  { key: "itemsFound", label: "Items Found", icon: PackageSearch },
  { key: "suppliersFound", label: "Suppliers Found", icon: Building2 },
  { key: "emailsSent", label: "Emails Sent", icon: MailCheck },
] as const;

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const rfqs = await listRfqs();

  // Compute per-RFQ item counts (low volume — cheap).
  const rfqRows = await Promise.all(
    rfqs.slice(0, 8).map(async (r) => {
      const items = await getItemsForRfq(r.id);
      const sent = items.filter((i) => i.status === "EMAIL_SENT").length;
      return { rfq: r, total: items.length, sent };
    }),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of RFQ processing, supplier discovery and outbound emails.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.key} className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{c.label}</span>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-3 text-3xl font-semibold tabular-nums">
                {stats[c.key as keyof typeof stats]}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Recent RFQs</h2>
          <Button asChild size="sm" variant="outline">
            <Link href="/upload">
              Upload RFQ <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        {rfqRows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No RFQs yet. Upload your first RFQ PDF to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Reference</th>
                <th className="px-5 py-2.5 font-medium">Uploaded</th>
                <th className="px-5 py-2.5 font-medium">Items</th>
                <th className="px-5 py-2.5 font-medium">Emails Sent</th>
                <th className="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rfqRows.map(({ rfq, total, sent }) => (
                <tr key={rfq.id} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
                  <td className="px-5 py-3 font-medium">{rfq.reference_number}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {new Date(rfq.uploaded_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 tabular-nums">{total}</td>
                  <td className="px-5 py-3 tabular-nums">{sent}</td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/rfqs/${rfq.id}`} className="text-primary hover:underline">
                      View
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
