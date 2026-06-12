"use client";

import { useEffect, useState } from "react";
import { Mail, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";

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
      toast.error("Could not load email status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Outlook email configuration and service modes.
        </p>
      </div>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Outlook email (SMTP)</h2>
            <p className="text-sm text-muted-foreground">
              RFQ emails are sent from your Outlook account over SMTP.
            </p>
            {loading ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking status…
              </div>
            ) : status ? (
              <div className="mt-3 space-y-1.5 text-sm">
                <StatusLine
                  ok={status.configured}
                  label={
                    status.configured
                      ? `Configured${status.accountEmail ? ` — sending as ${status.accountEmail}` : ""}`
                      : "Not configured"
                  }
                />
                {status.mock && (
                  <div className="text-xs text-blue-600 dark:text-blue-400">
                    Mock email mode is enabled — sending is simulated, no real email is sent.
                  </div>
                )}
                {!status.configured && !status.mock && (
                  <div className="text-xs text-amber-600 dark:text-amber-400">
                    Set SMTP_USER and SMTP_PASS (Outlook app password) in your environment.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <Card className="space-y-3 p-5 text-sm">
        <h2 className="text-sm font-semibold">Email (SMTP) configuration</h2>
        <p className="text-muted-foreground">
          Set these environment variables, then restart the app — this page will show
          “Configured”.
        </p>
        <ul className="space-y-1.5 text-muted-foreground">
          <li>
            <code className="font-mono">SMTP_HOST</code> — your mail server (e.g.{" "}
            <code className="font-mono">mail.yourdomain.com</code>)
          </li>
          <li>
            <code className="font-mono">SMTP_PORT</code> — <code className="font-mono">465</code>{" "}
            (SSL) or <code className="font-mono">587</code> (STARTTLS)
          </li>
          <li>
            <code className="font-mono">SMTP_USER</code> — your full email address
          </li>
          <li>
            <code className="font-mono">SMTP_PASS</code> — your mailbox password (or an app
            password if your provider requires one)
          </li>
          <li>
            <code className="font-mono">MOCK_EMAIL=false</code> — to send real email
          </li>
        </ul>
      </Card>

      <Card className="space-y-3 p-5 text-sm">
        <h2 className="text-sm font-semibold">How it works</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
          <li>Upload an RFQ PDF — items are extracted automatically.</li>
          <li>Run supplier search — only exact part-number matches are accepted.</li>
          <li>Review discovered suppliers and their contact emails.</li>
          <li>Open the email preview, edit if needed, and click Send.</li>
          <li>Emails are sent through your Outlook account.</li>
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
