import { NextResponse } from "next/server";
import { getOutlookStatus } from "@/lib/email/smtp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/auth/outlook/status — connection status for the UI. */
export async function GET() {
  const status = await getOutlookStatus();
  return NextResponse.json(status);
}
