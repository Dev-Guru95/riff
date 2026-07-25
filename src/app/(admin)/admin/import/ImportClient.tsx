"use client";

// Course Import UI: upload a .docx/.pdf, review/edit the auto-extracted structure
// with live validation, then commit. Talks to:
//   POST /api/admin/import/parse   → ParsedCourse (no DB write)
//   POST /api/admin/import         → creates the course, returns its id/slug

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  validateCourse,
  countEntities,
  type ParsedCourse,
  type ParsedModule,
  type ParsedLesson,
  type ParsedQuestion,
  type QuestionType,
} from "@/lib/import/types";

type Step = "upload" | "preview" | "done";
type ParseMeta = { method: "ai" | "heuristic"; format: string; truncated: boolean; sourceFile: string };
type DoneInfo = { id: string; slug: string; title: string; counts: { modules: number; lessons: number; questions: number; assignments: number } };

export function ImportClient() {
  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [course, setCourse] = useState<ParsedCourse | null>(null);
  const [meta, setMeta] = useState<ParseMeta | null>(null);
  const [done, setDone] = useState<DoneInfo | null>(null);

  function mutate(fn: (c: ParsedCourse) => void) {
    setCourse((prev) => {
      if (!prev) return prev;
      const c = structuredClone(prev);
      fn(c);
      return c;
    });
  }

  async function onUpload(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/import/parse", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Failed to parse the document.");
        return;
      }
      setCourse(data.course as ParsedCourse);
      setMeta({ method: data.method, format: data.format, truncated: data.truncated, sourceFile: data.sourceFile });
      setStep("preview");
    } catch {
      setErr("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    if (!course) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ course, sourceFile: meta?.sourceFile ?? "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(Array.isArray(data.issues) ? data.issues.join(" · ") : data.error ?? "Import failed.");
        return;
      }
      setDone(data as DoneInfo);
      setStep("done");
    } catch {
      setErr("Import failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setCourse(null);
    setMeta(null);
    setDone(null);
    setErr(null);
    setStep("upload");
  }

  return (
    <div className="max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Import Course</h1>
        <p className="text-sm text-[var(--muted)]">
          Upload a Word (.docx) or PDF file. The system extracts the course, modules, lessons, quizzes and
          questions for you to review before saving.
        </p>
      </header>

      <Stepper step={step} />

      {err && (
        <div className="card p-4 border-[var(--brand-2)] text-sm text-[var(--brand-2)]">{err}</div>
      )}

      {step === "upload" && <UploadStep busy={busy} onUpload={onUpload} />}

      {step === "preview" && course && meta && (
        <PreviewStep
          course={course}
          meta={meta}
          busy={busy}
          mutate={mutate}
          onCancel={reset}
          onImport={onImport}
        />
      )}

      {step === "done" && done && <DoneStep done={done} onAnother={reset} />}
    </div>
  );
}

// ---- Steps ----------------------------------------------------------------

function Stepper({ step }: { step: Step }) {
  const steps: [Step, string][] = [
    ["upload", "1 · Upload"],
    ["preview", "2 · Review & edit"],
    ["done", "3 · Done"],
  ];
  const idx = steps.findIndex(([s]) => s === step);
  return (
    <div className="flex gap-2 text-xs">
      {steps.map(([s, label], i) => (
        <span
          key={s}
          className={`px-3 py-1 rounded-full border ${
            i <= idx ? "border-[var(--brand)] text-[var(--brand)]" : "border-[var(--border)] text-[var(--muted)]"
          }`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function UploadStep({ busy, onUpload }: { busy: boolean; onUpload: (f: File) => void }) {
  const [drag, setDrag] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onUpload(f);
      }}
      className={`card p-10 text-center border-2 border-dashed ${drag ? "border-[var(--brand)]" : "border-[var(--border)]"}`}
    >
      <div className="text-4xl mb-3">📄</div>
      <p className="font-semibold mb-1">{busy ? "Reading & extracting…" : "Drop a .docx or .pdf here"}</p>
      <p className="text-xs text-[var(--muted)] mb-5">
        Modules, lessons, quizzes, true/false and short-answer questions are detected automatically.
      </p>
      <label className={`inline-block px-4 py-2 rounded-lg text-sm font-medium cursor-pointer bg-[var(--brand)] text-white ${busy ? "opacity-60 pointer-events-none" : ""}`}>
        {busy ? "Working…" : "Choose file"}
        <input
          type="file"
          accept=".docx,.pdf"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
      </label>
      <p className="text-xs text-[var(--muted)] mt-4">
        Legacy .doc isn&apos;t supported — save it as .docx first. Max 15 MB.
      </p>
    </div>
  );
}

function PreviewStep({
  course,
  meta,
  busy,
  mutate,
  onCancel,
  onImport,
}: {
  course: ParsedCourse;
  meta: ParseMeta;
  busy: boolean;
  mutate: (fn: (c: ParsedCourse) => void) => void;
  onCancel: () => void;
  onImport: () => void;
}) {
  const report = useMemo(() => validateCourse(course), [course]);
  const counts = useMemo(() => countEntities(course), [course]);
  const blocked = report.errors.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge>{meta.method === "ai" ? "🤖 AI-parsed" : "⚙️ Auto-parsed"}</Badge>
        <Badge>{meta.format.toUpperCase()}</Badge>
        <Badge>{meta.sourceFile}</Badge>
        <Badge>
          {counts.modules} modules · {counts.lessons} lessons · {counts.questions} questions · {counts.assignments} assignments
        </Badge>
      </div>

      {meta.truncated && (
        <div className="card p-3 text-xs border-[var(--warning)] text-[var(--warning)]">
          The document was long and was truncated for parsing — check that the tail of the course imported fully.
        </div>
      )}

      <ValidationPanel report={report} />

      {/* Course-level fields */}
      <div className="card p-5 space-y-3">
        <Field label="Course title">
          <input className="admin-input" value={course.title} onChange={(e) => mutate((c) => (c.title = e.target.value))} />
        </Field>
        <Field label="Description">
          <textarea className="admin-input min-h-[60px]" value={course.description} onChange={(e) => mutate((c) => (c.description = e.target.value))} />
        </Field>
        <Field label="Level">
          <select className="admin-input" value={course.level} onChange={(e) => mutate((c) => (c.level = e.target.value as ParsedCourse["level"]))}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </Field>
      </div>

      {/* Modules */}
      {course.modules.map((mod, mi) => (
        <ModuleEditor key={mi} module={mod} mi={mi} total={course.modules.length} mutate={mutate} />
      ))}

      <button
        className="text-sm px-3 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-2)]"
        onClick={() => mutate((c) => c.modules.push({ title: `Module ${c.modules.length + 1}`, lessons: [] }))}
      >
        + Add module
      </button>

      <div className="flex items-center gap-3 pt-2 sticky bottom-0 bg-[var(--bg)] py-3 border-t border-[var(--border)]">
        <button
          disabled={busy || blocked}
          onClick={onImport}
          className={`px-5 py-2 rounded-lg text-sm font-semibold text-white ${blocked || busy ? "bg-[var(--muted)] cursor-not-allowed" : "bg-[var(--brand)]"}`}
          title={blocked ? "Fix the errors above before importing" : undefined}
        >
          {busy ? "Importing…" : "Approve & import"}
        </button>
        <button onClick={onCancel} disabled={busy} className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] hover:bg-[var(--surface-2)]">
          Cancel
        </button>
        {blocked && <span className="text-xs text-[var(--brand-2)]">Resolve {report.errors.length} error(s) to enable import.</span>}
      </div>
    </div>
  );
}

function ModuleEditor({
  module: mod,
  mi,
  total,
  mutate,
}: {
  module: ParsedModule;
  mi: number;
  total: number;
  mutate: (fn: (c: ParsedCourse) => void) => void;
}) {
  return (
    <div className="card p-4 space-y-3 border-l-2 border-l-[var(--brand)]">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--muted)] shrink-0">Module {mi + 1}</span>
        <input className="admin-input" value={mod.title} onChange={(e) => mutate((c) => (c.modules[mi].title = e.target.value))} />
        <MoveDelete
          onUp={mi > 0 ? () => mutate((c) => swap(c.modules, mi, mi - 1)) : undefined}
          onDown={mi < total - 1 ? () => mutate((c) => swap(c.modules, mi, mi + 1)) : undefined}
          onDelete={() => mutate((c) => c.modules.splice(mi, 1))}
        />
      </div>

      <div className="pl-3 space-y-3 border-l border-[var(--border)]">
        {mod.lessons.map((lesson, li) => (
          <LessonEditor key={li} lesson={lesson} mi={mi} li={li} total={mod.lessons.length} mutate={mutate} />
        ))}
        <button
          className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--surface-2)]"
          onClick={() => mutate((c) => c.modules[mi].lessons.push({ title: `Lesson ${mod.lessons.length + 1}`, content: "", estMinutes: 6, questions: [], assignment: null }))}
        >
          + Add lesson
        </button>
      </div>
    </div>
  );
}

function LessonEditor({
  lesson,
  mi,
  li,
  total,
  mutate,
}: {
  lesson: ParsedLesson;
  mi: number;
  li: number;
  total: number;
  mutate: (fn: (c: ParsedCourse) => void) => void;
}) {
  const [open, setOpen] = useState(true);
  const L = (c: ParsedCourse) => c.modules[mi].lessons[li];
  return (
    <div className="rounded-lg border border-[var(--border)] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <button className="text-xs text-[var(--muted)] w-4" onClick={() => setOpen((o) => !o)}>
          {open ? "▾" : "▸"}
        </button>
        <input className="admin-input" value={lesson.title} onChange={(e) => mutate((c) => (L(c).title = e.target.value))} />
        <MoveDelete
          onUp={li > 0 ? () => mutate((c) => swap(c.modules[mi].lessons, li, li - 1)) : undefined}
          onDown={li < total - 1 ? () => mutate((c) => swap(c.modules[mi].lessons, li, li + 1)) : undefined}
          onDelete={() => mutate((c) => c.modules[mi].lessons.splice(li, 1))}
        />
      </div>

      {open && (
        <div className="space-y-3 pl-6">
          <Field label="Lesson content (markdown)">
            <textarea className="admin-input min-h-[70px]" value={lesson.content} onChange={(e) => mutate((c) => (L(c).content = e.target.value))} />
          </Field>

          {/* Questions */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[var(--muted)]">Quiz questions ({lesson.questions.length})</div>
            {lesson.questions.map((q, qi) => (
              <QuestionEditor key={qi} q={q} mi={mi} li={li} qi={qi} mutate={mutate} />
            ))}
            <button
              className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--surface-2)]"
              onClick={() =>
                mutate((c) =>
                  L(c).questions.push({
                    type: "single",
                    prompt: "",
                    options: [
                      { id: "a", text: "" },
                      { id: "b", text: "" },
                    ],
                    correct: [],
                    explanation: "",
                  }),
                )
              }
            >
              + Add question
            </button>
          </div>

          {/* Assignment (short-answer home) */}
          <AssignmentEditor lesson={lesson} mi={mi} li={li} mutate={mutate} />
        </div>
      )}
    </div>
  );
}

function QuestionEditor({
  q,
  mi,
  li,
  qi,
  mutate,
}: {
  q: ParsedQuestion;
  mi: number;
  li: number;
  qi: number;
  mutate: (fn: (c: ParsedCourse) => void) => void;
}) {
  const Q = (c: ParsedCourse) => c.modules[mi].lessons[li].questions[qi];

  function setType(type: QuestionType) {
    mutate((c) => {
      const qq = Q(c);
      qq.type = type;
      if (type === "truefalse") {
        qq.options = [
          { id: "a", text: "True" },
          { id: "b", text: "False" },
        ];
        qq.correct = qq.correct.filter((id) => id === "a" || id === "b").slice(0, 1);
      }
      if (type === "single") qq.correct = qq.correct.slice(0, 1);
    });
  }

  function toggleCorrect(id: string) {
    mutate((c) => {
      const qq = Q(c);
      if (qq.type === "multi") {
        qq.correct = qq.correct.includes(id) ? qq.correct.filter((x) => x !== id) : [...qq.correct, id];
      } else {
        qq.correct = [id];
      }
    });
  }

  return (
    <div className="rounded-md border border-[var(--border)] p-2 space-y-2 bg-[var(--surface-2)]/40">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--muted)] shrink-0">Q{qi + 1}</span>
        <input className="admin-input" placeholder="Question prompt" value={q.prompt} onChange={(e) => mutate((c) => (Q(c).prompt = e.target.value))} />
        <select className="admin-input w-32 shrink-0" value={q.type} onChange={(e) => setType(e.target.value as QuestionType)}>
          <option value="single">Single</option>
          <option value="multi">Multi</option>
          <option value="truefalse">True/False</option>
        </select>
        <button className="text-xs text-[var(--brand-2)] shrink-0" onClick={() => mutate((c) => c.modules[mi].lessons[li].questions.splice(qi, 1))}>
          ✕
        </button>
      </div>

      <div className="space-y-1 pl-6">
        {q.options.map((o, oi) => (
          <div key={o.id} className="flex items-center gap-2">
            <input
              type={q.type === "multi" ? "checkbox" : "radio"}
              checked={q.correct.includes(o.id)}
              onChange={() => toggleCorrect(o.id)}
              title="Mark correct"
            />
            <span className="text-xs text-[var(--muted)] w-4">{o.id}.</span>
            <input
              className="admin-input"
              value={o.text}
              disabled={q.type === "truefalse"}
              onChange={(e) => mutate((c) => (Q(c).options[oi].text = e.target.value))}
            />
            {q.type !== "truefalse" && q.options.length > 2 && (
              <button
                className="text-xs text-[var(--brand-2)]"
                onClick={() =>
                  mutate((c) => {
                    const qq = Q(c);
                    const removed = qq.options[oi].id;
                    qq.options.splice(oi, 1);
                    qq.correct = qq.correct.filter((x) => x !== removed);
                  })
                }
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {q.type !== "truefalse" && (
          <button
            className="text-xs text-[var(--muted)] hover:text-[var(--fg)]"
            onClick={() =>
              mutate((c) => {
                const qq = Q(c);
                qq.options.push({ id: nextOptionId(qq.options), text: "" });
              })
            }
          >
            + option
          </button>
        )}
      </div>
    </div>
  );
}

function AssignmentEditor({
  lesson,
  mi,
  li,
  mutate,
}: {
  lesson: ParsedLesson;
  mi: number;
  li: number;
  mutate: (fn: (c: ParsedCourse) => void) => void;
}) {
  const L = (c: ParsedCourse) => c.modules[mi].lessons[li];
  if (!lesson.assignment) {
    return (
      <button
        className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--surface-2)]"
        onClick={() => mutate((c) => (L(c).assignment = { title: "Short-answer assignment", instructions: "" }))}
      >
        + Add assignment (short answer)
      </button>
    );
  }
  return (
    <div className="rounded-md border border-[var(--accent)] p-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--muted)]">Assignment</span>
        <button className="text-xs text-[var(--brand-2)]" onClick={() => mutate((c) => (L(c).assignment = null))}>
          Remove
        </button>
      </div>
      <input className="admin-input" placeholder="Assignment title" value={lesson.assignment.title} onChange={(e) => mutate((c) => (L(c).assignment!.title = e.target.value))} />
      <textarea
        className="admin-input min-h-[60px]"
        placeholder="Instructions / prompt"
        value={lesson.assignment.instructions}
        onChange={(e) => mutate((c) => (L(c).assignment!.instructions = e.target.value))}
      />
    </div>
  );
}

function ValidationPanel({ report }: { report: { errors: string[]; warnings: string[] } }) {
  if (!report.errors.length && !report.warnings.length) {
    return <div className="card p-3 text-xs border-[var(--success)] text-[var(--success)]">✓ No issues found — ready to import.</div>;
  }
  return (
    <div className="space-y-2">
      {report.errors.length > 0 && (
        <div className="card p-3 border-[var(--brand-2)]">
          <div className="text-xs font-semibold text-[var(--brand-2)] mb-1">Errors ({report.errors.length}) — must fix</div>
          <ul className="text-xs text-[var(--brand-2)] list-disc pl-4 space-y-0.5">
            {report.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {report.warnings.length > 0 && (
        <div className="card p-3 border-[var(--warning)]">
          <div className="text-xs font-semibold text-[var(--warning)] mb-1">Warnings ({report.warnings.length})</div>
          <ul className="text-xs text-[var(--warning)] list-disc pl-4 space-y-0.5">
            {report.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DoneStep({ done, onAnother }: { done: DoneInfo; onAnother: () => void }) {
  return (
    <div className="card p-7 space-y-4 text-center">
      <div className="text-4xl">✅</div>
      <div>
        <h2 className="text-lg font-bold">Imported “{done.title}”</h2>
        <p className="text-sm text-[var(--muted)]">
          {done.counts.modules} modules · {done.counts.lessons} lessons · {done.counts.questions} questions · {done.counts.assignments} assignments.
          Created as a draft — review and publish it from Courses.
        </p>
      </div>
      <div className="flex items-center justify-center gap-3">
        <Link href={`/admin/courses/${done.id}`} className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--brand)] text-white">
          Open course
        </Link>
        <button onClick={onAnother} className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] hover:bg-[var(--surface-2)]">
          Import another
        </button>
      </div>
    </div>
  );
}

// ---- small UI bits --------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-[var(--muted)] mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="px-2 py-1 rounded-full border border-[var(--border)] text-[var(--muted)]">{children}</span>;
}

function MoveDelete({ onUp, onDown, onDelete }: { onUp?: () => void; onDown?: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button disabled={!onUp} onClick={onUp} className="text-xs px-1 disabled:opacity-30" title="Move up">
        ↑
      </button>
      <button disabled={!onDown} onClick={onDown} className="text-xs px-1 disabled:opacity-30" title="Move down">
        ↓
      </button>
      <button onClick={onDelete} className="text-xs px-1 text-[var(--brand-2)]" title="Delete">
        ✕
      </button>
    </div>
  );
}

function swap<T>(arr: T[], a: number, b: number) {
  [arr[a], arr[b]] = [arr[b], arr[a]];
}

function nextOptionId(options: { id: string }[]): string {
  const used = new Set(options.map((o) => o.id));
  for (let i = 0; i < 26; i++) {
    const id = String.fromCharCode(97 + i);
    if (!used.has(id)) return id;
  }
  return `o${options.length}`;
}
