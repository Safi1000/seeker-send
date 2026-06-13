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

export function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",

    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceKey,
    // Supabase is "configured" only when we have a URL + at least the anon key.
    supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),

    storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "rfq-pdfs",

    // Outlook SMTP (personal account + app password). No Azure required.
    smtpHost: process.env.SMTP_HOST ?? "smtp-mail.outlook.com",
    smtpPort: Number(process.env.SMTP_PORT ?? 587),
    smtpUser: process.env.SMTP_USER, // your Outlook email address
    smtpPass: process.env.SMTP_PASS, // an Outlook app password (not your login password)
    smtpFrom: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    smtpConfigured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
    // Hard upper bound (ms) on a single send. Kept below typical reverse-proxy
    // timeouts so the API always returns JSON instead of letting the gateway
    // kill the request with a raw 502.
    smtpSendTimeoutMs: Number(process.env.SMTP_SEND_TIMEOUT_MS ?? 20_000),

    // Mock switches. Default to mock when the relevant service is unconfigured.
    mockSearch: bool(process.env.MOCK_SEARCH, false),
    mockEmail: bool(
      process.env.MOCK_EMAIL,
      !(process.env.SMTP_USER && process.env.SMTP_PASS),
    ),

    // Supplier search — Serper.dev (real Google results via API).
    // Free 2,500 queries on signup. Needs a single API key.
    serperApiKey: process.env.SERPER_API_KEY,
    serperConfigured: Boolean(process.env.SERPER_API_KEY),
    searchMaxResults: Number(process.env.SEARCH_MAX_RESULTS ?? 8),
  };
}

export type AppEnv = ReturnType<typeof getEnv>;
