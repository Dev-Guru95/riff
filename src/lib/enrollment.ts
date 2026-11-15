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

  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { completedAt: true },
  });

  // Completion is a milestone, never retracted. Writing `completedAt: null`
  // here used to undo a track completed by passing its quiz as soon as the
  // lesson count changed or a lesson was reopened.
  await prisma.enrollment.updateMany({
    where: { userId, courseId },
    data: {
      progressPct,
      ...(isComplete && !existing?.completedAt ? { completedAt: new Date() } : {}),
    },
  });

  // On completion, award the track badge and (if this was the final course) the
  // program certificate — all idempotent. Rewards flow back so the UI can toast.
  let rewards: CourseCompletionRewards | null = null;
  if (isComplete && !existing?.completedAt) rewards = await onCourseCompleted(userId, courseId);

  return { progressPct, completed: isComplete, completedLessons: completed, totalLessons: total, rewards };
}

/**
 * Mark a track complete once every quiz in it has been passed.
 *
 * Riff is the testing half of the Skool loop: artists learn on Skool and come
 * here to take the quiz, often via a deep link straight to it, so they never
 * open each lesson in Riff. Completion was keyed off every lesson being marked
 * complete, which meant the program certificate sat at 0/8 for people who had
 * finished and passed every track — exactly what reviewers reported.
 *
 * Idempotent: returns null when there is nothing to do, so no XP, badge or
 * certificate is awarded twice.
 */
export async function completeCourseIfQuizzesPassed(
  userId: string,
  courseId: string,
): Promise<CourseCompletionRewards | null> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { completedAt: true },
  });
  if (!enrollment || enrollment.completedAt) return null;

  const quizzes = await prisma.quiz.findMany({
    where: { lesson: { module: { courseId } } },
    select: { id: true },
  });
  // A track with no quiz can't be completed this way — lesson progress still is.
  if (quizzes.length === 0) return null;

  const passed = await prisma.quizAttempt.findMany({
    where: { userId, passed: true, quizId: { in: quizzes.map((q) => q.id) } },
    select: { quizId: true },
    distinct: ["quizId"],
  });
  if (passed.length < quizzes.length) return null;

  await prisma.enrollment.update({
    where: { userId_courseId: { userId, courseId } },
    data: { completedAt: new Date(), progressPct: 100 },
  });

  return onCourseCompleted(userId, courseId);
}
