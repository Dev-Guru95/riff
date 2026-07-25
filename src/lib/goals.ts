import { prisma } from "./prisma";

export type Goal = {
  key: string;
  label: string;
  icon: string;
  progress: number;
  target: number;
  pct: number;
  done: boolean;
};

const DAILY_XP_TARGET = 50;
const WEEKLY_XP_TARGET = 500;
const WEEKLY_LESSON_TARGET = 3;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Monday 00:00 of the current week (local). */
function startOfWeek(): Date {
  const d = startOfToday();
  const day = d.getDay() || 7; // Sun=0 -> 7
  d.setDate(d.getDate() - (day - 1));
  return d;
}

function goal(key: string, label: string, icon: string, progress: number, target: number): Goal {
  const clamped = Math.min(progress, target);
  return { key, label, icon, progress: clamped, target, pct: Math.round((clamped / target) * 100), done: progress >= target };
}

/** Today's single daily goal — earn XP. Keeps the streak/return-loop alive. */
export async function getDailyGoal(userId: string): Promise<Goal> {
  const agg = await prisma.xpLedger.aggregate({
    where: { userId, createdAt: { gte: startOfToday() }, delta: { gt: 0 } },
    _sum: { delta: true },
  });
  return goal("daily_xp", "Earn XP today", "⚡", agg._sum.delta ?? 0, DAILY_XP_TARGET);
}

/** This week's goals — lessons + XP. */
export async function getWeeklyGoals(userId: string): Promise<Goal[]> {
  const weekStart = startOfWeek();
  const [xpAgg, lessons] = await Promise.all([
    prisma.xpLedger.aggregate({
      where: { userId, createdAt: { gte: weekStart }, delta: { gt: 0 } },
      _sum: { delta: true },
    }),
    prisma.lessonProgress.count({
      where: { userId, status: "completed", completedAt: { gte: weekStart } },
    }),
  ]);
  return [
    goal("weekly_lessons", "Complete lessons this week", "📘", lessons, WEEKLY_LESSON_TARGET),
    goal("weekly_xp", "Earn XP this week", "🔋", xpAgg._sum.delta ?? 0, WEEKLY_XP_TARGET),
  ];
}
