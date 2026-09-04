/**
 * Validate a post-login redirect target.
 *
 * Skool links point straight at a quiz or action step, so an artist who is not
 * signed in has to be able to come back to exactly that page after logging in.
 * The target arrives in a query string, which makes it attacker-controlled: only
 * same-site absolute paths are accepted, so a crafted link cannot bounce someone
 * from Riff's login form onto another origin.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Must be a rooted path. "//evil.com" and "/\evil.com" are protocol-relative
  // URLs that browsers treat as another origin, so they are rejected too.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (raw.includes("://")) return null;
  return raw;
}
