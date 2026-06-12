import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/dashboard — aggregate dashboard stats. */
export async function GET() {
  const stats = await getDashboardStats();
  return NextResponse.json({ stats });
}
