/**
 * Centralised, typed access to environment configuration.
 *
 * The platform is designed for low-volume usage and a single self-hosted Node
 * deployment, so configuration is intentionally simple. Three independent
 * "mock" switches let the whole workflow be exercised without any external
 * account:
 *
 *   - MOCK_SEARCH  -> supplier search returns deterministic fake results
 *   - MOCK_EMAIL   -> Microsoft Graph "send" is simulated, no real email
 *   - (no Supabase) -> an in-memory data store seeded with sample data
 *
 * Read these inside functions/handlers, never at module top-level, so values
 * are resolved per-request.
 */

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

// ---------------------------------------------------------------------------
// Hardcoded Resend credentials.
//
// The deploy host's env vars aren't editable right now, so these are baked in.
// Resend sends over HTTPS (port 443), which works on hosts that block outbound
// SMTP. Move these to RESEND_* env vars when you can — env always wins.
//
// IMPORTANT: Resend can only send FROM a domain verified in the Resend account.
// Only techxserve.com is verified, so the sender MUST live there. Reply-To has
// no such restriction, so supplier replies are routed to the Outlook inbox.
// ---------------------------------------------------------------------------
const HARDCODED_RESEND_API_KEY = "re_HYnDPSz9_EE2B5Xz8grYriopXiFLQZnXM";
const HARDCODED_RESEND_FROM = "ashfaq@techxserve.com";
const HARDCODED_RESEND_REPLY_TO = "ashfaq@rifetechsolutions.com";

// ---------------------------------------------------------------------------
// Hardcoded SMTP (RIFE TECH mailbox on InMotion Hosting).
//
// Sends directly from the real @rifetechsolutions.com address, so there's no
// Resend domain-verification limit. Port 465 = implicit SSL/TLS (recommended).
// Move to SMTP_* env vars when you can — env always wins over these.
// ---------------------------------------------------------------------------
const HARDCODED_SMTP_HOST = "secure319.inmotionhosting.com";
const HARDCODED_SMTP_PORT = 465;
const HARDCODED_SMTP_USER = "ashfaq@rifetechsolutions.com";
const HARDCODED_SMTP_PASS = "Ashfaq@rife123#";

// ---------------------------------------------------------------------------
// Hardcoded Supabase + Serper credentials.
//
// Single-tenant, private app whose deploy-host env vars aren't editable, so the
// keys are baked in. Without the SERVICE ROLE key the server silently falls back
// to an in-memory store (data resets on restart) — hardcoding it makes Render
// actually persist to Supabase. Env vars always win over these.
// ---------------------------------------------------------------------------
const HARDCODED_SUPABASE_URL = "https://fktjdtncdtxlilvsjelf.supabase.co";
const HARDCODED_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrdGpkdG5jZHR4bGlsdnNqZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzc5MTksImV4cCI6MjA5NjY1MzkxOX0.EZ9dDd7fx5exnBvokfhFWu4E9D3NL_BZPzfHqQ5eVRQ";
const HARDCODED_SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrdGpkdG5jZHR4bGlsdnNqZWxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTA3NzkxOSwiZXhwIjoyMDk2NjUzOTE5fQ.x591goVY5WibftWuPaAf4KhiPw3zcpZ5Tr8HRAJfz50";
const HARDCODED_SERPER_API_KEY = "e0f75ad2924a5a8535a928d3297bf29717f70adc";

export function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? HARDCODED_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? HARDCODED_SUPABASE_ANON_KEY;
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? HARDCODED_SUPABASE_SERVICE_KEY;

  const resendApiKey = process.env.RESEND_API_KEY ?? HARDCODED_RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM ?? HARDCODED_RESEND_FROM;
  const resendReplyTo = process.env.RESEND_REPLY_TO ?? HARDCODED_RESEND_REPLY_TO;

  const smtpUser = process.env.SMTP_USER ?? HARDCODED_SMTP_USER;
  const smtpPass = process.env.SMTP_PASS ?? HARDCODED_SMTP_PASS;
  // Only treat SMTP as configured once a real password has been filled in.
  const smtpReady = Boolean(smtpUser && smtpPass && smtpPass !== "REPLACE_WITH_MAILBOX_PASSWORD");

  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",

    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceKey,
    // Supabase is "configured" only when we have a URL + at least the anon key.
    supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),

    storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "rfq-pdfs",

    // Resend (HTTP email API). Sends over HTTPS (port 443), so it works on
    // hosts that block outbound SMTP ports. Preferred over SMTP when set.
    resendApiKey,
    resendFrom,
    resendReplyTo,
    resendConfigured: Boolean(resendApiKey),

    // SMTP — RIFE TECH mailbox (InMotion). Sends from the real address.
    smtpHost: process.env.SMTP_HOST ?? HARDCODED_SMTP_HOST,
    smtpPort: Number(process.env.SMTP_PORT ?? HARDCODED_SMTP_PORT),
    smtpUser,
    smtpPass,
    smtpFrom: process.env.SMTP_FROM ?? smtpUser,
    smtpConfigured: smtpReady,

    // IMAP — used only to drop a copy of each sent email into the mailbox's
    // "Sent" folder (so sends show up in Outlook). Same host/creds as SMTP.
    imapHost: process.env.IMAP_HOST ?? process.env.SMTP_HOST ?? HARDCODED_SMTP_HOST,
    imapPort: Number(process.env.IMAP_PORT ?? 993),
    // Save a Sent-folder copy after each successful send (best-effort).
    saveToSent: bool(process.env.SAVE_TO_SENT, true),
    // Hard upper bound (ms) on a single send. Kept below typical reverse-proxy
    // timeouts so the API always returns JSON instead of letting the gateway
    // kill the request with a raw 502.
    smtpSendTimeoutMs: Number(process.env.SMTP_SEND_TIMEOUT_MS ?? 20_000),

    // Mock switches. Default to mock when the relevant service is unconfigured.
    mockSearch: bool(process.env.MOCK_SEARCH, false),
    mockEmail: bool(process.env.MOCK_EMAIL, !(resendApiKey || smtpReady)),

    // Supplier search — Serper.dev (real Google results via API).
    // Free 2,500 queries on signup. Needs a single API key.
    serperApiKey: process.env.SERPER_API_KEY ?? HARDCODED_SERPER_API_KEY,
    serperConfigured: Boolean(process.env.SERPER_API_KEY ?? HARDCODED_SERPER_API_KEY),
    searchMaxResults: Number(process.env.SEARCH_MAX_RESULTS ?? 5),
  };
}

export type AppEnv = ReturnType<typeof getEnv>;
