import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { isLessonUnlocked } from "@/lib/progression";
import { resolveReturnLink } from "@/lib/returnLink";
import { getLatestResponse } from "@/lib/artist-context";
import { parseJsonArray } from "@/lib/mobile/server";
import type { LatestSubmission, LessonResponse } from "@/lib/mobile/types";

// GET /api/mobile/lessons/[id] — lesson player data from
// src/app/(app)/learn/[lessonId]/page.tsx.
// SIDE EFFECT (same as opening the page): upserts LessonProgress to
// in_progress (a completed lesson stays completed).
// Quiz questions are sent WITHOUT correct answers, exactly like the page.
export const GET = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id: lessonId } = await params;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: {
        include: { course: { select: { slug: true, title: true, returnUrl: true, returnLabel: true } } },
      },
      quiz: { include: { questions: { orderBy: { orderIndex: "asc" } } } },
      assignment: true,
      progress: { where: { userId: session.id } },
    },
  });
  if (!lesson) return fail("Lesson not found", 404);

  // The page redirects to the course; a native client gets a 403 it can act on.
  if (!(await isLessonUnlocked(lessonId, session.id))) {
    return fail("This lesson is locked — complete the previous one first", 403, {
      locked: true,
      courseSlug: lesson.module.course.slug,
    });
  }

  const alreadyCompleted = lesson.progress[0]?.status === "completed";

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: session.id, lessonId } },
    create: { userId: session.id, lessonId, status: "in_progress" },
    update: { status: alreadyCompleted ? "completed" : "in_progress" },
  });

  // Course order for prev/next, as the page computes it.
  const courseLessons = await prisma.lesson.findMany({
    where: { module: { courseId: lesson.module.courseId } },
    include: { module: { select: { orderIndex: true } } },
  });
  const ordered = courseLessons.sort(
    (a, b) => a.module.orderIndex - b.module.orderIndex || a.orderIndex - b.orderIndex,
  );
  const idx = ordered.findIndex((l) => l.id === lessonId);
  const nextLessonId = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1].id : null;
  const prevLessonId = idx > 0 ? ordered[idx - 1].id : null;

  // Last lesson of the track → hand the learner back to Skool.
  const returnLink = nextLessonId === null ? resolveReturnLink(lesson.module.course) : null;

  // The web player fetches this separately (GET /api/assignments/[id]/submissions)
  // to reopen the action step with the artist's previous answer.
  let latestSubmission: LatestSubmission | null = null;
  if (lesson.assignment) {
    const latest = await getLatestResponse(session.id, lesson.assignment.id);
    if (latest) {
      latestSubmission = {
        id: latest.id,
        textContent: latest.textContent ?? "",
        externalLink: latest.externalLink,
        artifactUrls: parseJsonArray<string>(latest.artifactUrls).map(String),
        status: latest.status,
        aiScore: latest.aiScore,
        submittedAt: latest.createdAt.toISOString(),
        review:
          latest.status === "processing"
            ? null
            : {
                score: latest.aiScore ?? 0,
                strengths: parseJsonArray<string>(latest.strengths).map(String),
                weaknesses: parseJsonArray<string>(latest.weaknesses).map(String),
                recommendations: parseJsonArray<string>(latest.recommendations).map(String),
                nextActions: parseJsonArray<string>(latest.nextActions).map(String),
              },
      };
    }
  }

  const body: LessonResponse = {
    lesson: {
      id: lesson.id,
      title: lesson.title,
      content: lesson.content,
      xpReward: lesson.xpReward,
      estMinutes: lesson.estMinutes,
      courseSlug: lesson.module.course.slug,
      courseTitle: lesson.module.course.title,
      alreadyCompleted,
    },
    quiz: lesson.quiz
      ? {
          id: lesson.quiz.id,
          passThreshold: lesson.quiz.passThreshold,
          questions: lesson.quiz.questions.map((q) => ({
            id: q.id,
            type: q.type,
            prompt: q.prompt,
            options: parseJsonArray<{ id: string; text: string }>(q.options),
          })),
        }
      : null,
    assignment: lesson.assignment
      ? {
          id: lesson.assignment.id,
          title: lesson.assignment.title,
          instructions: lesson.assignment.instructions,
          acceptedTypes: parseJsonArray<string>(lesson.assignment.acceptedTypes).map(String),
        }
      : null,
    prevLessonId,
    nextLessonId,
    returnLink,
    latestSubmission,
  };
  return ok(body);
});
