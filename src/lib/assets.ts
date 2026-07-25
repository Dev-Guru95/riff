import { isTrackBadgeKey } from "./constants";

// ─────────────────────────────────────────────────────────────────────────────
// Placeholder achievement art. Everything here is TEMPORARY and meant to be
// swapped by a designer with zero code changes:
//
//   • Badge art   →  replace the SVGs in `public/badges/`  (keep the filenames)
//   • Track badge →  `public/badges/track.svg`  (shared by every course badge)
//   • Certificate →  `public/certificate/template.svg`  or the
//                    `<CertificateArtwork>` component in src/components/
//
// To swap in per-badge images beyond the static set, drop `public/badges/<key>.svg`
// and add the key to STATIC_BADGE_ART below.
// ─────────────────────────────────────────────────────────────────────────────

/** Badge keys that have a dedicated placeholder file in `public/badges/`. */
const STATIC_BADGE_ART = new Set([
  "first_steps",
  "quiz_whiz",
  "first_submission",
  "streak_7",
  "mission_marathon",
  "program_graduate",
]);

/**
 * Public path to a badge's art. Static badges get their own file; every
 * per-course track badge shares `track.svg`; anything unknown falls back to
 * `_default.svg` — so a newly added badge always renders something.
 */
export function badgeAsset(key: string): string {
  if (STATIC_BADGE_ART.has(key)) return `/badges/${key}.svg`;
  if (isTrackBadgeKey(key)) return "/badges/track.svg";
  return "/badges/_default.svg";
}

/** Public path to the placeholder certificate template. */
export const CERTIFICATE_TEMPLATE = "/certificate/template.svg";
