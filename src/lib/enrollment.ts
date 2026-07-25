import { prisma } from "./prisma";
import { onCourseCompleted, type CourseCompletionRewards } from "./achievements";

/** Recompute and persist a user's % progress for a course. */
export async function recomputeEnrollmentProgress(userId: string, courseId: string) {
  const lessons = await prisma.lesson.findMany({
    where: { module: { courseId } },
    select: { id: true },
  });
  const total = lessons.length;
  if (total === 0) return { progressPct: 0, completed: false };

  const completed = await prisma.lessonProgress.count({
    where: { userId, status: "completed", lessonId: { in: lessons.map((l) => l.id) } },
  });
  const progressPct = Math.round((completed / total) * 100);
  const isComplete = completed === total;

  await prisma.enrollment.updateMany({
    where: { userId, courseId },
    data: { progressPct, completedAt: isComplete ? new Date() : null },
  });

  // On completion, award the track badge and (if this was the final course) the
  // program certificate — all idempotent. Rewards flow back so the UI can toast.
  let rewards: CourseCompletionRewards | null = null;
  if (isComplete) rewards = await onCourseCompleted(userId, courseId);

  return { progressPct, completed: isComplete, completedLessons: completed, totalLessons: total, rewards };
}
