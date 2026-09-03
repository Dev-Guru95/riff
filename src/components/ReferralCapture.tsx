"use client";

import { useEffect } from "react";
import {
  REFERRAL_COOKIE,
  REFERRAL_PARAM,
  REFERRAL_MAX_AGE_DAYS,
  normalizeReferral,
} from "@/lib/referral";

/**
 * Persists a `?ref=` tag the moment someone lands, anywhere on the site.
 *
 * Mounted in the root layout rather than on /signup alone: a learner clicking
 * out of Skool often lands on the marketing page, reads it, and only then signs
 * up. Reading the parameter at submit time would attribute none of those, since
 * the query string is long gone by the time they reach the form.
 *
 * First tag wins. A learner who arrives from Track 00 and later returns through
 * a different link stays credited to the link that actually acquired them.
 */
export function ReferralCapture() {
  useEffect(() => {
    const ref = normalizeReferral(new URLSearchParams(window.location.search).get(REFERRAL_PARAM));
    if (!ref) return;
    if (document.cookie.split("; ").some((c) => c.startsWith(`${REFERRAL_COOKIE}=`))) return;
    const maxAge = REFERRAL_MAX_AGE_DAYS * 24 * 60 * 60;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${REFERRAL_COOKIE}=${encodeURIComponent(ref)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
  }, []);

  return null;
}

/** Read the stored tag. Returns null when nothing was captured. */
export function readReferralCookie(): string | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${REFERRAL_COOKIE}=`));
  if (!hit) return null;
  return normalizeReferral(decodeURIComponent(hit.slice(REFERRAL_COOKIE.length + 1)));
}
