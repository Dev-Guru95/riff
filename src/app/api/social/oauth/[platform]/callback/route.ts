import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { encryptNullable } from "@/lib/crypto";
import { PROVIDERS, isProviderConfigured, clientId, clientSecret, redirectUri } from "@/lib/social-providers";

const APP = process.env.APP_URL || "http://localhost:3000";

// OAuth2 callback: validate state, exchange the code for tokens, store them
// encrypted, and mark the account connected via OAuth.
export async function GET(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", APP));

  const { platform } = await params;
  const provider = PROVIDERS[platform];
  if (!provider || !isProviderConfigured(platform)) {
    return NextResponse.redirect(new URL("/audit?error=provider", APP));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const store = await cookies();
  const expectedState = store.get(`oauth_state_${platform}`)?.value;
  store.delete(`oauth_state_${platform}`);

  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(new URL("/audit?error=state", APP));
  }

  // Exchange the authorization code for tokens.
  const bodyParams: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(platform),
    client_id: clientId(platform)!,
    client_secret: clientSecret(platform)!,
  };
  if (provider.pkce) bodyParams.code_verifier = state;

  let tokens: { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
  try {
    const res = await fetch(provider.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams(bodyParams).toString(),
    });
    if (!res.ok) throw new Error(`token exchange ${res.status}`);
    tokens = await res.json();
  } catch (err) {
    console.error(`[oauth:${platform}] token exchange failed`, err);
    return NextResponse.redirect(new URL("/audit?error=token", APP));
  }

  if (!tokens.access_token) return NextResponse.redirect(new URL("/audit?error=token", APP));

  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;
  await prisma.socialAccount.upsert({
    where: { userId_platform: { userId: session.id, platform } },
    create: {
      userId: session.id,
      platform,
      handle: platform, // refined by a follow-up profile fetch
      connectVia: "oauth",
      status: "active",
      accessToken: encryptNullable(tokens.access_token),
      refreshToken: encryptNullable(tokens.refresh_token),
      expiresAt,
      scopes: tokens.scope ?? provider.scopes,
    },
    update: {
      connectVia: "oauth",
      status: "active",
      accessToken: encryptNullable(tokens.access_token),
      refreshToken: encryptNullable(tokens.refresh_token),
      expiresAt,
      scopes: tokens.scope ?? provider.scopes,
    },
  });

  return NextResponse.redirect(new URL("/audit?connected=" + platform, APP));
}
