import "server-only";
import { Client } from "@microsoft/microsoft-graph-client";
import { getEnv } from "@/lib/env";
import { loadToken, saveToken, clearToken, type StoredToken } from "./token-store";

/**
 * Microsoft Graph / Outlook integration.
 *
 * OAuth: authorization-code flow with offline_access for refresh tokens.
 * Send: a draft is created then sent so we can capture a real message id.
 *
 * In mock mode (MOCK_EMAIL=true or Graph not configured) sending is simulated
 * and a fake message id is returned — no real email leaves the system.
 */

const SCOPES = ["openid", "profile", "offline_access", "User.Read", "Mail.Send"];

function authBase() {
  const env = getEnv();
  return `https://login.microsoftonline.com/${env.msTenantId}/oauth2/v2.0`;
}

export function getAuthorizationUrl(state: string): string {
  const env = getEnv();
  const params = new URLSearchParams({
    client_id: env.msClientId ?? "",
    response_type: "code",
    redirect_uri: env.msRedirectUri,
    response_mode: "query",
    scope: SCOPES.join(" "),
    state,
  });
  return `${authBase()}/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<StoredToken> {
  const env = getEnv();
  const res = await fetch(`${authBase()}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.msClientId ?? "",
      client_secret: env.msClientSecret ?? "",
      grant_type: "authorization_code",
      code,
      redirect_uri: env.msRedirectUri,
      scope: SCOPES.join(" "),
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const token: StoredToken = {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? null,
    expires_at: new Date(Date.now() + (json.expires_in - 60) * 1000).toISOString(),
    account_email: await fetchAccountEmail(json.access_token),
  };
  await saveToken(token);
  return token;
}

async function refreshAccessToken(refreshToken: string): Promise<StoredToken> {
  const env = getEnv();
  const res = await fetch(`${authBase()}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.msClientId ?? "",
      client_secret: env.msClientSecret ?? "",
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: SCOPES.join(" "),
    }),
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  const existing = await loadToken();
  const token: StoredToken = {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? existing?.refresh_token ?? refreshToken,
    expires_at: new Date(Date.now() + (json.expires_in - 60) * 1000).toISOString(),
    account_email: existing?.account_email ?? null,
  };
  await saveToken(token);
  return token;
}

async function getValidAccessToken(): Promise<string | null> {
  let token = await loadToken();
  if (!token) return null;
  if (new Date(token.expires_at).getTime() <= Date.now()) {
    if (!token.refresh_token) return null;
    token = await refreshAccessToken(token.refresh_token);
  }
  return token.access_token;
}

async function fetchAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const me = (await res.json()) as { mail?: string; userPrincipalName?: string };
    return me.mail ?? me.userPrincipalName ?? null;
  } catch {
    return null;
  }
}

export interface OutlookStatus {
  connected: boolean;
  accountEmail: string | null;
  mock: boolean;
  configured: boolean;
}

export async function getOutlookStatus(): Promise<OutlookStatus> {
  const env = getEnv();
  if (env.mockEmail) {
    return { connected: true, accountEmail: "mock@outlook.local", mock: true, configured: env.msGraphConfigured };
  }
  const token = await loadToken();
  return {
    connected: Boolean(token),
    accountEmail: token?.account_email ?? null,
    mock: false,
    configured: env.msGraphConfigured,
  };
}

export async function disconnectOutlook(): Promise<void> {
  await clearToken();
}

export interface SendResult {
  status: "SENT" | "FAILED";
  messageId: string | null;
  error?: string;
}

export async function sendOutlookEmail(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<SendResult> {
  const env = getEnv();

  // Mock mode — simulate a successful send.
  if (env.mockEmail) {
    return {
      status: "SENT",
      messageId: `mock-${Buffer.from(params.to + params.subject).toString("base64").slice(0, 16)}`,
    };
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return { status: "FAILED", messageId: null, error: "Outlook not connected" };
  }

  try {
    const client = Client.init({
      authProvider: (done) => done(null, accessToken),
    });

    const message = {
      subject: params.subject,
      body: { contentType: "Text", content: params.body },
      toRecipients: [{ emailAddress: { address: params.to } }],
    };

    // Create a draft so we get a real message id, then send it.
    const draft = (await client.api("/me/messages").post(message)) as { id: string };
    await client.api(`/me/messages/${draft.id}/send`).post({});

    return { status: "SENT", messageId: draft.id };
  } catch (err) {
    return { status: "FAILED", messageId: null, error: (err as Error).message };
  }
}
