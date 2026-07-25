import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isLessonUnlocked } from "@/lib/progression";
import { LessonPlayer } from "./LessonPlayer";

export default async function LearnPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const session = (await getSession())!;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: { include: { course: { select: { slug: true, title: true } } } },
      quiz: { include: { questions: { orderBy: { orderIndex: "asc" } } } },
      assignment: true,
      progress: { where: { userId: session.id } },
    },
  });
  if (!lesson) notFound();

  if (!(await isLessonUnlocked(lessonId, session.id))) {
    redirect(`/courses/${lesson.module.course.slug}`);
  }

  // Mark in-progress on open.
  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: session.id, lessonId } },
    create: { userId: session.id, lessonId, status: "in_progress" },
    update: { status: lesson.progress[0]?.status === "completed" ? "completed" : "in_progress" },
  });

  // Find next lesson in course order for the "continue" CTA.
  const courseLessons = await prisma.lesson.findMany({
    where: { module: { courseId: lesson.module.courseId } },
    include: { module: { select: { orderIndex: true } } },
  });
  const ordered = courseLessons.sort(
    (a, b) => a.module.orderIndex - b.module.orderIndex || a.orderIndex - b.orderIndex,
  );
  const idx = ordered.findIndex((l) => l.id === lessonId);
  const nextLessonId = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1].id : null;

  return (
    <LessonPlayer
      lesson={{
        id: lesson.id,
        title: lesson.title,
        content: lesson.content,
        xpReward: lesson.xpReward,
        courseSlug: lesson.module.course.slug,
        courseTitle: lesson.module.course.title,
        alreadyCompleted: lesson.progress[0]?.status === "completed",
      }}
      quiz={
        lesson.quiz
          ? {
              id: lesson.quiz.id,
              passThreshold: lesson.quiz.passThreshold,
              questions: lesson.quiz.questions.map((q) => ({
                id: q.id,
                prompt: q.prompt,
                options: JSON.parse(q.options),
              })),
            }
          : null
      }
      assignment={
        lesson.assignment
          ? {
              id: lesson.assignment.id,
              title: lesson.assignment.title,
              instructions: lesson.assignment.instructions,
            }
          : null
      }
      nextLessonId={nextLessonId}
    />
  );
}
