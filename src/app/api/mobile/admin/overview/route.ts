import { prisma } from "@/lib/prisma";
import { ok, withRoute } from "@/lib/api";
import { getKpis, getSignupsBySource } from "@/lib/analytics";
import { requireStaff } from "@/lib/mobile/staff";
import type { AdminOverviewResponse } from "@/lib/mobile/types";

const pct = (value: number, max: number) => (max ? Math.round((value / max) * 100) : 0);

// GET /api/mobile/admin/overview — src/app/(admin)/admin/page.tsx. Staff only.
export const GET = withRoute(async () => {
  const gate = await requireStaff();
  if (gate.error) return gate.error;

  const kpis = await getKpis(30);
  const signupSources = await getSignupsBySource();
  const [users, courses, lessons, submissions, flagged, attempts, completedEnroll, totalEnroll, pendingContent] =
    await Promise.all([
      prisma.user.count({ where: { role: "artist" } }),
      prisma.course.count(),
      prisma.lesson.count(),
      prisma.submission.count(),
      prisma.submission.count({ where: { status: "flagged" } }),
      prisma.quizAttempt.count(),
      prisma.enrollment.count({ where: { completedAt: { not: null } } }),
      prisma.enrollment.count(),
      prisma.contentSuggestion.count({ where: { status: "pending" } }),
    ]);

  const enrolledUsers = await prisma.enrollment.findMany({ select: { userId: true }, distinct: ["userId"] });
  const usersWithProgress = await prisma.lessonProgress.findMany({
    where: { status: "completed" },
    select: { userId: true },
    distinct: ["userId"],
  });

  const body: AdminOverviewResponse = {
    counts: {
      artists: users,
      courses,
      lessons,
      submissions,
      flaggedSubmissions: flagged,
      quizAttempts: attempts,
      completedEnrollments: completedEnroll,
      totalEnrollments: totalEnroll,
      pendingContent,
    },
    completionRate: totalEnroll ? Math.round((completedEnroll / totalEnroll) * 100) : 0,
    activationRate: users ? Math.round((usersWithProgress.length / users) * 100) : 0,
    kpis,
    funnel: [
      { label: "Signed up", value: users, pct: pct(users, users) },
      { label: "Enrolled", value: enrolledUsers.length, pct: pct(enrolledUsers.length, users) },
      { label: "Activated (≥1 lesson)", value: usersWithProgress.length, pct: pct(usersWithProgress.length, users) },
      { label: "Completed a course", value: completedEnroll, pct: pct(completedEnroll, users) },
    ],
    signupSources,
  };
  return ok(body);
});
