import { NextResponse } from "next/server";
import { disconnectOutlook } from "@/lib/email/graph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/outlook/disconnect — clear stored Outlook tokens. */
export async function POST() {
  await disconnectOutlook();
  return NextResponse.json({ ok: true });
}
