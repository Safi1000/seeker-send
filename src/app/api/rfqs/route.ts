import { NextResponse } from "next/server";
import { listRfqs } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/rfqs — list all RFQs. */
export async function GET() {
  const rfqs = await listRfqs();
  return NextResponse.json({ rfqs });
}
