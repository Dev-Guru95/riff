import { prisma } from "./prisma";
import { decryptNullable, encryptNullable } from "./crypto";
import { PROVIDERS, clientId, clientSecret } from "./social-providers";

type Account = {
  id: string;
  platform: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  connectVia: string;
};

/**
 * Return a valid (decrypted) access token for an OAuth-connected account,
 * refreshing it if expired. Returns null for manual/mock accounts or on failure.
 * Real metric fetches call this before hitting a platform API.
 */
export async function getValidAccessToken(account: Account): Promise<string | null> {
  if (account.connectVia !== "oauth" || !account.accessToken) return null;

  const notExpired = !account.expiresAt || account.expiresAt.getTime() > Date.now() + 60_000;
  if (notExpired) return decryptNullable(account.accessToken);

  // Token expired — refresh.
  const provider = PROVIDERS[account.platform];
  const refresh = decryptNullable(account.refreshToken);
  if (!provider || !refresh) return null;

  try {
    const res = await fetch(provider.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refresh,
        client_id: clientId(account.platform) ?? "",
        client_secret: clientSecret(account.platform) ?? "",
      }).toString(),
    });
    if (!res.ok) throw new Error(`refresh ${res.status}`);
    const t: { access_token?: string; refresh_token?: string; expires_in?: number } = await res.json();
    if (!t.access_token) return null;

    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        accessToken: encryptNullable(t.access_token),
        refreshToken: t.refresh_token ? encryptNullable(t.refresh_token) : account.refreshToken,
        expiresAt: t.expires_in ? new Date(Date.now() + t.expires_in * 1000) : null,
      },
    });
    return t.access_token;
  } catch (err) {
    console.error(`[social:${account.platform}] refresh failed`, err);
    await prisma.socialAccount.update({ where: { id: account.id }, data: { status: "expired" } });
    return null;
  }
}
