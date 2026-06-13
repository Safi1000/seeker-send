import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getEnv } from "@/lib/env";

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

  if (!env.smtpUser || !env.smtpPass) {
    return { status: "FAILED", messageId: null, error: "Outlook SMTP is not configured." };
  }

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

/** SMTP "connection" status for the settings UI. */
export async function getOutlookStatus(): Promise<OutlookStatus> {
  const env = getEnv();
  if (env.mockEmail) {
    return {
      connected: true,
      accountEmail: env.smtpFrom ?? "mock@outlook.local",
      mock: true,
      configured: env.smtpConfigured,
    };
  }
  return {
    connected: env.smtpConfigured,
    accountEmail: env.smtpConfigured ? (env.smtpFrom ?? env.smtpUser ?? null) : null,
    mock: false,
    configured: env.smtpConfigured,
  };
}
