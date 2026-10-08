// Server-side lookups shared by the course-detail and deep-link endpoints. They
// repeat the exact queries in courses/[slug]/quiz/page.tsx and
// courses/[slug]/step/[n]/page.tsx (which redirect and so can't be reused).

import { prisma } from "@/lib/prisma";

/** Enrol on arrival — idempotent, exactly as the track/quiz/step pages do. */
export async function ensureEnrollment(userId: string, courseId: string) {
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId },
    update: {},
  });
}

/** First quiz-bearing lesson in track order (what /courses/<slug>/quiz opens). */
export async function quizLessonId(courseId: string): Promise<string | null> {
  const lesson = await prisma.lesson.findFirst({
    where: { module: { courseId }, quiz: { isNot: null } },
    orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
    select: { id: true },
  });
  return lesson?.id ?? null;
}

/** Lessons carrying an action step, in track order (step n → index n-1). */
export async function stepLessonIds(courseId: string): Promise<string[]> {
  const rows = await prisma.lesson.findMany({
    where: { module: { courseId }, assignment: { isNot: null } },
    orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
