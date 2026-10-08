import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { PROGRAM_KEY } from "@/lib/constants";
import { getCourseTree } from "@/lib/progression";
import { getUserRanks } from "@/lib/leaderboard";
import { getMilestones } from "@/lib/milestones";
import { getDailyGoal, getWeeklyGoals } from "@/lib/goals";
import { getProgramProgress } from "@/lib/certificates";
import { buildShare } from "@/lib/share";
import { badgeAsset } from "@/lib/assets";
import { levelInfo } from "@/lib/mobile/server";
import type { DashboardResponse } from "@/lib/mobile/types";

// GET /api/mobile/dashboard — everything src/app/(app)/dashboard/page.tsx computes.
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  const [level, streak, profile, badges, allBadges, enrollment, ranks] = await Promise.all([
    prisma.userLevel.findUnique({ where: { userId: session.id } }),
    prisma.streak.findUnique({ where: { userId: session.id } }),
    prisma.artistProfile.findUnique({ where: { userId: session.id } }),
    prisma.userBadge.findMany({ where: { userId: session.id }, include: { badge: true } }),
    // Same total ordering as the page, so the badge wall never reshuffles.
    prisma.badge.findMany({ orderBy: [{ orderIndex: "asc" }, { key: "asc" }] }),
    prisma.enrollment.findFirst({
      where: { userId: session.id },
      include: { course: true },
      orderBy: { startedAt: "asc" },
    }),
    getUserRanks(session.id),
  ]);
  const [milestones, dailyGoal, weeklyGoals, program, certificate] = await Promise.all([
    getMilestones(session.id),
    getDailyGoal(session.id),
    getWeeklyGoals(session.id),
    getProgramProgress(session.id),
    prisma.certificate.findUnique({
      where: { userId_programKey: { userId: session.id, programKey: PROGRAM_KEY } },
    }),
  ]);

  const totalXp = level?.totalXp ?? 0;
  const lvl = levelInfo(totalXp);
  const stageName = profile?.stageName ?? null;

  // Next best action: first not-completed lesson in the (oldest) enrolled course.
  let nextLesson: DashboardResponse["nextLesson"] = null;
  let courseProgress = 0;
  if (enrollment) {
    const tree = await getCourseTree(enrollment.courseId, session.id);
    courseProgress = tree?.progressPct ?? 0;
    const flat = tree?.modules.flatMap((m) => m.lessons) ?? [];
    const next = flat.find((l) => l.status === "available" || l.status === "in_progress");
    if (next) nextLesson = { id: next.id, title: next.title, courseTitle: enrollment.course.title };
  }

  const earnedAt = new Map(badges.map((b) => [b.badge.key, b.earnedAt]));

  const body: DashboardResponse = {
    stageName,
    level: lvl,
    streak: { currentLen: streak?.currentLen ?? 0, longestLen: streak?.longestLen ?? 0 },
    badgesEarned: badges.length,
    ranks,
    enrollment: enrollment
      ? { courseId: enrollment.courseId, courseSlug: enrollment.course.slug, courseTitle: enrollment.course.title }
      : null,
    nextLesson,
    courseProgress,
    courseComplete: !!enrollment && !nextLesson,
    dailyGoal,
    weeklyGoals,
    milestones,
    badges: allBadges.map((b) => ({
      key: b.key,
      name: b.name,
      description: b.description,
      icon: b.icon,
      tier: b.tier,
      orderIndex: b.orderIndex,
      earned: earnedAt.has(b.key),
      earnedAt: earnedAt.get(b.key)?.toISOString() ?? null,
      image: badgeAsset(b.key),
    })),
    program,
    certificate: certificate
      ? {
          serial: certificate.serial,
          title: certificate.title,
          programKey: certificate.programKey,
          issuedAt: certificate.issuedAt.toISOString(),
        }
      : null,
    shares: {
      level: buildShare({ kind: "level", value: lvl.levelName, stageName }),
      leaderboard: ranks?.globalRank
        ? buildShare({ kind: "leaderboard", value: ranks.globalRank, stageName, detail: "Climbing the Riff ranks." })
        : null,
    },
  };
  return ok(body);
});
