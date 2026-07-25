import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, writeAudit } from "@/lib/admin";
import { rollbackLessonRewards } from "@/lib/gamification";
import { parseBody, ok, fail, withRoute } from "@/lib/api";

const schema = z.object({ title: z.string().min(2) });

export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin("admin");
  if (error) return error;
  const { id } = await params;
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const mod = await prisma.module.findUnique({ where: { id } });
  if (!mod) return fail("Module not found", 404);

  const updated = await prisma.module.update({ where: { id }, data: { title: body.data.title } });
  await writeAudit(session.id, "module.update", "module", id, { title: body.data.title });
  return ok(updated);
});

export const DELETE = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin("admin");
  if (error) return error;
  const { id } = await params;
  const mod = await prisma.module.findUnique({ where: { id }, include: { lessons: { select: { id: true } } } });
  if (!mod) return fail("Module not found", 404);

  // Reverse XP for every lesson in the module before the cascade delete.
  for (const l of mod.lessons) await rollbackLessonRewards(l.id);
  await prisma.module.delete({ where: { id } });
  await writeAudit(session.id, "module.delete", "module", id);
  return ok({ success: true });
});
