import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { listFinance } from "@/lib/studio-tools";
import { listGoals } from "@/lib/studio-growth";
import { levelInfo } from "@/lib/mobile/server";
import type { StudioDashboardResponse } from "@/lib/mobile/types";

// GET /api/mobile/studio/dashboard — src/app/(app)/studio/dashboard/page.tsx.
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const uid = session.id;

  const [level, streak, finance, goals, fanCount, boardCount, openTasks, badgeCount, gigCount] = await Promise.all([
    prisma.userLevel.findUnique({ where: { userId: uid } }),
    prisma.streak.findUnique({ where: { userId: uid } }),
    listFinance(uid),
    listGoals(uid),
    prisma.fan.count({ where: { userId: uid } }),
    prisma.boardMember.count({ where: { userId: uid } }),
    prisma.card.count({ where: { archived: false, completion: { lt: 100 }, assignees: { some: { userId: uid } } } }),
    prisma.userBadge.count({ where: { userId: uid } }),
    prisma.gig.count({ where: { userId: uid } }),
  ]);
  const active = goals.filter((g) => g.status === "active");

  const body: StudioDashboardResponse = {
    level: levelInfo(level?.totalXp ?? 0),
    streak: { currentLen: streak?.currentLen ?? 0, longestLen: streak?.longestLen ?? 0 },
    badgeCount,
    finance: finance.totals,
    fanCount,
    boardCount,
    openTasks,
    gigCount,
    activeGoals: active.slice(0, 5),
    activeGoalCount: active.length,
  };
  return ok(body);
});
