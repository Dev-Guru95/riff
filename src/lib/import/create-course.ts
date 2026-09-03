// Turns a validated ParsedCourse into Course → Modules → Lessons (+ Quizzes +
// Assignments) in one atomic create.
//
// Extracted from the admin import route so the route and the bulk track
// importer (prisma/import-tracks.ts) share one implementation. Two copies of
// this logic would drift, and a track imported by script would quietly differ
// from the same track imported through the UI.

import { prisma } from "../prisma";
import type { ParsedCourse } from "./types";

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "course"
  );
}

/**
 * A slug not already taken. Re-importing the same course would otherwise append
 * `-2` and silently break every published link to it, which is why the bulk
 * importer looks the slug up first rather than relying on this.
 */
export async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  let n = 1;
  while (await prisma.course.findUnique({ where: { slug } })) {
    slug = `${base}-${++n}`;
  }
  return slug;
}

export type CreateCourseOptions = {
  slug: string;
  /** Position in the program. Drives track order everywhere it is displayed. */
  orderIndex: number;
  isPublished?: boolean;
};

export async function createCourseFromParsed(course: ParsedCourse, opts: CreateCourseOptions) {
  return prisma.course.create({
    data: {
      slug: opts.slug,
      title: course.title,
      description: course.description || course.title,
      level: course.level,
      isPublished: opts.isPublished ?? false,
      orderIndex: opts.orderIndex,
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
}
