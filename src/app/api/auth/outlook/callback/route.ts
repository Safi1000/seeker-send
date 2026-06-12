import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import { exchangeCodeForToken } from "@/lib/email/graph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/auth/outlook/callback — OAuth redirect target. */
export async function GET(req: Request) {
  const env = getEnv();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const settingsUrl = `${env.appUrl}/settings`;

  if (error) {
    return NextResponse.redirect(`${settingsUrl}?outlook=error&reason=${encodeURIComponent(error)}`);
  }

  const jar = await cookies();
  const expectedState = jar.get("ms_oauth_state")?.value;
  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(`${settingsUrl}?outlook=error&reason=state_mismatch`);
  }

  try {
    await exchangeCodeForToken(code);
    jar.delete("ms_oauth_state");
    return NextResponse.redirect(`${settingsUrl}?outlook=connected`);
  } catch (err) {
    console.error("[oauth] callback failed:", err);
    return NextResponse.redirect(`${settingsUrl}?outlook=error&reason=exchange_failed`);
  }
}
