import { prisma } from "./prisma";

/**
 * Ordered, status-annotated course tree.
 *
 * Nothing is locked. Riff holds the assessment, not the teaching: the sequence
 * is taught and enforced in Skool, and every Skool track links straight to its
 * quiz and action steps here. Gating those behind earlier Riff work made a link
 * from Skool track 5 a dead end for anyone who had not already worked through
 * tracks 1-4 in Riff — the learner was sent to do the course in the wrong place.
 *
 * Status is now a record of what the artist has done, not a permission: only
 * `completed` and `in_progress` are ever stored, and everything else reads as
 * `available`.
 */
export async function getCourseTree(courseId: string, userId: string | null) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { orderIndex: "asc" },
        include: {
          lessons: {
            orderBy: { orderIndex: "asc" },
            include: { quiz: { select: { id: true } }, assignment: { select: { id: true } } },
          },
        },
      },
    },
  });
  if (!course) return null;

  // Flatten lessons in global order to compute sequential unlocking.
  const flat = course.modules.flatMap((m) => m.lessons);
  const progressMap = new Map<string, string>();
  if (userId) {
    const progress = await prisma.lessonProgress.findMany({
      where: { userId, lessonId: { in: flat.map((l) => l.id) } },
    });
    progress.forEach((p) => progressMap.set(p.lessonId, p.status));
  }

  const statusByLesson = new Map<string, string>();
  for (const lesson of flat) {
    const stored = progressMap.get(lesson.id);
    statusByLesson.set(
      lesson.id,
      stored === "completed" ? "completed" : stored === "in_progress" ? "in_progress" : "available",
    );
  }

  const completedCount = flat.filter((l) => statusByLesson.get(l.id) === "completed").length;
  const progressPct = flat.length ? Math.round((completedCount / flat.length) * 100) : 0;

  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    progressPct,
    lessonCount: flat.length,
    completedCount,
    modules: course.modules.map((m) => ({
      id: m.id,
      title: m.title,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        estMinutes: l.estMinutes,
        xpReward: l.xpReward,
        hasQuiz: !!l.quiz,
        hasAssignment: !!l.assignment,
        status: statusByLesson.get(l.id)!,
      })),
    })),
  };
}

/**
 * Does this lesson exist and can this artist open it?
 *
 * Always yes for a real lesson. Kept as a named check rather than deleted at the
 * call sites so the rule lives in one place: if per-track access ever needs
 * gating (a paid tier, say), this is the seam to add it to.
 */
export async function isLessonUnlocked(lessonId: string, _userId: string): Promise<boolean> {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true } });
  return !!lesson;
}
