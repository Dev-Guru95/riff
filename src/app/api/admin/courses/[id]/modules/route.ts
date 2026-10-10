import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, writeAudit } from "@/lib/admin";
import { parseBody, ok, fail, withRoute } from "@/lib/api";

const schema = z.object({ title: z.string().min(2) });

export const POST = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin("admin");
  if (error) return error;
  const { id } = await params;
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) return fail("Course not found", 404);

  const count = await prisma.module.count({ where: { courseId: id } });
  const mod = await prisma.module.create({
    data: { courseId: id, title: body.data.title, orderIndex: count },
  });
  await writeAudit(session.id, "module.create", "module", mod.id, { courseId: id });
  return ok(mod, 201);
});
