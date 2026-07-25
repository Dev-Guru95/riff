import { prisma } from "./prisma";
import { awardTrackBadge } from "./gamification";
import { issueProgramCertificate } from "./certificates";

// Single seam for "a course was just completed" side-effects. Keeping badge +
// certificate awarding here (rather than scattered across the enrollment recompute
// and API routes) means new completion rewards get added in one place, mirroring
// how events.ts centralizes per-action rewards.

export type CourseCompletionRewards = {
  /** The track badge, only when newly awarded this completion. */
  trackBadge: { key: string; name: string; icon: string } | null;
  /** The program certificate, only when this completion was the final course. */
  certificate: { serial: string; title: string } | null;
};

const EMPTY: CourseCompletionRewards = { trackBadge: null, certificate: null };

/**
 * Run when a user finishes a course (all lessons complete). Awards that track's
 * completion badge and, if this was the last remaining published course, issues
 * the program certificate. Fully idempotent — safe to call on every enrollment
 * recompute and for courses completed before this feature shipped (see backfill).
 */
export async function onCourseCompleted(userId: string, courseId: string): Promise<CourseCompletionRewards> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { slug: true, title: true },
  });
  if (!course) return EMPTY;

  const trackBadge = await awardTrackBadge(userId, course);
  const certificate = await issueProgramCertificate(userId);
  return { trackBadge, certificate };
}

/**
 * Grant achievements a user already earned but never received — e.g. courses
 * completed before badges/certificates existed. Idempotent. Backfills a single
 * user when `userId` is given, otherwise every user with a completed enrollment.
 * Run from the seed and available as a one-off maintenance call.
 */
export async function backfillAchievements(userId?: string): Promise<number> {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      completedAt: { not: null },
      course: { isPublished: true },
      ...(userId ? { userId } : {}),
    },
    select: { userId: true, courseId: true },
  });
  for (const e of enrollments) {
    await onCourseCompleted(e.userId, e.courseId);
  }
  return enrollments.length;
}
