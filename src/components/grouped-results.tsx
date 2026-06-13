"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  Mail,
  ExternalLink,
  Send,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export interface GroupItemView {
  id: string;
  item_number: number;
  part_number: string | null;
  product: string | null;
  quantity: number | null;
  unit: string | null;
}

export type MatchType = "PART_NUMBER" | "DESCRIPTION" | "MANUFACTURER";

export interface GroupView {
  email: string;
  supplierName: string;
  website: string | null;
  supplierId: string;
  matchType: MatchType;
  itemIds: string[];
  items: GroupItemView[];
  subject: string;
  body: string;
  allSent: boolean;
}

const MATCH_META: Record<
  MatchType,
  { label: string; className: string; warn: boolean }
> = {
  PART_NUMBER: {
    label: "100 · Exact part-number match",
    className: "text-emerald-600 dark:text-emerald-400",
    warn: false,
  },
  DESCRIPTION: {
    label: "Description match · part number verified",
    className: "text-blue-600 dark:text-blue-400",
    warn: false,
  },
  MANUFACTURER: {
    label: "Manufacturer-direct · listing not confirmed",
    className: "text-amber-600 dark:text-amber-400",
    warn: true,
  },
};

export interface NoContactView {
  id: string;
  item_number: number;
  part_number: string | null;
  product: string | null;
  status: string;
}

export function GroupedResults({
  groups,
  noContact,
  mock,
  configured,
}: {
  groups: GroupView[];
  noContact: NoContactView[];
  mock: boolean;
  configured: boolean;
}) {
  if (groups.length === 0 && noContact.length === 0) {
    return (
      <Card className="px-5 py-12 text-center text-sm text-muted-foreground">
        No suppliers discovered yet. Run a scan on this RFQ.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!configured && !mock && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Outlook email is not configured. Set it up in{" "}
          <a href="/settings" className="font-medium underline">
            Settings
          </a>{" "}
          before sending.
        </div>
      )}

      {groups.map((g) => (
        <GroupCard key={g.email} group={g} mock={mock} canSend={configured || mock} />
      ))}

      {noContact.length > 0 && (
        <Card className="border-amber-500/30 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            Flagged — no supplier or manufacturer email found ({noContact.length})
          </div>
          <ul className="space-y-1 text-sm">
            {noContact.map((it) => (
              <li key={it.id} className="flex items-center gap-2 text-muted-foreground">
                <span className="tabular-nums">Item {it.item_number}</span>
                <span className="font-mono text-xs">{it.part_number ?? "—"}</span>
                <span className="truncate">{it.product ?? ""}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function GroupCard({
  group,
  mock,
  canSend,
}: {
  group: GroupView;
  mock: boolean;
  canSend: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(group.subject);
  const [body, setBody] = useState(group.body);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(group.allSent);

  async function send() {
    setSending(true);
    try {
      const res = await fetch("/api/emails/send-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: group.supplierId,
          itemIds: group.itemIds,
          to: group.email,
          subject,
          body,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to send email");
        return;
      }
      setSent(true);
      setOpen(false);
      toast.success(mock ? "Email sent (mock mode)." : "Email sent via Outlook.");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{group.supplierName}</span>
            <span
              className={`inline-flex items-center gap-1 text-xs ${MATCH_META[group.matchType].className}`}
            >
              <ShieldCheck className="h-3 w-3" /> {MATCH_META[group.matchType].label}
            </span>
            {sent && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Sent
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {group.website && (
              <a
                href={group.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Globe className="h-3.5 w-3.5" /> {hostOf(group.website)}
              </a>
            )}
            <a
              href={`mailto:${group.email}`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <Mail className="h-3.5 w-3.5" /> {group.email}
            </a>
          </div>

          <ul className="space-y-0.5 pt-1 text-sm text-muted-foreground">
            {group.items.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center gap-x-2">
                <span className="tabular-nums text-foreground">Item {it.item_number}</span>
                <span className="font-mono text-xs">{it.part_number ?? "—"}</span>
                <span className="truncate">{it.product ?? ""}</span>
                <span className="tabular-nums text-xs">
                  · {it.quantity ?? "—"} {it.unit ?? ""}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {group.website && (
            <Button asChild size="sm" variant="outline">
              <a href={group.website} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open Website
              </a>
            </Button>
          )}
          <Button size="sm" disabled={!canSend || sent} onClick={() => setOpen(true)}>
            <Send className="mr-1 h-3.5 w-3.5" />
            {sent ? "Sent" : `Send Email (${group.items.length})`}
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review &amp; send — {group.supplierName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {MATCH_META[group.matchType].warn && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                This is the <strong>manufacturer&apos;s general contact</strong> — we could not
                confirm they list this exact part. Please review the email carefully before sending.
              </div>
            )}
            {mock && (
              <div className="rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-700 dark:text-blue-400">
                Mock mode — sending is simulated, no real email leaves the system.
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="to">To</Label>
              <Input id="to" value={group.email} readOnly className="font-mono text-sm" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="body">Message (editable)</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[320px] font-mono text-sm leading-relaxed"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={send} disabled={sending}>
              {sending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-4 w-4" />
              )}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
