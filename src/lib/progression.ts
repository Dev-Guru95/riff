import { prisma } from "./prisma";

/**
 * Gated progression. A lesson is unlocked when the previous lesson (by global
 * order across the course) is completed. The first lesson of an enrolled course
 * is always available. Returns an ordered, status-annotated course tree.
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

  let prevCompleted = true; // first lesson available
  const statusByLesson = new Map<string, string>();
  for (const lesson of flat) {
    const stored = progressMap.get(lesson.id);
    let status: string;
    if (stored === "completed") status = "completed";
    else if (prevCompleted) status = stored === "in_progress" ? "in_progress" : "available";
    else status = "locked";
    statusByLesson.set(lesson.id, status);
    prevCompleted = status === "completed";
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

/** Is a specific lesson unlocked for this user? */
export async function isLessonUnlocked(lessonId: string, userId: string): Promise<boolean> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson) return false;
  const tree = await getCourseTree(lesson.module.courseId, userId);
  const all = tree?.modules.flatMap((m) => m.lessons) ?? [];
  const found = all.find((l) => l.id === lessonId);
  return !!found && found.status !== "locked";
}
