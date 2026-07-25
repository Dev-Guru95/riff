import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, writeAudit } from "@/lib/admin";
import { parseBody, ok, fail, withRoute } from "@/lib/api";

// Set/replace a lesson's assignment, or remove it.
const schema = z.object({
  remove: z.boolean().optional(),
  title: z.string().min(1).optional(),
  instructions: z.string().min(1).optional(),
  xpReward: z.number().int().min(0).max(500).optional(),
  minPassingScore: z.number().int().min(0).max(100).optional(),
});

export const PUT = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin("admin");
  if (error) return error;
  const { id } = await params;
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const lesson = await prisma.lesson.findUnique({ where: { id }, include: { assignment: true } });
  if (!lesson) return fail("Lesson not found", 404);

  if (body.data.remove) {
    if (lesson.assignment) await prisma.assignment.delete({ where: { lessonId: id } });
    await writeAudit(session.id, "assignment.remove", "lesson", id);
    return ok({ assignment: null });
  }

  if (!body.data.title || !body.data.instructions) {
    return fail("Title and instructions are required", 422);
  }

  const assignment = await prisma.assignment.upsert({
    where: { lessonId: id },
    create: {
      lessonId: id,
      title: body.data.title,
      instructions: body.data.instructions,
      xpReward: body.data.xpReward ?? 60,
      minPassingScore: body.data.minPassingScore ?? 60,
      rubric: "[]",
    },
    update: {
      title: body.data.title,
      instructions: body.data.instructions,
      ...(body.data.xpReward != null && { xpReward: body.data.xpReward }),
      ...(body.data.minPassingScore != null && { minPassingScore: body.data.minPassingScore }),
    },
  });

  await writeAudit(session.id, "assignment.update", "lesson", id);
  return ok({ assignmentId: assignment.id });
});
