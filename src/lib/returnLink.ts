// ===== Track return links (the Skool ⇄ Riff loop) =====
// Teaching happens in Skool, assessment happens here. Finishing a track has to
// hand the learner back to Skool — ideally to the *next* track, so the cycle
// repeats without the learner having to find their way back by hand.
//
// Each course carries its own `returnUrl`; when it isn't set we fall back to the
// community root so the button is never a dead end. That fallback is what makes
// the feature work the moment courses are uploaded, with per-track wiring as a
// later refinement rather than a prerequisite.

import { SKOOL_URL } from "./constants";

export const DEFAULT_RETURN_LABEL = "Back to Skool";
export const RETURN_URL_MAX = 2048;
export const RETURN_LABEL_MAX = 60;

/**
 * Only absolute http(s) URLs may be stored. Admin-supplied values are rendered
 * into an `href`, so `javascript:` / `data:` must never survive validation —
 * `new URL()` alone happily parses both.
 */
export function isSafeReturnUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

/** Normalize an admin-submitted value: blank clears the override (null). */
export function normalizeReturnUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeReturnLabel(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, RETURN_LABEL_MAX) : null;
}

export type TrackReturnLink = {
  url: string;
  label: string;
  /** True when the course has no override and we're using the community root. */
  isFallback: boolean;
};

/**
 * Resolve the destination shown on a completed track. Always returns a link:
 * an unset (or unsafe — defence in depth against a row written before/around
 * validation) `returnUrl` degrades to the community root rather than vanishing.
 */
export function resolveReturnLink(course: {
  returnUrl?: string | null;
  returnLabel?: string | null;
}): TrackReturnLink {
  const custom = normalizeReturnUrl(course.returnUrl);
  if (custom && isSafeReturnUrl(custom)) {
    return {
      url: custom,
      label: normalizeReturnLabel(course.returnLabel) ?? DEFAULT_RETURN_LABEL,
      isFallback: false,
    };
  }
  // Deliberately drop the custom label when falling back: a label written for a
  // specific destination ("Continue to Track 2") on a button that lands on the
  // community root is worse than a generic one — it promises the wrong page.
  return { url: SKOOL_URL, label: DEFAULT_RETURN_LABEL, isFallback: true };
}

// ===== Chaining the tracks automatically =====
//
// Finishing Riff track N should hand the learner to Skool track N+1, because
// that is where the next track is taught. Wiring that by hand is eight admin
// edits that are easy to get off-by-one and are lost on any database rebuild.
//
// Only the Skool URLs themselves are unknowable from here, so those are the one
// thing a human supplies (course-import/skool-links.json). The offset-by-one —
// the part that is actually error-prone — is computed.

export type SkoolTrackLink = { track: number; url: string };

export type ChainedReturn = {
  /** 0-based position of the Riff track this applies to. */
  orderIndex: number;
  url: string;
  label: string;
};

/**
 * Work out each track's return destination from an ordered list of Skool track
 * URLs. Track N returns to track N+1; the final track returns to `graduation`
 * (The Keys) when one is configured.
 *
 * Blank or unsafe URLs are skipped rather than written, so a partly-filled
 * config wires up the tracks it can and leaves the rest on the community-root
 * fallback — a half-finished list must never produce a dead link.
 */
export function chainTrackReturns(
  trackCount: number,
  skoolLinks: SkoolTrackLink[],
  graduation?: { url?: string | null; label?: string | null } | null,
): ChainedReturn[] {
  const byTrack = new Map<number, string>();
  for (const l of skoolLinks) {
    const url = normalizeReturnUrl(l.url);
    if (url && isSafeReturnUrl(url)) byTrack.set(l.track, url);
  }

  const out: ChainedReturn[] = [];
  for (let i = 0; i < trackCount; i++) {
    const isLast = i === trackCount - 1;
    if (isLast) {
      const url = normalizeReturnUrl(graduation?.url);
      if (url && isSafeReturnUrl(url)) {
        out.push({
          orderIndex: i,
          url,
          label: normalizeReturnLabel(graduation?.label) ?? "Unlock The Keys",
        });
      }
      continue;
    }
    // Track numbers in the config are 1-based; this track is i+1, so the next
    // one to send them to is i+2.
    const nextTrackNumber = i + 2;
    const url = byTrack.get(nextTrackNumber);
    if (url) out.push({ orderIndex: i, url, label: `Continue to Track ${nextTrackNumber}` });
  }
  return out;
}
