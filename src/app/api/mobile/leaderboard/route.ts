import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { computeLeaderboard, type LeaderRow } from "@/lib/leaderboard";
import { buildShare } from "@/lib/share";
import { pageParam } from "@/lib/mobile/server";
import type { LeaderboardResponse, LeaderboardRow } from "@/lib/mobile/types";

const PAGE_SIZE = 50;

// GET /api/mobile/leaderboard?page=N — src/app/(app)/leaderboard/page.tsx.
// The web page only has the global board with ?page= pagination (50/page).
// Country/genre ranks for the current artist are on /api/mobile/dashboard (ranks).
export const GET = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const page = pageParam(new URL(req.url).searchParams.get("page"));

  const all = await computeLeaderboard({ scope: "global" });
  const toRow = (r: LeaderRow): LeaderboardRow => ({
    userId: r.userId,
    rank: r.rank,
    stageName: r.stageName,
    countryCode: r.countryCode,
    genres: r.genres,
    totalXp: r.totalXp,
    avgQuiz: r.avgQuiz,
    avgAssignment: r.avgAssignment,
    streak: r.streak,
    composite: r.composite,
    isMe: r.userId === session.id,
  });
  const meRow = all.find((r) => r.userId === session.id);

  const body: LeaderboardResponse = {
    page,
    pageSize: PAGE_SIZE,
    hasNext: all.length > page * PAGE_SIZE,
    total: all.length,
    rows: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(toRow),
    me: meRow ? toRow(meRow) : null,
    share: meRow
      ? buildShare({
          kind: "leaderboard",
          value: meRow.rank,
          stageName: meRow.stageName,
          detail: "Climbing the Riff ranks.",
        })
      : null,
  };
  return ok(body);
});
