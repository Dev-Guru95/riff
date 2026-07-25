// POST the reviewed/edited ParsedCourse → create the Course + Modules + Lessons
// (+ Quizzes + Assignments) atomically, then write an audit-log entry.
import { prisma } from "@/lib/prisma";
import { requireAdmin, writeAudit } from "@/lib/admin";
import { parseBody, ok, fail, tooMany } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { z } from "zod";
import { parsedCourseSchema, validateCourse, countEntities } from "@/lib/import/types";

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
  const orderIndex = await prisma.course.count();

  const created = await prisma.course.create({
    data: {
      slug,
      title: course.title,
      description: course.description || course.title,
      level: course.level,
      isPublished: false,
      orderIndex,
      modules: {
        create: course.modules.map((m, mi) => ({
          title: m.title,
          orderIndex: mi,
          lessons: {
            create: m.lessons.map((l, li) => {
              // Keep only structurally valid quiz questions (≥2 options, ≥1 valid correct id).
              const validQs = l.questions.filter((q) => {
                const ids = new Set(q.options.map((o) => o.id));
                return q.options.length >= 2 && q.correct.length >= 1 && q.correct.every((c) => ids.has(c));
              });
              return {
                title: l.title,
                content: l.content,
                estMinutes: l.estMinutes,
                orderIndex: li,
                ...(validQs.length && {
                  quiz: {
                    create: {
                      questions: {
                        create: validQs.map((q, qi) => ({
                          type: q.type === "truefalse" ? "truefalse" : q.correct.length > 1 ? "multi" : "single",
                          prompt: q.prompt,
                          options: JSON.stringify(q.options),
                          correct: JSON.stringify(q.correct),
                          explanation: q.explanation,
                          orderIndex: qi,
                        })),
                      },
                    },
                  },
                }),
                ...(l.assignment && {
                  assignment: {
                    create: {
                      title: l.assignment.title,
                      instructions: l.assignment.instructions,
                      rubric: JSON.stringify([]),
                    },
                  },
                }),
              };
            }),
          },
        })),
      },
    },
  });

  const counts = countEntities(course);
  await writeAudit(session.id, "course.import", "course", created.id, {
    sourceFile,
    title: created.title,
    ...counts,
  });

  return ok({ id: created.id, slug: created.slug, title: created.title, counts }, 201);
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "course"
  );
}

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  let n = 1;
  while (await prisma.course.findUnique({ where: { slug } })) {
    slug = `${base}-${++n}`;
  }
  return slug;
}
