import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, writeAudit } from "@/lib/admin";
import { rollbackCourseRewards } from "@/lib/gamification";
import { parseBody, ok, fail } from "@/lib/api";

const schema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(3).optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  isPublished: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin("admin");
  if (error) return error;
  const { id } = await params;
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) return fail("Course not found", 404);

  const updated = await prisma.course.update({ where: { id }, data: body.data });
  await writeAudit(session.id, "course.update", "course", id, body.data);
  return ok(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin("admin");
  if (error) return error;
  const { id } = await params;
  // Reverse earned XP first, otherwise the cascade orphans ledger rows (audit H3).
  await rollbackCourseRewards(id);
  await prisma.course.delete({ where: { id } });
  await writeAudit(session.id, "course.delete", "course", id);
  return ok({ success: true });
}
