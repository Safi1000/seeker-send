import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Persists the single Outlook OAuth token set for the procurement account.
 * Uses a one-row `ms_oauth_tokens` table when Supabase is configured,
 * otherwise an in-memory fallback (dev mode).
 */

export interface StoredToken {
  access_token: string;
  refresh_token: string | null;
  expires_at: string; // ISO timestamp
  account_email: string | null;
}

const SINGLETON_ID = "default";

const g = globalThis as unknown as { __msToken?: StoredToken | null };

export async function saveToken(token: StoredToken): Promise<void> {
  const db = createSupabaseAdminClient();
  if (db) {
    const { error } = await db
      .from("ms_oauth_tokens")
      .upsert({ id: SINGLETON_ID, ...token, updated_at: new Date().toISOString() });
    if (error) throw error;
    return;
  }
  g.__msToken = token;
}

export async function loadToken(): Promise<StoredToken | null> {
  const db = createSupabaseAdminClient();
  if (db) {
    const { data, error } = await db
      .from("ms_oauth_tokens")
      .select("access_token, refresh_token, expires_at, account_email")
      .eq("id", SINGLETON_ID)
      .maybeSingle();
    if (error) throw error;
    return (data as StoredToken) ?? null;
  }
  return g.__msToken ?? null;
}

export async function clearToken(): Promise<void> {
  const db = createSupabaseAdminClient();
  if (db) {
    await db.from("ms_oauth_tokens").delete().eq("id", SINGLETON_ID);
    return;
  }
  g.__msToken = null;
}
