import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordAchievement } from "@/lib/events";
import { isLessonUnlocked } from "@/lib/progression";
import { recomputeEnrollmentProgress } from "@/lib/enrollment";
import { track } from "@/lib/analytics";
import { ok, fail } from "@/lib/api";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;

  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson) return fail("Lesson not found", 404);

  if (!(await isLessonUnlocked(id, session.id))) {
    return fail("This lesson is locked — complete the previous one first", 403);
  }

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: session.id, lessonId: id } },
    create: { userId: session.id, lessonId: id, status: "completed", completedAt: new Date() },
    update: { status: "completed", completedAt: new Date() },
  });

  // Idempotent XP (refId=lessonId) + streak + share suggestions, via the event layer.
  const { xp, streak, shares } = await recordAchievement({
    userId: session.id,
    xp: lesson.xpReward,
    source: "lesson",
    refId: id,
  });
  const progress = await recomputeEnrollmentProgress(session.id, lesson.module.courseId);
  await track("lesson_complete", session.id, { lessonId: id });

  return ok({ xp, streak, shares, courseProgress: progress });
}
