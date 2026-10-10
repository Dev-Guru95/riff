import { prisma } from "./prisma";
import { resolveLevel, trackBadgeKey, trackBadgeOrder, type XpSource } from "./constants";
import { notify } from "./notifications";

/** Today's date in the user's local frame as YYYY-MM-DD (UTC fallback). */
export function todayKey(tz = "UTC"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export type AwardResult = {
  awarded: number;
  duplicate: boolean;
  totalXp: number;
  level: ReturnType<typeof resolveLevel>;
  leveledUp: boolean;
  newBadges: { key: string; name: string; icon: string }[];
};

/**
 * Award XP idempotently. The unique (userId, source, refId) constraint on the
 * ledger means re-completing the same lesson/quiz never double-pays.
 */
export async function awardXp(
  userId: string,
  delta: number,
  source: XpSource,
  refId?: string,
): Promise<AwardResult> {
  // Ledger insert + total recompute + level cache update happen atomically so
  // concurrent awards can't compute a stale total or a wrong level-up (audit H3).
  const result = await prisma.$transaction(async (tx) => {
    let duplicate = false;
    try {
      await tx.xpLedger.create({ data: { userId, delta, source, refId: refId ?? null } });
    } catch (e: unknown) {
      if (isUniqueViolation(e)) duplicate = true;
      else throw e;
    }

    const agg = await tx.xpLedger.aggregate({ where: { userId }, _sum: { delta: true } });
    const totalXp = agg._sum.delta ?? 0;
    const level = resolveLevel(totalXp);

    const prev = await tx.userLevel.findUnique({ where: { userId } });
    const leveledUp = !!prev && level.levelIndex > prev.levelIndex;

    await tx.userLevel.upsert({
      where: { userId },
      create: { userId, totalXp, levelIndex: level.levelIndex, levelKey: level.levelKey },
      update: { totalXp, levelIndex: level.levelIndex, levelKey: level.levelKey },
    });

    return { duplicate, totalXp, level, leveledUp };
  });

  const newBadges = result.duplicate ? [] : await evaluateBadges(userId);

  // Notify on meaningful moments (level-up + new badges).
  if (result.leveledUp) {
    await notify(userId, { type: "levelup", title: `Level up! You're now ${result.level.levelName}`, body: `${result.totalXp} XP total`, link: "/dashboard" });
  }
  for (const b of newBadges) {
    await notify(userId, { type: "badge", title: `New badge: ${b.name}`, body: `${b.icon} unlocked`, link: "/dashboard" });
  }

  return {
    awarded: result.duplicate ? 0 : delta,
    duplicate: result.duplicate,
    totalXp: result.totalXp,
    level: result.level,
    leveledUp: result.leveledUp,
    newBadges,
  };
}

/** Record a "meaningful action" and update the streak. Returns streak XP bonus. */
export async function touchStreak(userId: string, tz?: string): Promise<{ currentLen: number; awardedBonus: number }> {
  // Resolve the artist's own timezone so streaks roll over at *their* midnight,
  // not UTC (audit H4). Callers no longer need to thread tz through.
  if (!tz) {
    const profile = await prisma.artistProfile.findUnique({ where: { userId }, select: { timezone: true } });
    tz = profile?.timezone || "UTC";
  }
  const today = todayKey(tz);
  const streak = await prisma.streak.upsert({
    where: { userId },
    create: { userId, currentLen: 1, longestLen: 1, lastActivityDate: today },
    update: {},
  });

  // Already counted today.
  if (streak.lastActivityDate === today) {
    return { currentLen: streak.currentLen, awardedBonus: 0 };
  }

  let currentLen = 1;
  if (streak.lastActivityDate) {
    const gap = dayDiff(streak.lastActivityDate, today);
    if (gap === 1) currentLen = streak.currentLen + 1;
    else if (gap > 1 && streak.freezeTokens > 0 && gap === 2) {
      // Spend a freeze token to bridge a single missed day.
      currentLen = streak.currentLen + 1;
      await prisma.streak.update({ where: { userId }, data: { freezeTokens: { decrement: 1 } } });
    } else currentLen = 1;
  }

  const longestLen = Math.max(streak.longestLen, currentLen);
  await prisma.streak.update({
    where: { userId },
    data: { currentLen, longestLen, lastActivityDate: today },
  });

  // Escalating streak bonus, capped to discourage burnout-gaming.
  const bonus = Math.min(50, 10 + currentLen * 2);
  await awardXp(userId, bonus, "streak", today); // refId=date -> one bonus/day
  return { currentLen, awardedBonus: bonus };
}

/** Criteria-driven badge evaluation. Idempotent (UserBadge PK guards dupes). */
export async function evaluateBadges(userId: string) {
  const awarded: { key: string; name: string; icon: string }[] = [];

  const [completedLessons, passedQuizzes, reviewedSubs, streak, missions] = await Promise.all([
    prisma.lessonProgress.count({ where: { userId, status: "completed" } }),
    prisma.quizAttempt.count({ where: { userId, passed: true } }),
    prisma.submission.count({ where: { userId, status: "reviewed" } }),
    prisma.streak.findUnique({ where: { userId } }),
    prisma.userMission.count({ where: { userId, status: "completed" } }),
  ]);

  const checks: { key: string; ok: boolean }[] = [
    { key: "first_steps", ok: completedLessons >= 1 },
    { key: "quiz_whiz", ok: passedQuizzes >= 3 },
    { key: "first_submission", ok: reviewedSubs >= 1 },
    { key: "streak_7", ok: (streak?.longestLen ?? 0) >= 7 },
    { key: "mission_marathon", ok: missions >= 10 },
  ];

  for (const c of checks) {
    if (!c.ok) continue;
    const badge = await prisma.badge.findUnique({ where: { key: c.key } });
    if (!badge) continue;
    const exists = await prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
    });
    if (exists) continue;
    await prisma.userBadge.create({ data: { userId, badgeId: badge.id } });
    awarded.push({ key: badge.key, name: badge.name, icon: badge.icon });
  }
  return awarded;
}

/**
 * Metadata for a course's auto-generated track-completion badge. Pure: derives
 * everything from the course, so an admin creating a new course needs zero extra
 * badge setup — the badge is materialized on first completion (awardTrackBadge).
 */
export function trackBadgeMeta(course: { slug: string; title: string; orderIndex?: number }) {
  return {
    key: trackBadgeKey(course.slug),
    name: `${course.title} Graduate`,
    description: `Complete every lesson in ${course.title}.`,
    icon: "🎖️",
    tier: "gold",
    // Track badges sit in track order on the badge wall, so the achievements
    // read down in the same sequence the learner works through the program.
    orderIndex: trackBadgeOrder(course.orderIndex ?? 0),
  };
}

/**
 * Award a course's track-completion badge. Idempotent on two levels: the Badge
 * row is upserted by its stable key, and the UserBadge PK guards re-awards, so a
 * user who re-triggers course completion (or was completed before this feature)
 * never earns it twice. Returns the badge only when it is *newly* awarded.
 */
export async function awardTrackBadge(
  userId: string,
  course: { slug: string; title: string; orderIndex?: number },
): Promise<{ key: string; name: string; icon: string } | null> {
  const meta = trackBadgeMeta(course);
  const badge = await prisma.badge.upsert({
    where: { key: meta.key },
    create: meta,
    // Keep the label and wall position in step if a course is renamed or
    // reordered; leave icon/tier alone so a designer's later customization
    // isn't clobbered.
    update: { name: meta.name, description: meta.description, orderIndex: meta.orderIndex },
  });
  // Check-first (like evaluateBadges) so re-completing an already-finished course
  // is a silent no-op rather than a caught-but-logged unique-constraint error.
  const exists = await prisma.userBadge.findUnique({
    where: { userId_badgeId: { userId, badgeId: badge.id } },
  });
  if (exists) return null; // already earned
  await prisma.userBadge.create({ data: { userId, badgeId: badge.id } });
  await notify(userId, { type: "badge", title: `New badge: ${badge.name}`, body: `${badge.icon} unlocked`, link: "/dashboard" });
  return { key: badge.key, name: badge.name, icon: badge.icon };
}

/**
 * Reverse XP earned from a course's content before it is deleted, so XP can't be
 * farmed by completing → deleting, and totals stay consistent (audit H3).
 * Must be called BEFORE the cascade delete removes the lessons/quizzes/assignments.
 */
export async function rollbackCourseRewards(courseId: string): Promise<void> {
  const lessons = await prisma.lesson.findMany({
    where: { module: { courseId } },
    select: { id: true, quiz: { select: { id: true } }, assignment: { select: { id: true } } },
  });
  const refIds = lessons.flatMap((l) => [l.id, l.quiz?.id, l.assignment?.id].filter(Boolean) as string[]);
  await rollbackRewardsForRefs(refIds);
}

/** Reverse XP earned from a single lesson's content (lesson + its quiz/assignment). */
export async function rollbackLessonRewards(lessonId: string): Promise<void> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, quiz: { select: { id: true } }, assignment: { select: { id: true } } },
  });
  if (!lesson) return;
  await rollbackRewardsForRefs([lesson.id, lesson.quiz?.id, lesson.assignment?.id].filter(Boolean) as string[]);
}

/** Reverse all XP-ledger entries that reference the given content ids, then
 *  recompute each affected user's cached level. */
async function rollbackRewardsForRefs(refIds: string[]): Promise<void> {
  if (refIds.length === 0) return;
  const affected = await prisma.xpLedger.findMany({
    where: { refId: { in: refIds } },
    select: { userId: true },
    distinct: ["userId"],
  });
  await prisma.xpLedger.deleteMany({ where: { refId: { in: refIds } } });
  for (const { userId } of affected) {
    const agg = await prisma.xpLedger.aggregate({ where: { userId }, _sum: { delta: true } });
    const totalXp = agg._sum.delta ?? 0;
    const level = resolveLevel(totalXp);
    await prisma.userLevel.upsert({
      where: { userId },
      create: { userId, totalXp, levelIndex: level.levelIndex, levelKey: level.levelKey },
      update: { totalXp, levelIndex: level.levelIndex, levelKey: level.levelKey },
    });
  }
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}
