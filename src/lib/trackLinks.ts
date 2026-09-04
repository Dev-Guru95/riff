// ===== Publishable deep links into a track =====
//
// A Skool track needs to link straight at the thing it is asking the artist to
// do — this track's quiz, or its second action step — not at a track landing
// page they then have to navigate.
//
// The obvious link, /learn/<lessonId>, cannot be published: the id is a cuid, so
// it is regenerated every time content is re-imported and every link pasted into
// Skool breaks on the next rebuild. These addresses are built from the course
// slug and an ordinal instead, both of which are stable across rebuilds because
// they come from the course files rather than the database.

/** Path to a track's quiz. Stable — safe to paste into Skool. */
export function quizPath(slug: string): string {
  return `/courses/${slug}/quiz`;
}

/** Path to a track's Nth action step, 1-based. Stable — safe to paste into Skool. */
export function stepPath(slug: string, n: number): string {
  return `/courses/${slug}/step/${n}`;
}

/**
 * Parse a 1-based step number from a route param.
 *
 * Rejects anything that is not a positive integer — "01", "1.5", "-1", "1e3"
 * and "abc" all fail rather than being coerced into a lesson lookup that would
 * quietly land the artist on the wrong action step.
 */
export function parseStepNumber(raw: string): number | null {
  if (!/^[1-9][0-9]*$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}

export function absoluteUrl(origin: string, path: string): string {
  return new URL(path, origin).toString();
}
