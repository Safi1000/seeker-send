import "server-only";
import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";

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
    const transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465, // 465 = implicit TLS; 587 = STARTTLS
      requireTLS: env.smtpPort !== 465,
      auth: { user: env.smtpUser, pass: env.smtpPass },
    });

    const info = await transporter.sendMail({
      from: env.smtpFrom ?? env.smtpUser,
      to: params.to,
      subject: params.subject,
      text: params.body,
    });

    return { status: "SENT", messageId: info.messageId ?? null };
  } catch (err) {
    return { status: "FAILED", messageId: null, error: (err as Error).message };
  }
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
