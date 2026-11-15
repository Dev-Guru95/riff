import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isCountryCode, isGenre, MAX_GENRES } from "@/lib/profile-options";
import { parseBody, ok, fail, withRoute } from "@/lib/api";

/**
 * The artist's own profile. Until this existed nothing could write
 * `User.countryCode` or `ArtistProfile.genres`, so the Country and Genre ranks
 * on the dashboard were permanently "—" with no way to fix them.
 */
const schema = z.object({
  stageName: z.string().trim().min(1).max(60).optional(),
  // null clears the country; omitted leaves it alone.
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .refine(isCountryCode, "Unknown country")
    .nullable()
    .optional(),
  genres: z
    .array(z.string().trim().toLowerCase().refine(isGenre, "Unknown genre"))
    .max(MAX_GENRES)
    .optional(),
});

export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { countryCode: true, profile: { select: { stageName: true, genres: true } } },
  });

  return ok({
    stageName: user?.profile?.stageName ?? "",
    countryCode: user?.countryCode ?? null,
    genres: safeParse(user?.profile?.genres),
  });
});

export const PATCH = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  const { stageName, countryCode, genres } = body.data;

  // Duplicates would make the genre list look broken and could rank someone
  // twice; order matters because genres[0] is the ranked genre.
  const cleanGenres = genres ? [...new Set(genres)] : undefined;

  if (countryCode !== undefined) {
    await prisma.user.update({ where: { id: session.id }, data: { countryCode } });
  }

  if (stageName !== undefined || cleanGenres !== undefined) {
    // The profile row may not exist yet, so upsert rather than update.
    await prisma.artistProfile.upsert({
      where: { userId: session.id },
      create: {
        userId: session.id,
        ...(stageName !== undefined ? { stageName } : {}),
        ...(cleanGenres !== undefined ? { genres: JSON.stringify(cleanGenres) } : {}),
      },
      update: {
        ...(stageName !== undefined ? { stageName } : {}),
        ...(cleanGenres !== undefined ? { genres: JSON.stringify(cleanGenres) } : {}),
      },
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { countryCode: true, profile: { select: { stageName: true, genres: true } } },
  });

  return ok({
    stageName: user?.profile?.stageName ?? "",
    countryCode: user?.countryCode ?? null,
    genres: safeParse(user?.profile?.genres),
  });
});

function safeParse(json: string | undefined | null): string[] {
  try {
    const parsed = json ? JSON.parse(json) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
