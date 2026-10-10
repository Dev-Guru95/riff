import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, writeAudit } from "@/lib/admin";
import { parseBody, ok, withRoute } from "@/lib/api";

const schema = z.object({
  title: z.string().min(3),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/, "lowercase, numbers, hyphens only"),
  description: z.string().min(3),
  level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
});

export const POST = withRoute(async (req: Request) => {
  const { session, error } = await requireAdmin("admin");
  if (error) return error;
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const count = await prisma.course.count();
  const course = await prisma.course.create({
    data: { ...body.data, orderIndex: count, isPublished: false },
  });
  await writeAudit(session.id, "course.create", "course", course.id, { title: course.title });
  return ok(course, 201);
});
