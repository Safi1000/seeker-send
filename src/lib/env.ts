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

    // Microsoft Graph / Outlook OAuth.
    msTenantId: process.env.MS_TENANT_ID ?? "common",
    msClientId: process.env.MS_CLIENT_ID,
    msClientSecret: process.env.MS_CLIENT_SECRET,
    msRedirectUri:
      process.env.MS_REDIRECT_URI ??
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/auth/outlook/callback`,
    msGraphConfigured: Boolean(process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET),

    // Mock switches. Default to mock when the relevant service is unconfigured.
    mockSearch: bool(process.env.MOCK_SEARCH, false),
    mockEmail: bool(
      process.env.MOCK_EMAIL,
      !(process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET),
    ),

    // Search tuning.
    searchMaxResults: Number(process.env.SEARCH_MAX_RESULTS ?? 8),
  };
}

export type AppEnv = ReturnType<typeof getEnv>;
