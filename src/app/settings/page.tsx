"use client";

import { useEffect, useState } from "react";
import { Mail, Loader2, CheckCircle2, XCircle, Plug } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Status {
  connected: boolean;
  accountEmail: string | null;
  mock: boolean;
  configured: boolean;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/outlook/status", { cache: "no-store" });
      setStatus(await res.json());
    } catch {
      toast.error("Could not load Outlook status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Surface OAuth callback result.
    const sp = new URLSearchParams(window.location.search);
    const outlook = sp.get("outlook");
    if (outlook === "connected") toast.success("Outlook connected.");
    if (outlook === "error") toast.error(`Outlook connection failed: ${sp.get("reason") ?? ""}`);
  }, []);

  async function disconnect() {
    await fetch("/api/auth/outlook/disconnect", { method: "POST" });
    toast.success("Outlook disconnected.");
    load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Connect Outlook for sending RFQ emails and review service modes.
        </p>
      </div>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Outlook / Microsoft Graph</h2>
              <p className="text-sm text-muted-foreground">
                RFQ emails are sent from your authenticated Outlook account.
              </p>
              {loading ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking status…
                </div>
              ) : status ? (
                <div className="mt-3 space-y-1.5 text-sm">
                  <StatusLine
                    ok={status.connected}
                    label={
                      status.connected
                        ? `Connected${status.accountEmail ? ` as ${status.accountEmail}` : ""}`
                        : "Not connected"
                    }
                  />
                  {status.mock && (
                    <div className="text-xs text-blue-600 dark:text-blue-400">
                      Mock email mode is enabled — sending is simulated.
                    </div>
                  )}
                  {!status.configured && !status.mock && (
                    <div className="text-xs text-amber-600 dark:text-amber-400">
                      Microsoft Graph credentials are not configured. Set MS_CLIENT_ID /
                      MS_CLIENT_SECRET, or enable MOCK_EMAIL.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          <div className="shrink-0">
            {status?.connected && !status.mock ? (
              <Button variant="outline" size="sm" onClick={disconnect}>
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={status?.mock || !status?.configured}
                onClick={() => {
                  window.location.href = "/api/auth/outlook";
                }}
              >
                <Plug className="mr-1.5 h-3.5 w-3.5" /> Connect Outlook
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="space-y-3 p-5 text-sm">
        <h2 className="text-sm font-semibold">How it works</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
          <li>Upload an RFQ PDF — items are extracted automatically.</li>
          <li>Run supplier search — only exact part-number matches are accepted.</li>
          <li>Review discovered suppliers and their contact emails.</li>
          <li>Open the email preview, edit if needed, and click Send.</li>
          <li>Emails are sent through your connected Outlook account.</li>
        </ol>
      </Card>
    </div>
  );
}

function StatusLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground" />
      )}
      <span>{label}</span>
    </div>
  );
}
