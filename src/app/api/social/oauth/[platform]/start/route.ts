import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { PROVIDERS, isProviderConfigured, clientId, redirectUri } from "@/lib/social-providers";

// Begin the OAuth2 authorization-code flow. Stores a CSRF state in an httpOnly
// cookie and redirects the user to the provider's consent screen.
export async function GET(_req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", process.env.APP_URL || "http://localhost:3000"));

  const { platform } = await params;
  const provider = PROVIDERS[platform];
  if (!provider) return NextResponse.json({ error: "Unknown platform" }, { status: 404 });
  if (!isProviderConfigured(platform)) {
    return NextResponse.json(
      { error: `${provider.label} OAuth is not configured. Set SOCIAL_${platform.toUpperCase()}_CLIENT_ID and _SECRET.` },
      { status: 503 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const store = await cookies();
  store.set(`oauth_state_${platform}`, state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });

  const url = new URL(provider.authUrl);
  url.searchParams.set("client_id", clientId(platform)!);
  url.searchParams.set("redirect_uri", redirectUri(platform));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", provider.scopes);
  url.searchParams.set("state", state);
  // PKCE providers (X, TikTok) also need a code_challenge; for the scaffold we
  // use the plain method placeholder — wire S256 when enabling those providers.
  if (provider.pkce) {
    url.searchParams.set("code_challenge", state);
    url.searchParams.set("code_challenge_method", "plain");
  }

  return NextResponse.redirect(url.toString());
}
