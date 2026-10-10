import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, writeAudit } from "@/lib/admin";
import { parseBody, ok, fail, withRoute } from "@/lib/api";

const schema = z.object({
  title: z.string().min(2),
  content: z.string().min(1),
  estMinutes: z.number().int().min(1).max(120).default(6),
  xpReward: z.number().int().min(0).max(500).default(20),
  quiz: z
    .object({
      passThreshold: z.number().int().min(0).max(100).default(80),
      questions: z
        .array(
          z.object({
            prompt: z.string().min(1),
            options: z.array(z.object({ id: z.string(), text: z.string().min(1) })).min(2),
            correct: z.array(z.string()).min(1),
            explanation: z.string().default(""),
          }),
        )
        .min(1),
    })
    .optional(),
  assignment: z
    .object({
      title: z.string().min(1),
      instructions: z.string().min(1),
      rubric: z.array(z.object({ criterion: z.string(), weight: z.number() })).default([]),
      xpReward: z.number().int().min(0).max(500).default(60),
      minPassingScore: z.number().int().min(0).max(100).default(60),
    })
    .optional(),
});

export const POST = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin("admin");
  if (error) return error;
  const { id } = await params;
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  const d = body.data;

  const mod = await prisma.module.findUnique({ where: { id } });
  if (!mod) return fail("Module not found", 404);

  const count = await prisma.lesson.count({ where: { moduleId: id } });

  const lesson = await prisma.lesson.create({
    data: {
      moduleId: id,
      title: d.title,
      content: d.content,
      estMinutes: d.estMinutes,
      xpReward: d.xpReward,
      orderIndex: count,
      ...(d.quiz && {
        quiz: {
          create: {
            passThreshold: d.quiz.passThreshold,
            questions: {
              create: d.quiz.questions.map((q, i) => ({
                type: q.correct.length > 1 ? "multi" : "single",
                prompt: q.prompt,
                options: JSON.stringify(q.options),
                correct: JSON.stringify(q.correct),
                explanation: q.explanation,
                orderIndex: i,
              })),
            },
          },
        },
      }),
      ...(d.assignment && {
        assignment: {
          create: {
            title: d.assignment.title,
            instructions: d.assignment.instructions,
            rubric: JSON.stringify(d.assignment.rubric),
            xpReward: d.assignment.xpReward,
            minPassingScore: d.assignment.minPassingScore,
          },
        },
      }),
    },
  });

  await writeAudit(session.id, "lesson.create", "lesson", lesson.id, { moduleId: id, withQuiz: !!d.quiz, withAssignment: !!d.assignment });
  return ok(lesson, 201);
});
