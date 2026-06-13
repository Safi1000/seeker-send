import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Store the uploaded RFQ PDF. Uses Supabase Storage when configured, otherwise
 * writes to a local uploads directory (dev mode). Returns the stored path.
 */
export async function storeRfqPdf(
  fileName: string,
  bytes: Buffer,
): Promise<string> {
  const env = getEnv();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;

  const db = createSupabaseAdminClient();
  if (db) {
    const { error } = await db.storage
      .from(env.storageBucket)
      .upload(objectPath, bytes, { contentType: "application/pdf", upsert: false });
    if (error) {
      console.warn("[storage] Supabase upload failed, falling back to local:", error.message);
    } else {
      return `${env.storageBucket}/${objectPath}`;
    }
  }

  // Local fallback.
  const dir = path.join(process.cwd(), "tmp", "uploads");
  await fs.mkdir(dir, { recursive: true });
  const localPath = path.join(dir, `${randomUUID()}-${safeName}`);
  await fs.writeFile(localPath, bytes);
  return localPath;
}

/** Remove a stored RFQ PDF (Supabase Storage object or local file). Best-effort. */
export async function deleteRfqPdf(filePath: string | null): Promise<void> {
  if (!filePath) return;
  const env = getEnv();
  const db = createSupabaseAdminClient();
  const prefix = `${env.storageBucket}/`;

  if (db && filePath.startsWith(prefix)) {
    const objectPath = filePath.slice(prefix.length);
    const { error } = await db.storage.from(env.storageBucket).remove([objectPath]);
    if (error) console.warn("[storage] failed to delete object:", error.message);
    return;
  }

  // Local file fallback.
  try {
    await fs.unlink(filePath);
  } catch {
    // already gone / not a local path — ignore
  }
}
