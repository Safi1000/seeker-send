import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Loader2, Circle } from "lucide-react";

export const Route = createFileRoute("/progress")({
  head: () => ({ meta: [{ title: "Search Progress — Procura AI" }] }),
  component: ProgressPage,
});

const stages = [
  "Parsing PDF",
  "Extracting Items",
  "Searching Suppliers",
  "Finding Emails",
  "Generating RFQ Email",
] as const;

function ProgressPage() {
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>(["[ready] Awaiting pipeline..."]);

  useEffect(() => {
    const messages = [
      "Parsing PDF — 8 pages detected",
      "Extracted 8 line items",
      "Searching: 2010B-2111-MS · Servomex",
      "Found 2 suppliers · best match 98%",
      "Searching: M400-FF-N1 · Mettler Toledo",
      "Resolved sales@servomex.com",
      "Drafted RFQ email for item 1",
      "Pipeline finished — 6 of 8 items ready",
    ];
    let i = 0;
    const id = setInterval(() => {
      setProgress((p) => Math.min(100, p + 12.5));
      setLogs((l) => [...l, `[${new Date().toLocaleTimeString()}] ${messages[i % messages.length]}`]);
      i++;
      if (i >= messages.length) clearInterval(id);
    }, 900);
    return () => clearInterval(id);
  }, []);

  const activeStage = Math.min(stages.length - 1, Math.floor((progress / 100) * stages.length));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Search Progress</h1>
          <p className="text-sm text-muted-foreground">Live status of the current RFQ pipeline.</p>
        </div>
        <Link to="/rfqs/$rfqId" params={{ rfqId: "rfq-2401" }} className="text-sm text-primary hover:underline">
          View RFQ →
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-medium">Overall progress</span>
          <span className="tabular-nums text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <ol className="mt-6 grid gap-3 md:grid-cols-5">
          {stages.map((s, idx) => {
            const done = idx < activeStage || progress >= 100;
            const active = idx === activeStage && progress < 100;
            return (
              <li key={s} className={`rounded-md border p-3 text-sm ${
                active ? "border-primary bg-primary/5"
                  : done ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-border bg-background"}`}>
                <div className="mb-1 flex items-center gap-2">
                  {done ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    : active ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    : <Circle className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stage {idx + 1}</span>
                </div>
                <div className="font-medium">{s}</div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[["Items parsed", "8"], ["Suppliers found", "11"], ["Emails drafted", "6"]].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3 text-sm font-semibold">Activity log</div>
        <div className="max-h-80 overflow-auto bg-background/40 p-4 font-mono text-xs leading-relaxed">
          {logs.map((l, i) => (
            <div key={i} className="text-foreground">{l}</div>
          ))}
        </div>
      </div>
    </div>
  );
}