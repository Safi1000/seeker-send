import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { findItem, defaultEmailTemplate } from "@/lib/mock-data";
import { Save, Send, Pencil } from "lucide-react";

export const Route = createFileRoute("/emails/$itemId")({
  head: () => ({ meta: [{ title: "Email Preview — Procura AI" }] }),
  loader: ({ params }) => {
    const r = findItem(params.itemId);
    if (!r) throw notFound();
    return r;
  },
  component: EmailPreview,
  notFoundComponent: () => <div className="p-6">Item not found.</div>,
  errorComponent: ({ error }) => <div className="p-6 text-rose-600">{error.message}</div>,
});

function EmailPreview() {
  const data = Route.useLoaderData();
  const { item } = data;
  const sup = item.suppliers[0];

  const initialBody = defaultEmailTemplate
    .replaceAll("{{supplier_name}}", sup?.name ?? "Supplier")
    .replaceAll("{{part_number}}", item.partNumber)
    .replaceAll("{{manufacturer}}", item.manufacturer)
    .replaceAll("{{product}}", item.product)
    .replaceAll("{{quantity}}", String(item.quantity))
    .replaceAll("{{unit}}", item.unit);

  const [editing, setEditing] = useState(false);
  const [to, setTo] = useState(sup?.email ?? "");
  const [subject, setSubject] = useState(`RFQ — ${item.partNumber} (${item.manufacturer})`);
  const [body, setBody] = useState(initialBody);
  const [sent, setSent] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="text-xs text-muted-foreground">
          <Link to="/items/$itemId" params={{ itemId: item.id }} className="hover:underline">Back to item</Link>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Email Preview</h1>
        <p className="text-sm text-muted-foreground">Review and edit before sending via Outlook.</p>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-card p-5">
        <Field label="Supplier Email">
          <input value={to} onChange={(e) => setTo(e.target.value)} readOnly={!editing}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono read-only:bg-muted/40" />
        </Field>
        <Field label="Subject">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} readOnly={!editing}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm read-only:bg-muted/40" />
        </Field>
        <Field label="Email Body">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} readOnly={!editing} rows={14}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono read-only:bg-muted/40" />
        </Field>

        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="text-xs text-muted-foreground">
            {sent ? <span className="text-emerald-600 dark:text-emerald-400">Sent via Outlook.</span> : "Draft"}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-accent">
              <Pencil className="h-3.5 w-3.5" /> {editing ? "Stop editing" : "Edit"}
            </button>
            <button onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-accent">
              <Save className="h-3.5 w-3.5" /> Save
            </button>
            <button onClick={() => setSent(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Send className="h-3.5 w-3.5" /> Send Email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}