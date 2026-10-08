import { prisma } from "@/lib/prisma";
import { ok, fail, withRoute } from "@/lib/api";
import { SKOOL_URL } from "@/lib/constants";
import { requireStaff } from "@/lib/mobile/staff";
import { parseJsonArray } from "@/lib/mobile/server";
import type { AdminCourseDetailResponse } from "@/lib/mobile/types";

// GET /api/mobile/admin/courses/[id] — the editor tree from
// src/app/(admin)/admin/courses/[id]/page.tsx. Staff only. Includes quiz
// correct answers and assignment details, because admins edit them.
export const GET = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const gate = await requireStaff();
  if (gate.error) return gate.error;
  const { id } = await params;

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { orderIndex: "asc" },
        include: {
          lessons: {
            orderBy: { orderIndex: "asc" },
            include: {
              quiz: { include: { questions: { orderBy: { orderIndex: "asc" } } } },
              assignment: true,
            },
          },
        },
      },
    },
  });
  if (!course) return fail("Course not found", 404);

  const body: AdminCourseDetailResponse = {
    course: {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
      level: course.level,
      isPublished: course.isPublished,
      orderIndex: course.orderIndex,
      version: course.version,
      returnUrl: course.returnUrl,
      returnLabel: course.returnLabel,
    },
    fallbackReturnUrl: SKOOL_URL,
    modules: course.modules.map((m) => ({
      id: m.id,
      title: m.title,
      orderIndex: m.orderIndex,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        orderIndex: l.orderIndex,
        content: l.content,
        xpReward: l.xpReward,
        estMinutes: l.estMinutes,
        quiz: l.quiz
          ? {
              id: l.quiz.id,
              passThreshold: l.quiz.passThreshold,
              xpReward: l.quiz.xpReward,
              questions: l.quiz.questions.map((q) => ({
                id: q.id,
                type: q.type,
                prompt: q.prompt,
                options: parseJsonArray<{ id: string; text: string }>(q.options),
                correct: parseJsonArray<string>(q.correct).map(String),
                explanation: q.explanation,
                orderIndex: q.orderIndex,
              })),
            }
          : null,
        assignment: l.assignment
          ? {
              id: l.assignment.id,
              title: l.assignment.title,
              instructions: l.assignment.instructions,
              acceptedTypes: parseJsonArray<string>(l.assignment.acceptedTypes).map(String),
              rubric: parseJsonArray(l.assignment.rubric),
              xpReward: l.assignment.xpReward,
              minPassingScore: l.assignment.minPassingScore,
            }
          : null,
      })),
    })),
  };
  return ok(body);
});
