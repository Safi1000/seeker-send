import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Plug, PlugZap, FlaskConical } from "lucide-react";
import { defaultEmailTemplate } from "@/lib/mock-data";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Procura AI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [clientId, setClientId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [redirectUri, setRedirectUri] = useState("https://app.example.com/auth/callback");
  const [connected, setConnected] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [template, setTemplate] = useState(defaultEmailTemplate);

  const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure Outlook integration and the RFQ email template.</p>
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Outlook Integration</h2>
            <p className="text-xs text-muted-foreground">Microsoft 365 OAuth credentials for sending RFQ emails.</p>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${connected ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
            {connected ? "Connected" : "Not connected"}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Microsoft Client ID">
            <input value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls} placeholder="00000000-0000-0000-0000-000000000000" />
          </Field>
          <Field label="Tenant ID">
            <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} className={inputCls} placeholder="common or tenant GUID" />
          </Field>
          <Field label="Redirect URI" className="md:col-span-2">
            <input value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} className={`${inputCls} font-mono text-xs`} />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button onClick={() => setConnected(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plug className="h-3.5 w-3.5" /> Connect Outlook
          </button>
          <button onClick={() => { setConnected(false); setTestResult(null); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-accent">
            <PlugZap className="h-3.5 w-3.5" /> Disconnect Outlook
          </button>
          <button onClick={() => setTestResult(connected ? "Connection OK · graph.microsoft.com reachable" : "Not connected — connect first.")}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-accent">
            <FlaskConical className="h-3.5 w-3.5" /> Test Connection
          </button>
          {testResult && <span className="text-xs text-muted-foreground">{testResult}</span>}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">RFQ Email Template</h2>
          <p className="text-xs text-muted-foreground">
            Variables: <code className="font-mono">{`{{supplier_name}}`}</code>, <code className="font-mono">{`{{part_number}}`}</code>,{" "}
            <code className="font-mono">{`{{manufacturer}}`}</code>, <code className="font-mono">{`{{product}}`}</code>,{" "}
            <code className="font-mono">{`{{quantity}}`}</code>, <code className="font-mono">{`{{unit}}`}</code>
          </p>
        </div>
        <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={14}
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm" />
        <div className="mt-3 flex justify-end">
          <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Save Template
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}