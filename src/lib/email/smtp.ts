import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getEnv } from "@/lib/env";
import { appendToSent } from "./imap";

/**
 * A single pooled transporter is reused across requests. Building a fresh
 * transport — and so re-doing the TLS handshake + SMTP auth — on every send is
 * the main reason sends are slow and intermittently fail with "connection
 * timeout". Pooling keeps a couple of authenticated connections warm and reuses
 * them, which also makes bulk (one-by-one) sending fast.
 *
 * The cache is keyed on the connection settings so a config change rebuilds it.
 */
let cachedTransporter: Transporter | null = null;
let cachedKey = "";

function getTransporter(): Transporter {
  const env = getEnv();
  const key = `${env.smtpHost}:${env.smtpPort}:${env.smtpUser}`;
  if (cachedTransporter && cachedKey === key) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465, // 465 = implicit TLS; 587 = STARTTLS
    requireTLS: env.smtpPort !== 465,
    auth: { user: env.smtpUser, pass: env.smtpPass },
    // Keep a small pool of connections warm and reuse them across sends.
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    // Fail fast with a clear error instead of hanging on a slow/unreachable
    // server (nodemailer's defaults wait far too long, surfacing as a generic
    // "connection timeout" only after a long pause — which the reverse proxy
    // then turns into a 502).
    connectionTimeout: 10_000, // ms to establish the TCP socket
    greetingTimeout: 8_000, // ms to wait for the SMTP greeting
    socketTimeout: 15_000, // ms of socket inactivity once connected
  });
  cachedKey = key;
  return cachedTransporter;
}

/**
 * Outlook email sending via SMTP (Nodemailer).
 *
 * No Azure / OAuth required — uses a personal Outlook.com account with an
 * "app password" (generated after enabling 2-step verification). Suitable for
 * the low-volume, single-operator use case.
 *
 * In mock mode (MOCK_EMAIL=true, the default until SMTP_USER/SMTP_PASS are set)
 * sending is simulated and a fake message id is returned — no real email leaves
 * the system.
 */

export interface SendResult {
  status: "SENT" | "FAILED";
  messageId: string | null;
  error?: string;
}

export async function sendOutlookEmail(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<SendResult> {
  const env = getEnv();

  // Mock mode — simulate a successful send.
  if (env.mockEmail) {
    return {
      status: "SENT",
      messageId: `mock-${Buffer.from(params.to + params.subject).toString("base64").slice(0, 16)}`,
    };
  }

  // Primary path: send directly from the real @rifetechsolutions.com mailbox
  // over SMTP. If that fails (e.g. the deploy host blocks outbound SMTP, the
  // original "Connection timeout"), fall back to Resend over HTTPS so an email
  // still goes out.
  let result: SendResult = {
    status: "FAILED",
    messageId: null,
    error: "Email sending is not configured.",
  };
  // The address the recipient actually saw, so the Sent-folder copy matches.
  let fromUsed: string | null = null;
  let replyToUsed: string | null = null;

  if (env.smtpConfigured) {
    result = await sendViaSmtp(params);
    if (result.status === "SENT") {
      fromUsed = env.smtpFrom ?? env.smtpUser ?? null;
    } else if (env.resendConfigured) {
      const fallback = await sendViaResend(params);
      if (fallback.status === "SENT") {
        result = fallback;
        fromUsed = env.resendFrom ?? null;
        replyToUsed = env.resendReplyTo ?? null;
      }
    }
  } else if (env.resendConfigured) {
    result = await sendViaResend(params);
    if (result.status === "SENT") {
      fromUsed = env.resendFrom ?? null;
      replyToUsed = env.resendReplyTo ?? null;
    }
  }

  // Best-effort: drop a copy in the mailbox's Sent folder so the send shows up
  // in Outlook. Never let this affect the send result.
  if (result.status === "SENT" && fromUsed) {
    void appendToSent({
      from: fromUsed,
      to: params.to,
      subject: params.subject,
      body: params.body,
      replyTo: replyToUsed,
    });
  }

  return result;
}

/** Send a plain-text email over SMTP (pooled transporter + hard timeout). */
async function sendViaSmtp(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<SendResult> {
  const env = getEnv();
  try {
    const transporter = getTransporter();

    // Belt-and-suspenders hard cap: race the send against a timer so the API
    // route always resolves within a bounded time, even if a connection wedges
    // somewhere nodemailer's own timeouts don't cover. This is what prevents the
    // gateway from returning a raw 502 on a slow send.
    const info = await withTimeout(
      transporter.sendMail({
        from: env.smtpFrom ?? env.smtpUser,
        to: params.to,
        subject: params.subject,
        text: params.body,
      }),
      env.smtpSendTimeoutMs,
    );

    return { status: "SENT", messageId: info.messageId ?? null };
  } catch (err) {
    return { status: "FAILED", messageId: null, error: (err as Error).message };
  }
}

/**
 * Send a plain-text email via the Resend HTTP API (https, port 443).
 *
 * No SDK dependency — a single fetch to the REST endpoint. Bounded by an
 * AbortController so a slow network can't hang the request.
 */
async function sendViaResend(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<SendResult> {
  const env = getEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.smtpSendTimeoutMs);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.resendFrom,
        to: [params.to],
        // Replies go to the Outlook address, not the verified sending domain.
        ...(env.resendReplyTo ? { reply_to: env.resendReplyTo } : {}),
        subject: params.subject,
        text: params.body, // plain text only
      }),
      signal: controller.signal,
    });

    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };

    if (!res.ok) {
      return {
        status: "FAILED",
        messageId: null,
        error: data.message ?? data.name ?? `Resend error (HTTP ${res.status}).`,
      };
    }

    return { status: "SENT", messageId: data.id ?? null };
  } catch (err) {
    const aborted = (err as Error).name === "AbortError";
    return {
      status: "FAILED",
      messageId: null,
      error: aborted
        ? `Email send timed out after ${Math.round(env.smtpSendTimeoutMs / 1000)}s.`
        : (err as Error).message,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Reject if `promise` doesn't settle within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Email send timed out after ${Math.round(ms / 1000)}s.`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export interface OutlookStatus {
  connected: boolean;
  accountEmail: string | null;
  mock: boolean;
  configured: boolean;
}

/** Email "connection" status for the settings/send UI. */
export async function getOutlookStatus(): Promise<OutlookStatus> {
  const env = getEnv();
  if (env.mockEmail) {
    return {
      connected: true,
      accountEmail: env.resendFrom ?? env.smtpFrom ?? "mock@outlook.local",
      mock: true,
      configured: env.resendConfigured || env.smtpConfigured,
    };
  }
  // SMTP (the real mailbox) takes precedence; Resend is the fallback.
  if (env.smtpConfigured) {
    return {
      connected: true,
      accountEmail: env.smtpFrom ?? env.smtpUser ?? null,
      mock: false,
      configured: true,
    };
  }
  if (env.resendConfigured) {
    return {
      connected: true,
      accountEmail: env.resendFrom ?? null,
      mock: false,
      configured: true,
    };
  }
  return { connected: false, accountEmail: null, mock: false, configured: false };
}
