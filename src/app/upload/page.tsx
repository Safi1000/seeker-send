"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Phase = "idle" | "extracting";

export default function UploadPage() {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [reference, setReference] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        toast.error("Please upload a PDF file.");
        return;
      }
      setPhase("extracting");
      try {
        // Upload + extract items, then go straight to the RFQ page — supplier
        // scanning runs there (driven off the DB, so it's resumable and
        // survives navigating away).
        const fd = new FormData();
        fd.append("file", file);
        if (reference.trim()) fd.append("reference_number", reference.trim());
        const res = await fetch("/api/rfqs/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Upload failed");
          setPhase("idle");
          return;
        }
        toast.success(`Extracted ${data.items.length} item(s) — finding suppliers…`);
        router.push(`/rfqs/${data.rfq.id}`);
      } catch (err) {
        toast.error((err as Error).message);
        setPhase("idle");
      }
    },
    [router, reference],
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload RFQ</h1>
        <p className="text-sm text-muted-foreground">
          Drop an RFQ PDF — items are extracted and suppliers are found automatically.
        </p>
      </div>

      <Card className="space-y-2 p-5">
        <Label htmlFor="reference">Your reference number (optional)</Label>
        <Input
          id="reference"
          placeholder="e.g. RFQ-2026-0142"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          disabled={busy}
        />
        <p className="text-xs text-muted-foreground">
          Used as “Our Ref. No.” in every email sent for items in this RFQ. Leave blank to derive it
          from the file name.
        </p>
      </Card>

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
      </Card>
    </div>
  );
}
