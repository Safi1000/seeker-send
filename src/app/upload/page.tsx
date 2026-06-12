"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { UploadCloud, FileText, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ItemsTable } from "@/components/items-table";
import { cn } from "@/lib/utils";
import type { Rfq, RfqItem } from "@/lib/types";

export default function UploadPage() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [items, setItems] = useState<RfqItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF file.");
      return;
    }
    setUploading(true);
    setRfq(null);
    setItems([]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/rfqs/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      setRfq(data.rfq);
      setItems(data.items);
      toast.success(
        `Extracted ${data.items.length} item(s) from ${data.rfq.reference_number} (${data.method}).`,
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload RFQ</h1>
        <p className="text-sm text-muted-foreground">
          Drop an RFQ PDF to extract items. Then run supplier search on each item.
        </p>
      </div>

      <Card
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-12 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border",
        )}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {uploading ? (
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        ) : (
          <UploadCloud className="h-10 w-10 text-muted-foreground" />
        )}
        <div className="text-sm font-medium">
          {uploading ? "Extracting items…" : "Drag & drop your RFQ PDF here"}
        </div>
        <div className="text-xs text-muted-foreground">or click to browse · PDF only</div>
      </Card>

      {rfq && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{rfq.reference_number}</span>
              <span className="text-xs text-muted-foreground">· {items.length} items</span>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/rfqs/${rfq.id}`}>
                Open RFQ <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <ItemsTable items={items} />
        </Card>
      )}
    </div>
  );
}
