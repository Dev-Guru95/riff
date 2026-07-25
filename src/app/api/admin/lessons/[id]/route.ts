import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, writeAudit } from "@/lib/admin";
import { rollbackLessonRewards } from "@/lib/gamification";
import { parseBody, ok, fail, withRoute } from "@/lib/api";

const schema = z.object({
  title: z.string().min(2).optional(),
  content: z.string().min(1).optional(),
  estMinutes: z.number().int().min(1).max(120).optional(),
  xpReward: z.number().int().min(0).max(500).optional(),
});

export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin("admin");
  if (error) return error;
  const { id } = await params;
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const lesson = await prisma.lesson.findUnique({ where: { id } });
  if (!lesson) return fail("Lesson not found", 404);

  const updated = await prisma.lesson.update({ where: { id }, data: body.data });
  await writeAudit(session.id, "lesson.update", "lesson", id, body.data);
  return ok(updated);
});

export const DELETE = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin("admin");
  if (error) return error;
  const { id } = await params;
  const lesson = await prisma.lesson.findUnique({ where: { id } });
  if (!lesson) return fail("Lesson not found", 404);

  // Reverse earned XP before the cascade removes the lesson + quiz + assignment.
  await rollbackLessonRewards(id);
  await prisma.lesson.delete({ where: { id } });
  await writeAudit(session.id, "lesson.delete", "lesson", id);
  return ok({ success: true });
});
