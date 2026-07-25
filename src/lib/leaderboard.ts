import { prisma } from "./prisma";

/**
 * Composite leaderboard score. In production the per-user component scores are
 * cached in Redis sorted sets (ZADD on each scoring event) with cohort
 * percentile normalization refreshed periodically. Here we compute on demand
 * from Postgres/SQLite — same formula, fewer moving parts for the foundation.
 *
 * composite = 0.40*xp + 0.20*quiz + 0.20*assignment + 0.10*speed + 0.10*consistency
 */
const WEIGHTS = { xp: 0.4, quiz: 0.2, assignment: 0.2, speed: 0.1, consistency: 0.1 };

export type LeaderRow = {
  userId: string;
  stageName: string;
  countryCode: string | null;
  genres: string[];
  totalXp: number;
  avgQuiz: number;
  avgAssignment: number;
  streak: number;
  composite: number;
  rank: number;
};

function norm(value: number, max: number) {
  return max <= 0 ? 0 : Math.min(1, value / max);
}

// Short-TTL in-memory cache. The full-scan compute is expensive (audit C1); on a
// single node this avoids recomputing 3× per dashboard load. Production: Redis ZSET.
const CACHE_TTL_MS = 15_000;
let cache: { at: number; rows: LeaderRow[] } | null = null;

async function computeGlobal(): Promise<LeaderRow[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.rows;
  const rows = await computeLeaderboardUncached();
  cache = { at: Date.now(), rows };
  return rows;
}

export async function computeLeaderboard(opts?: {
  scope?: "global" | "country" | "genre";
  value?: string;
}): Promise<LeaderRow[]> {
  // Compute the global board once (cached), then derive scoped views by filtering
  // and re-ranking — avoids 3 full table scans per request.
  const global = await computeGlobal();
  if (!opts || opts.scope === "global" || !opts.value) return global;
  let filtered = global;
  if (opts.scope === "country") filtered = global.filter((r) => r.countryCode === opts.value);
  else if (opts.scope === "genre") filtered = global.filter((r) => r.genres.includes(opts.value!));
  return filtered.map((r, i) => ({ ...r, rank: i + 1 }));
}

async function computeLeaderboardUncached(): Promise<LeaderRow[]> {
  const users = await prisma.user.findMany({
    where: { role: "artist", status: "active" },
    include: {
      profile: true,
      level: true,
      streak: true,
      quizAttempts: { where: { passed: true }, select: { score: true } },
      submissions: { where: { status: "reviewed" }, select: { aiScore: true } },
      lessonProgress: { where: { status: "completed" }, select: { id: true } },
    },
  });

  const raw = users.map((u) => {
    const totalXp = u.level?.totalXp ?? 0;
    const avgQuiz = avg(u.quizAttempts.map((q) => q.score));
    const avgAssignment = avg(u.submissions.map((s) => s.aiScore ?? 0));
    const streak = u.streak?.longestLen ?? 0;
    const completedLessons = u.lessonProgress.length;
    return {
      userId: u.id,
      stageName: u.profile?.stageName ?? u.email.split("@")[0],
      countryCode: u.countryCode,
      genres: safeArr(u.profile?.genres),
      totalXp,
      avgQuiz,
      avgAssignment,
      streak,
      completedLessons,
    };
  });

  // Cohort maxima for min-max normalization.
  const maxXp = Math.max(1, ...raw.map((r) => r.totalXp));
  const maxSpeed = Math.max(1, ...raw.map((r) => r.completedLessons));
  const maxStreak = Math.max(1, ...raw.map((r) => r.streak));

  const rows: Omit<LeaderRow, "rank">[] = raw.map((r) => ({
    userId: r.userId,
    stageName: r.stageName,
    countryCode: r.countryCode,
    genres: r.genres,
    totalXp: r.totalXp,
    avgQuiz: r.avgQuiz,
    avgAssignment: r.avgAssignment,
    streak: r.streak,
    composite:
      WEIGHTS.xp * norm(r.totalXp, maxXp) +
      WEIGHTS.quiz * (r.avgQuiz / 100) +
      WEIGHTS.assignment * (r.avgAssignment / 100) +
      WEIGHTS.speed * norm(r.completedLessons, maxSpeed) +
      WEIGHTS.consistency * norm(r.streak, maxStreak),
  }));

  // Deterministic ranking: composite desc, then XP, then userId as a stable
  // tiebreaker so equal scores never produce nondeterministic order (audit gap).
  rows.sort((a, b) => b.composite - a.composite || b.totalXp - a.totalXp || a.userId.localeCompare(b.userId));
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

export async function getUserRanks(userId: string) {
  const global = await computeLeaderboard({ scope: "global" });
  const me = global.find((r) => r.userId === userId);
  if (!me) return null;
  const country = me.countryCode
    ? await computeLeaderboard({ scope: "country", value: me.countryCode })
    : [];
  const genre = me.genres[0]
    ? await computeLeaderboard({ scope: "genre", value: me.genres[0] })
    : [];
  return {
    globalRank: me.rank,
    countryRank: country.find((r) => r.userId === userId)?.rank ?? null,
    genreRank: genre.find((r) => r.userId === userId)?.rank ?? null,
    composite: me.composite,
  };
}

function avg(nums: number[]) {
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
}
function safeArr(s?: string | null): string[] {
  try {
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}
