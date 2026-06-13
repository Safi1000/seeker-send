"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type Phase = "idle" | "extracting" | "scanning";

export default function UploadPage() {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [scanTotal, setScanTotal] = useState(0);
  const [scanDone, setScanDone] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        toast.error("Please upload a PDF file.");
        return;
      }
      setPhase("extracting");
      try {
        // 1. Upload + extract items.
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/rfqs/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Upload failed");
          setPhase("idle");
          return;
        }
        const rfqId: string = data.rfq.id;
        const items: { id: string }[] = data.items;
        toast.success(`Extracted ${items.length} item(s) from ${data.rfq.reference_number}.`);

        // 2. Auto-scan suppliers for every item (sequentially, with progress).
        setPhase("scanning");
        setScanTotal(items.length);
        setScanDone(0);
        for (const it of items) {
          try {
            await fetch(`/api/items/${it.id}/search`, { method: "POST" });
          } catch {
            // keep going — one failed item shouldn't abort the batch
          }
          setScanDone((n) => n + 1);
        }

        toast.success("Supplier scan complete.");
        router.push(`/rfqs/${rfqId}`);
      } catch (err) {
        toast.error((err as Error).message);
        setPhase("idle");
      }
    },
    [router],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const busy = phase !== "idle";
  const pct = scanTotal > 0 ? Math.round((scanDone / scanTotal) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload RFQ</h1>
        <p className="text-sm text-muted-foreground">
          Drop an RFQ PDF — items are extracted and suppliers are found automatically.
        </p>
      </div>

      <Card
        onDragOver={(e) => {
          if (busy) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={busy ? undefined : onDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-3 border-2 border-dashed p-12 text-center transition-colors",
          busy ? "cursor-default opacity-90" : "cursor-pointer",
          dragOver ? "border-primary bg-primary/5" : "border-border",
        )}
        onClick={() => !busy && inputRef.current?.click()}
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

        {phase === "idle" && (
          <>
            <UploadCloud className="h-10 w-10 text-muted-foreground" />
            <div className="text-sm font-medium">Drag &amp; drop your RFQ PDF here</div>
            <div className="text-xs text-muted-foreground">or click to browse · PDF only</div>
          </>
        )}

        {phase === "extracting" && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-sm font-medium">Extracting items…</div>
          </>
        )}

        {phase === "scanning" && (
          <div className="w-full max-w-sm space-y-3">
            <Search className="mx-auto h-10 w-10 animate-pulse text-primary" />
            <div className="text-sm font-medium">
              Finding suppliers… item {Math.min(scanDone + 1, scanTotal)} of {scanTotal}
            </div>
            <Progress value={pct} />
            <div className="text-xs text-muted-foreground">
              Searching the web and verifying exact part-number matches. This can take a moment per
              item.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
