import { prisma } from "./prisma";

/**
 * Which tracks an artist has finished, and which one they should do next.
 *
 * A track counts as finished when its enrollment is complete, which happens
 * when its quiz is passed — Riff is the testing half of the Skool loop, so the
 * quiz is the completion signal, not lesson views. Same rule as the program
 * certificate, so the two can never disagree.
 *
 * Deliberately advisory, not a lock. The Skool classroom deep-links straight to
 * `/courses/<slug>/quiz` for each track, and hard-gating those links would dead-end
 * students who arrive from Skool in a different order than Riff expects. So the
 * UI shows the recommended order and flags when you are ahead of it, and still
 * lets you through.
 */
export type CourseProgressionEntry = {
  courseId: string;
  /** Position in the published track order, starting at 1. */
  position: number;
  /** The quiz for this track has been passed. */
  completed: boolean;
  /** Every earlier track is completed, so this one is "in order". */
  unlocked: boolean;
  /** Title of the earliest unfinished earlier track, when out of order. */
  blockedBy: string | null;
};

export async function getCourseProgression(userId: string): Promise<Map<string, CourseProgressionEntry>> {
  const courses = await prisma.course.findMany({
    where: { isPublished: true },
    orderBy: [{ orderIndex: "asc" }, { slug: "asc" }],
    select: { id: true, title: true },
  });

  // One definition of "track complete", shared with the program certificate:
  // the enrollment is marked complete, which now happens when the track's quiz
  // is passed (see completeCourseIfQuizzesPassed).
  const completedEnrollments = await prisma.enrollment.findMany({
    where: { userId, completedAt: { not: null } },
    select: { courseId: true },
  });
  const passedCourseIds = new Set(completedEnrollments.map((e) => e.courseId));

  const out = new Map<string, CourseProgressionEntry>();
  // The first unfinished track is what gates everything after it.
  let firstUnfinished: { title: string } | null = null;

  courses.forEach((course, i) => {
    const completed = passedCourseIds.has(course.id);
    out.set(course.id, {
      courseId: course.id,
      position: i + 1,
      completed,
      unlocked: firstUnfinished === null,
      blockedBy: firstUnfinished?.title ?? null,
    });
    if (!completed && firstUnfinished === null) firstUnfinished = { title: course.title };
  });

  return out;
}
