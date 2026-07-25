// OAuth2 provider config for the social platforms. Real endpoints — they become
// live the moment you set the matching SOCIAL_<PLATFORM>_CLIENT_ID / _SECRET env
// vars. Until then isProviderConfigured() is false and the UI offers manual
// connection instead.

import { APP_URL } from "./stripe";

export type SocialProvider = {
  key: string;
  label: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string;
  // Some providers (X, TikTok) require PKCE — flagged for the callback.
  pkce?: boolean;
};

export const PROVIDERS: Record<string, SocialProvider> = {
  spotify: {
    key: "spotify",
    label: "Spotify for Artists",
    authUrl: "https://accounts.spotify.com/authorize",
    tokenUrl: "https://accounts.spotify.com/api/token",
    scopes: "user-read-private user-read-email user-top-read",
  },
  youtube: {
    key: "youtube",
    label: "YouTube",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: "https://www.googleapis.com/auth/youtube.readonly",
  },
  facebook: {
    key: "facebook",
    label: "Facebook",
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    scopes: "public_profile,pages_show_list,pages_read_engagement",
  },
  instagram: {
    key: "instagram",
    label: "Instagram",
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    scopes: "instagram_basic,pages_show_list",
  },
  tiktok: {
    key: "tiktok",
    label: "TikTok",
    authUrl: "https://www.tiktok.com/v2/auth/authorize",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token",
    scopes: "user.info.basic",
    pkce: true,
  },
  x: {
    key: "x",
    label: "X",
    authUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    scopes: "tweet.read users.read offline.access",
    pkce: true,
  },
};

function envKey(platform: string, suffix: "CLIENT_ID" | "CLIENT_SECRET"): string {
  return `SOCIAL_${platform.toUpperCase()}_${suffix}`;
}

export function clientId(platform: string): string | undefined {
  return process.env[envKey(platform, "CLIENT_ID")];
}
export function clientSecret(platform: string): string | undefined {
  return process.env[envKey(platform, "CLIENT_SECRET")];
}

export function isProviderConfigured(platform: string): boolean {
  return !!clientId(platform) && !!clientSecret(platform);
}

export function redirectUri(platform: string): string {
  return `${APP_URL}/api/social/oauth/${platform}/callback`;
}

export function configuredProviders(): string[] {
  return Object.keys(PROVIDERS).filter(isProviderConfigured);
}
