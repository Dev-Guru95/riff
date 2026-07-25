import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, writeAudit } from "@/lib/admin";
import { parseBody, ok, fail, withRoute } from "@/lib/api";

// Replace a lesson's quiz wholesale. Empty `questions` removes the quiz.
const schema = z.object({
  passThreshold: z.number().int().min(0).max(100).default(80),
  questions: z.array(
    z.object({
      prompt: z.string().min(1),
      options: z.array(z.object({ id: z.string(), text: z.string().min(1) })).min(2),
      correct: z.array(z.string()).min(1),
      explanation: z.string().default(""),
    }),
  ),
});

export const PUT = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin("admin");
  if (error) return error;
  const { id } = await params;
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const lesson = await prisma.lesson.findUnique({ where: { id }, include: { quiz: true } });
  if (!lesson) return fail("Lesson not found", 404);

  // No questions -> remove the quiz entirely.
  if (body.data.questions.length === 0) {
    if (lesson.quiz) await prisma.quiz.delete({ where: { lessonId: id } });
    await writeAudit(session.id, "quiz.remove", "lesson", id);
    return ok({ quiz: null });
  }

  // Upsert the quiz, then replace its questions.
  const quiz = await prisma.quiz.upsert({
    where: { lessonId: id },
    create: { lessonId: id, passThreshold: body.data.passThreshold },
    update: { passThreshold: body.data.passThreshold },
  });
  await prisma.quizQuestion.deleteMany({ where: { quizId: quiz.id } });
  await prisma.quizQuestion.createMany({
    data: body.data.questions.map((q, i) => ({
      quizId: quiz.id,
      type: q.correct.length > 1 ? "multi" : "single",
      prompt: q.prompt,
      options: JSON.stringify(q.options),
      correct: JSON.stringify(q.correct),
      explanation: q.explanation,
      orderIndex: i,
    })),
  });

  await writeAudit(session.id, "quiz.update", "lesson", id, { questions: body.data.questions.length });
  return ok({ quizId: quiz.id, questions: body.data.questions.length });
});
