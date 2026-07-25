// Shared types + zod schema + validation for the Course Import feature.
// Pure (no server-only imports) so both the API routes and the client preview UI
// can import it. The parsed structure maps a document onto the app's content model:
//   Course → Module → Lesson(=Topic)   (the schema has no separate Topic level)
//   Lesson.questions → the lesson's Quiz (multiple-choice / true-false)
//   Lesson.assignment → free-text assignment (where short-answer items land)

import { z } from "zod";

export const QUESTION_TYPES = ["single", "multi", "truefalse"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const parsedQuestionSchema = z.object({
  type: z.enum(QUESTION_TYPES).default("single"),
  prompt: z.string().min(1),
  options: z.array(z.object({ id: z.string(), text: z.string() })).default([]),
  correct: z.array(z.string()).default([]), // option ids
  explanation: z.string().default(""),
});

export const parsedAssignmentSchema = z.object({
  title: z.string().min(1),
  instructions: z.string().min(1),
});

export const parsedLessonSchema = z.object({
  title: z.string().min(1),
  content: z.string().default(""),
  estMinutes: z.number().int().min(1).max(120).default(6),
  questions: z.array(parsedQuestionSchema).default([]),
  assignment: parsedAssignmentSchema.nullable().default(null),
});

export const parsedModuleSchema = z.object({
  title: z.string().min(1),
  lessons: z.array(parsedLessonSchema).default([]),
});

export const parsedCourseSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  objectives: z.array(z.string()).default([]),
  durationText: z.string().default(""),
  modules: z.array(parsedModuleSchema).default([]),
});

export type ParsedQuestion = z.infer<typeof parsedQuestionSchema>;
export type ParsedAssignment = z.infer<typeof parsedAssignmentSchema>;
export type ParsedLesson = z.infer<typeof parsedLessonSchema>;
export type ParsedModule = z.infer<typeof parsedModuleSchema>;
export type ParsedCourse = z.infer<typeof parsedCourseSchema>;

export type ValidationReport = { errors: string[]; warnings: string[] };

/**
 * Validate a parsed/edited course. `errors` block the import (structurally
 * broken); `warnings` are advisory (duplicates, empty sections). Used by both the
 * preview UI (live) and the import route (server-side gate).
 */
export function validateCourse(course: ParsedCourse): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!course.title.trim()) errors.push("Course title is required.");
  if (!course.modules.length) errors.push("No modules were found — add at least one module.");

  const moduleTitles = new Map<string, number>();
  course.modules.forEach((mod, mi) => {
    const where = `Module ${mi + 1}`;
    if (!mod.title.trim()) errors.push(`${where}: title is required.`);
    bump(moduleTitles, norm(mod.title));
    if (!mod.lessons.length) warnings.push(`${where} ("${mod.title}") has no lessons.`);

    const lessonTitles = new Map<string, number>();
    mod.lessons.forEach((lesson, li) => {
      const lwhere = `${where} › Lesson ${li + 1}`;
      if (!lesson.title.trim()) errors.push(`${lwhere}: title is required.`);
      bump(lessonTitles, norm(lesson.title));

      const promptSeen = new Map<string, number>();
      lesson.questions.forEach((q, qi) => {
        const qwhere = `${lwhere} › Q${qi + 1}`;
        if (!q.prompt.trim()) errors.push(`${qwhere}: question text is empty.`);
        bump(promptSeen, norm(q.prompt));
        if (q.options.length < 2) {
          errors.push(`${qwhere}: needs at least 2 answer options.`);
        }
        if (!q.correct.length) {
          errors.push(`${qwhere}: no correct answer is marked.`);
        }
        const optionIds = new Set(q.options.map((o) => o.id));
        if (q.correct.some((c) => !optionIds.has(c))) {
          errors.push(`${qwhere}: a correct answer points to a missing option.`);
        }
        if (q.options.some((o) => !o.text.trim())) {
          warnings.push(`${qwhere}: an answer option is blank.`);
        }
      });
      dupes(promptSeen).forEach((p) => warnings.push(`${lwhere}: duplicate question "${p}".`));

      if (lesson.assignment) {
        if (!lesson.assignment.title.trim() || !lesson.assignment.instructions.trim()) {
          errors.push(`${lwhere}: assignment is missing a title or instructions.`);
        }
      }
      if (!lesson.content.trim() && !lesson.questions.length && !lesson.assignment) {
        warnings.push(`${lwhere} ("${lesson.title}") has no content, quiz, or assignment.`);
      }
    });
    dupes(lessonTitles).forEach((t) => warnings.push(`${where}: duplicate lesson "${t}".`));
  });
  dupes(moduleTitles).forEach((t) => warnings.push(`Duplicate module "${t}".`));

  return { errors, warnings };
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
function bump(m: Map<string, number>, key: string) {
  if (!key) return;
  m.set(key, (m.get(key) ?? 0) + 1);
}
function dupes(m: Map<string, number>): string[] {
  return [...m.entries()].filter(([, n]) => n > 1).map(([k]) => k);
}

/** Tally created-entity counts for the audit log + success screen. */
export function countEntities(course: ParsedCourse) {
  let lessons = 0;
  let questions = 0;
  let assignments = 0;
  for (const m of course.modules) {
    for (const l of m.lessons) {
      lessons++;
      questions += l.questions.length;
      if (l.assignment) assignments++;
    }
  }
  return { modules: course.modules.length, lessons, questions, assignments };
}
