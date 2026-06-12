import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { FileText, Package, Building2, Mail, AlertTriangle, ArrowUpRight } from "lucide-react";
import { rfqs, dashboardStats } from "@/lib/mock-data";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Procura AI" },
      { name: "description", content: "AI procurement assistant dashboard: RFQs, items, suppliers and email status." },
      { property: "og:title", content: "Dashboard — Procura AI" },
      { property: "og:description", content: "AI procurement assistant dashboard." },
    ],
  }),
  component: Index,
});

function Index() {
  const stats = [
    { label: "RFQs Uploaded", value: dashboardStats.rfqsUploaded, icon: FileText, tone: "text-blue-600 dark:text-blue-400" },
    { label: "Items Processed", value: dashboardStats.itemsProcessed, icon: Package, tone: "text-violet-600 dark:text-violet-400" },
    { label: "Suppliers Found", value: dashboardStats.suppliersFound, icon: Building2, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: "Emails Sent", value: dashboardStats.emailsSent, icon: Mail, tone: "text-cyan-600 dark:text-cyan-400" },
    { label: "Failed Emails", value: dashboardStats.emailsFailed, icon: AlertTriangle, tone: "text-rose-600 dark:text-rose-400" },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Procurement Overview</h1>
          <p className="text-sm text-muted-foreground">Live status of your RFQ pipeline.</p>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Upload RFQ
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</span>
              <s.icon className={`h-4 w-4 ${s.tone}`} />
            </div>
            <div className="mt-3 text-3xl font-semibold tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold">Recent RFQs</h2>
            <p className="text-xs text-muted-foreground">Most recently uploaded requests for quotation.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">RFQ Number</th>
                <th className="px-5 py-3 font-medium">Upload Date</th>
                <th className="px-5 py-3 font-medium">Total Items</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {rfqs.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-5 py-3 font-medium">{r.number}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.uploadDate}</td>
                  <td className="px-5 py-3 tabular-nums">{r.totalItems}</td>
                  <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-5 py-3 text-right">
                    <Link to="/rfqs/$rfqId" params={{ rfqId: r.id }} className="text-sm text-primary hover:underline">View</Link>
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
