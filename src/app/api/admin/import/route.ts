// POST the reviewed/edited ParsedCourse → create the Course + Modules + Lessons
// (+ Quizzes + Assignments) atomically, then write an audit-log entry.
import { prisma } from "@/lib/prisma";
import { requireAdmin, writeAudit } from "@/lib/admin";
import { parseBody, ok, fail, tooMany } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { z } from "zod";
import { parsedCourseSchema, validateCourse, countEntities } from "@/lib/import/types";
import { createCourseFromParsed, uniqueSlug } from "@/lib/import/create-course";

export const runtime = "nodejs";

const schema = z.object({
  course: parsedCourseSchema,
  sourceFile: z.string().default(""),
});

export async function POST(req: Request) {
  const { session, error } = await requireAdmin("admin");
  if (error) return error;
  const rl = rateLimit(`import-commit:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  const { course, sourceFile } = body.data;

  // Hard validation — never import a structurally broken course.
  const { errors } = validateCourse(course);
  if (errors.length) return fail("Import blocked — fix these issues first.", 422, { issues: errors });

  const slug = await uniqueSlug(course.title);
  // Appended to the end of the program: a newly imported track is the next one
  // in order until an admin moves it.
  const orderIndex = await prisma.course.count();

  const created = await createCourseFromParsed(course, { slug, orderIndex });

  const counts = countEntities(course);
  await writeAudit(session.id, "course.import", "course", created.id, {
    sourceFile,
    title: created.title,
    ...counts,
  });

  return ok({ id: created.id, slug: created.slug, title: created.title, counts }, 201);
}
