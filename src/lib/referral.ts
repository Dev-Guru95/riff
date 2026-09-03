// ===== Signup attribution (where did this artist come from?) =====
//
// Teaching lives in Skool and assessment lives here, so nearly every artist
// arrives through a link in a Skool track. Knowing *which* track sent them is
// the difference between "Skool works" and "Track 00 converts, Track 3 doesn't".
//
// The mechanism is a `?ref=` query parameter, captured on whatever page the
// learner lands on, held in a cookie across the pages they browse before
// deciding to sign up, and finally written onto the User row. It deliberately
// reuses the existing analytics layer (`track("signup", …)`) rather than adding
// a parallel attribution system: the AnalyticsEvent row is the time series, and
// `User.referralSource` is the durable per-account answer.
//
// The cookie is NOT httpOnly — the value is a public campaign tag, and the
// signup form (a Client Component) has to read it. Nothing security-relevant
// is ever stored here.

export const REFERRAL_COOKIE = "riff_ref";
export const REFERRAL_PARAM = "ref";
export const REFERRAL_MAX_AGE_DAYS = 30;
export const REFERRAL_MAX_LENGTH = 64;

/**
 * Accept only a conservative slug: lowercase letters, digits, hyphen and
 * underscore. The value is echoed back into admin screens and stored on the
 * user, so anything that could carry markup, a URL, or PII is rejected outright
 * rather than sanitized — a malformed tag is not worth keeping.
 */
export function normalizeReferral(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.length > REFERRAL_MAX_LENGTH) return null;
  return /^[a-z0-9][a-z0-9_-]*$/.test(trimmed) ? trimmed : null;
}

/** The canonical tag for the link that lives in Skool's Track 00 (Welcome). */
export const SKOOL_TRACK_00_REF = "skool-track-00";

/** Build the signup URL to paste into a Skool track. */
export function signupUrl(origin: string, ref: string): string {
  const url = new URL("/signup", origin);
  url.searchParams.set(REFERRAL_PARAM, ref);
  return url.toString();
}
