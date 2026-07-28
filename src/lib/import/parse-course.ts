// Server-only: turn raw document text into a structured ParsedCourse.
//
// Two strategies, matching how the rest of the app degrades:
//   • AI (DeepSeek JSON mode) when DEEPSEEK_API_KEY is set — handles messy/varied
//     formatting, the spec's "AI-assisted parsing" requirement.
//   • Heuristic regex parser otherwise (and as a fallback if the AI call fails) —
//     keeps the feature usable offline for cleanly-formatted documents.
import { deepseekChat, hasDeepseek } from "../deepseek";
import {
  parsedCourseSchema,
  type ParsedCourse,
  type ParsedModule,
  type ParsedLesson,
  type ParsedQuestion,
  type QuestionType,
} from "./types";

const MAX_CHARS = 40_000; // keep the prompt well within context; warn if truncated

export type ParseOutcome = { course: ParsedCourse; method: "ai" | "heuristic"; truncated: boolean };

export async function parseCourse(rawText: string, filename: string): Promise<ParseOutcome> {
  const truncated = rawText.length > MAX_CHARS;
  const text = truncated ? rawText.slice(0, MAX_CHARS) : rawText;

  if (hasDeepseek()) {
    try {
      const course = await aiParse(text, filename);
      // Guard against an empty/degenerate AI result.
      if (course.modules.length) return { course, method: "ai", truncated };
    } catch {
      /* fall through to heuristic */
    }
  }
  return { course: heuristicParse(text, filename), method: "heuristic", truncated };
}

// ---- AI parsing -----------------------------------------------------------

const AI_SYSTEM = `You convert raw course documents into structured JSON for a learning platform.

The platform's content model is: Course → Module → Lesson. A document "Topic" is a Lesson.
Return ONLY a JSON object with this exact shape:
{
  "title": string,
  "description": string,
  "level": "beginner" | "intermediate" | "advanced",
  "objectives": string[],
  "durationText": string,
  "modules": [
    {
      "title": string,
      "lessons": [
        {
          "title": string,
          "content": string,                // lesson body as markdown; "" if none
          "questions": [                     // multiple-choice / true-false only
            {
              "type": "single" | "multi" | "truefalse",
              "prompt": string,
              "options": [{ "id": "a", "text": string }, { "id": "b", "text": string }],
              "correct": ["a"],              // array of option ids (multiple for "multi")
              "explanation": string
            }
          ],
          "assignment": null | { "title": string, "instructions": string }
        }
      ]
    }
  ]
}

Rules:
- Option ids are lowercase letters in order: "a", "b", "c", "d", ...
- For true/false questions use options [{"id":"a","text":"True"},{"id":"b","text":"False"}] and type "truefalse".
- SHORT-ANSWER / free-text questions are NOT quiz questions. Collect them into the lesson's "assignment":
  set a short title and put the question(s) (and any provided model answer) into "instructions". One assignment per lesson.
- Only mark "correct" ids that exist in that question's "options".
- Extract faithfully from the document. Do not invent modules, lessons, or questions that aren't present.
- If the document has no modules, put all lessons under a single module named after the course.
- Respond with JSON only — no commentary.`;

async function aiParse(text: string, filename: string): Promise<ParsedCourse> {
  const out = await deepseekChat({
    system: AI_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Source file: ${filename}\n\nDOCUMENT TEXT:\n<<<\n${text}\n>>>`,
      },
    ],
    maxTokens: 8000,
    json: true,
  });
  const slice = out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1);
  const raw = JSON.parse(slice);
  return normalize(raw, filename);
}

// Coerce loosely-shaped AI output into our strict schema (fill option ids, derive
// question types, drop empties), then validate.
function normalize(raw: unknown, filename: string): ParsedCourse {
  const r = (raw ?? {}) as Record<string, unknown>;
  const modulesRaw = Array.isArray(r.modules) ? r.modules : [];
  const modules: ParsedModule[] = modulesRaw.map((m) => normModule(m as Record<string, unknown>));

  const course = {
    title: str(r.title) || baseName(filename),
    description: str(r.description),
    level: level(r.level),
    objectives: strArr(r.objectives),
    durationText: str(r.durationText ?? r.duration),
    modules,
  };
  return parsedCourseSchema.parse(course);
}

function normModule(m: Record<string, unknown>): ParsedModule {
  const lessonsRaw = Array.isArray(m.lessons) ? m.lessons : Array.isArray(m.topics) ? m.topics : [];
  return {
    title: str(m.title) || "Module",
    lessons: lessonsRaw.map((l) => normLesson(l as Record<string, unknown>)),
  };
}

function normLesson(l: Record<string, unknown>): ParsedLesson {
  const questionsRaw = Array.isArray(l.questions) ? l.questions : [];
  const assignmentRaw = l.assignment as Record<string, unknown> | null | undefined;
  const assignment =
    assignmentRaw && (str(assignmentRaw.title) || str(assignmentRaw.instructions))
      ? { title: str(assignmentRaw.title) || "Short answer", instructions: str(assignmentRaw.instructions) }
      : null;
  return {
    title: str(l.title) || "Lesson",
    content: str(l.content ?? l.body),
    estMinutes: 6,
    questions: questionsRaw.map((q) => normQuestion(q as Record<string, unknown>)).filter((q): q is ParsedQuestion => !!q),
    assignment,
  };
}

function normQuestion(q: Record<string, unknown>): ParsedQuestion | null {
  const prompt = str(q.prompt ?? q.question ?? q.text);
  if (!prompt) return null;

  // Options can arrive as [{id,text}] or as plain strings.
  const rawOpts = Array.isArray(q.options) ? q.options : [];
  const options = rawOpts.map((o, i) => {
    if (o && typeof o === "object") {
      const oo = o as Record<string, unknown>;
      return { id: str(oo.id) || letter(i), text: str(oo.text ?? oo.label ?? oo.value) };
    }
    return { id: letter(i), text: str(o) };
  });

  // Correct can be ids, letters, or full option text.
  const rawCorrect = Array.isArray(q.correct) ? q.correct : q.correct != null ? [q.correct] : [];
  const correct = rawCorrect
    .map((c) => matchOption(str(c), options))
    .filter((id): id is string => !!id);

  let type = (str(q.type).toLowerCase() as QuestionType) || "single";
  const looksTF = options.length === 2 && options.every((o) => /^(true|false)$/i.test(o.text.trim()));
  if (looksTF) type = "truefalse";
  else if (correct.length > 1) type = "multi";
  else if (type !== "multi" && type !== "truefalse") type = "single";

  return { type, prompt, options, correct, explanation: str(q.explanation) };
}

// Map a "correct" token (id / letter / option text) to an existing option id.
function matchOption(token: string, options: { id: string; text: string }[]): string | null {
  const t = token.trim().toLowerCase();
  if (!t) return null;
  const byId = options.find((o) => o.id.toLowerCase() === t);
  if (byId) return byId.id;
  const byText = options.find((o) => o.text.trim().toLowerCase() === t);
  if (byText) return byText.id;
  // bare letter like "B"
  if (/^[a-z]$/.test(t)) {
    const byLetter = options.find((o) => o.id.toLowerCase() === t);
    if (byLetter) return byLetter.id;
  }
  return null;
}

// ---- Heuristic parsing ----------------------------------------------------

const MODULE_RE = /^(?:module|section|chapter|unit)\s*\d*\s*[:.\-)]\s*(.+)$/i;
const LESSON_RE = /^(?:topic|lesson|sub-?topic)\s*\d*\s*[:.\-)]\s*(.+)$/i;
const QUESTION_RE = /^(?:q(?:uestion)?)\s*\d*\s*[:.\-)]\s*(.*)$/i;
const NUM_Q_RE = /^\d+\s*[.)]\s+(.+)$/; // "1. What is ..."
const OPTION_RE = /^([A-Za-z])\s*[.)]\s+(.+)$/; // "A. Foo"
const CORRECT_RE = /^(?:correct\s*answer|answer|ans)\s*[:.\-)]\s*(.+)$/i;
const TF_RE = /^true\s*(?:or|\/)\s*false\s*[:.\-)]?\s*(.*)$/i;

/**
 * Best-effort structural parser for cleanly-formatted documents. Recognizes the
 * patterns in the spec: "Module N:", "Topic N:", "Question N:" with "A. B. C. D.",
 * "Correct Answer: B", "True or False" / "Answer: True", and short-answer
 * "Question:" / "Answer:" blocks (→ assignment).
 */
function heuristicParse(text: string, filename: string): ParsedCourse {
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  const course: ParsedCourse = {
    title: "",
    description: "",
    level: "beginner",
    objectives: [],
    durationText: "",
    modules: [],
  };

  let curModule: ParsedModule | null = null;
  let curLesson: ParsedLesson | null = null;
  let curQuestion: ParsedQuestion | null = null;
  let pendingShortAnswer: { prompt: string } | null = null;
  const contentBuf: string[] = [];

  const flushContent = () => {
    if (curLesson && contentBuf.length) {
      curLesson.content = (curLesson.content ? curLesson.content + "\n\n" : "") + contentBuf.join("\n").trim();
    }
    contentBuf.length = 0;
  };
  const ensureModule = (title: string) => {
    flushContent();
    curQuestion = null;
    curModule = { title, lessons: [] };
    course.modules.push(curModule);
    curLesson = null;
  };
  const ensureLesson = (title: string) => {
    flushContent();
    curQuestion = null;
    if (!curModule) ensureModule(course.title || "Module 1");
    curLesson = { title, content: "", estMinutes: 6, questions: [], assignment: null };
    curModule!.lessons.push(curLesson);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip blank lines WITHOUT ending the current question. Word/.docx text comes
    // through (via mammoth) with a blank line between every paragraph, so a
    // question and its "A./B./C." options are always blank-separated — nulling the
    // question here would orphan the options. A question naturally ends when the
    // next question/heading begins.
    if (!line) continue;

    // Course-level metadata (first occurrences).
    const meta = line.match(/^(course\s*title|title|course)\s*[:.\-)]\s*(.+)$/i);
    if (meta && !course.title && !curModule) {
      course.title = meta[2].trim();
      continue;
    }
    const desc = line.match(/^(course\s*)?description\s*[:.\-)]\s*(.+)$/i);
    if (desc && !course.description) {
      course.description = desc[2].trim();
      continue;
    }
    const dur = line.match(/^(?:course\s*)?duration\s*[:.\-)]\s*(.+)$/i);
    if (dur && !course.durationText) {
      course.durationText = dur[1] ? line.split(/[:.\-)]/).slice(1).join(":").trim() : "";
      course.durationText = line.replace(/^[^:]*[:.\-)]\s*/, "").trim();
      continue;
    }
    const lvl = line.match(/\b(beginner|intermediate|advanced)\b/i);
    if (lvl && /level/i.test(line)) {
      course.level = lvl[1].toLowerCase() as ParsedCourse["level"];
      continue;
    }

    // Module / lesson headings.
    const mod = line.match(MODULE_RE);
    if (mod) {
      ensureModule(mod[1].trim());
      continue;
    }
    const les = line.match(LESSON_RE);
    if (les) {
      ensureLesson(les[1].trim());
      continue;
    }

    // True/False question.
    const tf = line.match(TF_RE);
    if (tf) {
      if (!curLesson) ensureLesson("Lesson 1");
      const prompt = tf[1].trim() || lines[++i]?.trim() || "True or False";
      curQuestion = {
        type: "truefalse",
        prompt,
        options: [
          { id: "a", text: "True" },
          { id: "b", text: "False" },
        ],
        correct: [],
        explanation: "",
      };
      curLesson!.questions.push(curQuestion);
      pendingShortAnswer = null;
      continue;
    }

    // Multiple-choice / numbered question.
    const q = line.match(QUESTION_RE) ?? line.match(NUM_Q_RE);
    if (q && (QUESTION_RE.test(line) || NUM_Q_RE.test(line))) {
      const prompt = (q[1] ?? "").trim() || lines[++i]?.trim() || "Question";
      if (!curLesson) ensureLesson("Lesson 1");
      curQuestion = { type: "single", prompt, options: [], correct: [], explanation: "" };
      curLesson!.questions.push(curQuestion);
      pendingShortAnswer = { prompt }; // may turn into a short-answer assignment
      continue;
    }

    // Option line within a question.
    const opt = line.match(OPTION_RE);
    if (opt && curQuestion && curQuestion.type !== "truefalse") {
      const id = opt[1].toLowerCase();
      curQuestion.options.push({ id, text: opt[2].trim() });
      pendingShortAnswer = null; // it has options → real MCQ, not short-answer
      continue;
    }

    // Correct answer / answer line.
    const corr = line.match(CORRECT_RE);
    if (corr && curQuestion) {
      const ans = corr[1].trim();
      // short-answer: a "Question:" with an "Answer:" and no options → assignment
      if (pendingShortAnswer && curQuestion.options.length === 0) {
        curLesson!.questions = curLesson!.questions.filter((x) => x !== curQuestion);
        const instr = `${pendingShortAnswer.prompt}\n\nModel answer: ${ans}`;
        curLesson!.assignment = mergeAssignment(curLesson!.assignment, instr);
        pendingShortAnswer = null;
        curQuestion = null;
        continue;
      }
      // map answer to an option id (letter or text)
      const id = matchOption(ans, curQuestion.options);
      if (id) curQuestion.correct = [id];
      if (curQuestion.type === "truefalse" && !id) {
        curQuestion.correct = /^t/i.test(ans) ? ["a"] : ["b"];
      }
      continue;
    }

    // Objectives bullet list.
    if (/^objectives?\s*[:.\-)]/i.test(line)) continue;

    // Otherwise: lesson body content (or course description if nothing started yet).
    if (curLesson) {
      contentBuf.push(line);
    } else if (!course.description && course.title) {
      course.description = line;
    }
  }
  flushContent();

  if (!course.title) course.title = baseName(filename);
  if (!course.modules.length) {
    // No headings at all — wrap everything as one module + one lesson of content.
    course.modules.push({
      title: course.title,
      lessons: [{ title: course.title, content: text.trim().slice(0, 4000), estMinutes: 6, questions: [], assignment: null }],
    });
  }
  return parsedCourseSchema.parse(course);
}

function mergeAssignment(existing: ParsedLesson["assignment"], instr: string): ParsedLesson["assignment"] {
  if (existing) return { title: existing.title, instructions: `${existing.instructions}\n\n${instr}` };
  return { title: "Short-answer questions", instructions: instr };
}

// ---- small helpers --------------------------------------------------------

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
}
function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean) : [];
}
function level(v: unknown): ParsedCourse["level"] {
  const s = str(v).toLowerCase();
  return s === "intermediate" || s === "advanced" ? s : "beginner";
}
function letter(i: number): string {
  return String.fromCharCode(97 + (i % 26));
}
function baseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Imported Course";
}
