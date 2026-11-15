import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { countryOptions, GENRES, MAX_GENRES } from "@/lib/profile-options";
import type { ProfileOptionsResponse } from "@/lib/mobile/types";

/**
 * GET /api/mobile/profile — the artist profile form from src/app/(app)/settings.
 *
 * The country and genre lists come with it rather than being copied into the
 * app: they are deliberately fixed (free text would splinter the genre
 * leaderboard into one-person rankings), and country *names* need Intl's region
 * data, which the server always has and a Hermes build may not. Shipping them
 * from here also means adding a genre never needs an app release.
 *
 * Writes go to PATCH /api/profile, the same endpoint the website uses.
 */
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { countryCode: true, profile: { select: { stageName: true, genres: true } } },
  });

  const body: ProfileOptionsResponse = {
    stageName: user?.profile?.stageName ?? "",
    countryCode: user?.countryCode ?? null,
    genres: safeParse(user?.profile?.genres),
    maxGenres: MAX_GENRES,
    countries: countryOptions(),
    genreOptions: GENRES.map((g) => ({ value: g.value, label: g.label })),
  };
  return ok(body);
});

/** `genres` is a JSON array column; a malformed value must not break Settings. */
function safeParse(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
