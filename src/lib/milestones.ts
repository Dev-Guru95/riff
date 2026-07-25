import { prisma } from "./prisma";

export type Milestone = { key: string; title: string; icon: string; achieved: boolean; progress: number; target: number };

/**
 * Derived milestones — computed from existing data (no extra table). These are
 * coarse-grained career markers, distinct from badges (which are event triggers).
 */
export async function getMilestones(userId: string): Promise<Milestone[]> {
  const [xp, lessons, completedCourses, streak, missions, reviewed] = await Promise.all([
    prisma.userLevel.findUnique({ where: { userId } }),
    prisma.lessonProgress.count({ where: { userId, status: "completed" } }),
    prisma.enrollment.count({ where: { userId, completedAt: { not: null } } }),
    prisma.streak.findUnique({ where: { userId } }),
    prisma.userMission.count({ where: { userId, status: "completed" } }),
    prisma.submission.count({ where: { userId, status: "reviewed" } }),
  ]);
  const totalXp = xp?.totalXp ?? 0;
  const longest = streak?.longestLen ?? 0;

  const m = (key: string, title: string, icon: string, value: number, target: number): Milestone => ({
    key, title, icon, achieved: value >= target, progress: Math.min(value, target), target,
  });

  return [
    m("first_lesson", "Complete your first lesson", "📘", lessons, 1),
    m("xp_500", "Earn 500 XP", "⚡", totalXp, 500),
    m("xp_2000", "Earn 2,000 XP", "🔋", totalXp, 2000),
    m("streak_7", "Hit a 7-day streak", "🔥", longest, 7),
    m("reviewed_5", "Get 5 assignments reviewed", "🎙️", reviewed, 5),
    m("missions_5", "Complete 5 missions", "🎯", missions, 5),
    m("course_1", "Finish a full course", "🎓", completedCourses, 1),
  ];
}
