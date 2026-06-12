"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Mail, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Supplier } from "@/lib/types";

interface Props {
  itemId: string;
  initialSubject: string;
  initialBody: string;
  suppliers: Supplier[];
  defaultSupplierId: string | null;
  outlookConnected: boolean;
  mock: boolean;
}

export function EmailEditor({
  itemId,
  initialSubject,
  initialBody,
  suppliers,
  defaultSupplierId,
  outlookConnected,
  mock,
}: Props) {
  const router = useRouter();
  const suppliersWithEmail = suppliers.filter((s) => s.email);
  const [supplierId, setSupplierId] = useState<string>(
    defaultSupplierId ?? suppliersWithEmail[0]?.id ?? "",
  );
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const selected = suppliers.find((s) => s.id === supplierId);
  const recipient = selected?.email ?? "";

  async function send() {
    if (!supplierId || !recipient) {
      toast.error("Select a supplier with an email address.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, supplierId, to: recipient, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to send email");
        return;
      }
      setSent(true);
      toast.success(mock ? "Email sent (mock mode)." : "Email sent via Outlook.");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      {!outlookConnected && !mock && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Outlook is not connected. Connect it in{" "}
          <a href="/settings" className="font-medium underline">
            Settings
          </a>{" "}
          before sending, or enable mock mode.
        </div>
      )}
      {mock && (
        <div className="flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
          <Mail className="h-4 w-4 shrink-0" />
          Mock email mode is on — sending is simulated, no real email leaves the system.
        </div>
      )}

      <Card className="space-y-4 p-5">
        <div className="grid gap-2">
          <Label>Supplier / Recipient</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a supplier" />
            </SelectTrigger>
            <SelectContent>
              {suppliersWithEmail.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.supplier_name} — {s.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {suppliersWithEmail.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No suppliers with an email address are available for this item.
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="to">To</Label>
          <Input id="to" value={recipient} readOnly className="font-mono text-sm" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="body">Message (editable before sending)</Label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[360px] font-mono text-sm leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            onClick={send}
            disabled={sending || sent || !recipient || (!outlookConnected && !mock)}
          >
            {sending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            {sent ? "Sent" : "Send Email"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
