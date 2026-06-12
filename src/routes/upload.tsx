import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type DragEvent } from "react";
import { Upload as UploadIcon, FileText } from "lucide-react";
import { rfqs } from "@/lib/mock-data";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload RFQ — Procura AI" },
      { name: "description", content: "Drag and drop a PDF to parse and extract procurement items." },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  const [dragOver, setDragOver] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const navigate = useNavigate();

  const rfq = rfqs[0];

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setUploaded(f.name);
      setTimeout(() => navigate({ to: "/progress" }), 400);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload RFQ</h1>
        <p className="text-sm text-muted-foreground">Drop a PDF below — we'll extract items and search suppliers.</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-card p-12 text-center transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UploadIcon className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium">Drag & drop your RFQ PDF</p>
        <p className="mt-1 text-xs text-muted-foreground">or click to browse — max 25 MB</p>
        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
          Choose file
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) { setUploaded(f.name); setTimeout(() => navigate({ to: "/progress" }), 400); }
            }}
          />
        </label>
        {uploaded && (
          <div className="mt-4 flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" /> {uploaded}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">RFQ Summary — most recent</h2>
          <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">RFQ Number</div>
              <div className="font-medium">{rfq.number}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Upload Date</div>
              <div className="font-medium">{rfq.uploadDate}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Items</div>
              <div className="font-medium tabular-nums">{rfq.totalItems}</div>
            </div>
          </div>
        </div>
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
                <th className="px-5 py-3 font-medium">Search Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
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
                    <Link to="/items/$itemId" params={{ itemId: i.id }} className="text-sm text-primary hover:underline">
                      Details
                    </Link>
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