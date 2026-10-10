// Course Import data model — a dependency-free copy of the types and checks in
// the web repo's src/lib/import/types.ts (ParsedCourse + validateCourse +
// countEntities), so the review screen validates live exactly like the web
// preview does. The server re-runs validateCourse on POST /api/admin/import and
// refuses (422 { issues }) anything with errors. Keep in sync with that file.

export const QUESTION_TYPES = ["single", "multi", "truefalse"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export type ParsedQuestion = {
  type: QuestionType;
  prompt: string;
  options: { id: string; text: string }[];
  correct: string[];
  explanation: string;
};
export type ParsedAssignment = { title: string; instructions: string };
export type ParsedLesson = {
  title: string;
  content: string;
  estMinutes: number;
  questions: ParsedQuestion[];
  assignment: ParsedAssignment | null;
};
export type ParsedModule = { title: string; lessons: ParsedLesson[] };
export type ParsedCourse = {
  title: string;
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  objectives: string[];
  durationText: string;
  modules: ParsedModule[];
};

/** POST /api/admin/import/parse response (src/app/api/admin/import/parse/route.ts). */
export type ParseResponse = {
  course: ParsedCourse;
  method: "ai" | "heuristic";
  format: string;
  truncated: boolean;
  sourceFile: string;
  errors: string[];
  warnings: string[];
};

/** POST /api/admin/import response (src/app/api/admin/import/route.ts). */
export type ImportDone = {
  id: string;
  slug: string;
  title: string;
  counts: { modules: number; lessons: number; questions: number; assignments: number };
};

export type ValidationReport = { errors: string[]; warnings: string[] };

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
        if (q.options.length < 2) errors.push(`${qwhere}: needs at least 2 answer options.`);
        if (!q.correct.length) errors.push(`${qwhere}: no correct answer is marked.`);
        const optionIds = new Set(q.options.map((o) => o.id));
        if (q.correct.some((c) => !optionIds.has(c))) errors.push(`${qwhere}: a correct answer points to a missing option.`);
        if (q.options.some((o) => !o.text.trim())) warnings.push(`${qwhere}: an answer option is blank.`);
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

export function swap<T>(arr: T[], a: number, b: number) {
  const tmp = arr[a]!;
  arr[a] = arr[b]!;
  arr[b] = tmp;
}

export function nextOptionId(options: { id: string }[]): string {
  const used = new Set(options.map((o) => o.id));
  for (let i = 0; i < 26; i++) {
    const id = String.fromCharCode(97 + i);
    if (!used.has(id)) return id;
  }
  return `o${options.length}`;
}

/** Plain-JSON deep copy (the parsed course is plain data). */
export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
