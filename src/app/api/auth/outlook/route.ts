import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import { getAuthorizationUrl } from "@/lib/email/graph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/auth/outlook — begin the Outlook OAuth flow. */
export async function GET() {
  const env = getEnv();
  if (!env.msGraphConfigured) {
    return NextResponse.json(
      {
        error:
          "Microsoft Graph is not configured. Set MS_CLIENT_ID / MS_CLIENT_SECRET (or use MOCK_EMAIL=true).",
      },
      { status: 400 },
    );
  }

  const state = randomUUID();
  const jar = await cookies();
  jar.set("ms_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(getAuthorizationUrl(state));
}
