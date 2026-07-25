"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const letter = (i: number) => String.fromCharCode(97 + i);

function Styles() {
  return (
    <style>{`.ei{width:100%;background:var(--surface-2);border:1px solid var(--border);border-radius:.5rem;padding:.5rem .7rem;font-size:.85rem;color:var(--foreground);outline:none}.ei:focus{border-color:var(--brand)}`}</style>
  );
}

// ---------- Module header: rename + delete ----------
export function ModuleHeader({ id, index, title, lessonCount }: { id: string; index: number; title: string; lessonCount: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(title);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await fetch(`/api/admin/modules/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: name }) });
    setBusy(false);
    setEditing(false);
    router.refresh();
  }
  async function remove() {
    if (!confirm(`Delete this module and its ${lessonCount} lesson(s)? Earned XP will be reversed.`)) return;
    setBusy(true);
    await fetch(`/api/admin/modules/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex gap-2 items-center mb-1">
        <input className="ei" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary py-1.5 px-3 text-xs" onClick={save} disabled={busy || !name}>Save</button>
        <button className="btn btn-ghost py-1.5 px-3 text-xs" onClick={() => { setName(title); setEditing(false); }}>Cancel</button>
        <Styles />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-semibold">Module {index + 1}: {title}</h2>
      <span className="flex gap-2">
        <button className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]" onClick={() => setEditing(true)}>Rename</button>
        <button className="text-xs text-[var(--muted)] hover:text-[var(--brand-2)]" onClick={remove} disabled={busy}>Delete</button>
      </span>
    </div>
  );
}

// ---------- Lesson editor ----------
type QEdit = { prompt: string; options: string[]; correctIdx: number; explanation: string };
type LessonData = {
  id: string;
  title: string;
  content: string;
  xpReward: number;
  estMinutes: number;
  quiz: { passThreshold: number; questions: { prompt: string; options: { id: string; text: string }[]; correct: string[]; explanation: string }[] } | null;
  assignment: { title: string; instructions: string } | null;
};

export function LessonEditor({ index, lesson }: { index: number; lesson: LessonData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [content, setContent] = useState(lesson.content);
  const [xp, setXp] = useState(lesson.xpReward);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Quiz state
  const [passThreshold, setPassThreshold] = useState(lesson.quiz?.passThreshold ?? 80);
  const [questions, setQuestions] = useState<QEdit[]>(
    lesson.quiz?.questions.map((q) => ({
      prompt: q.prompt,
      options: q.options.map((o) => o.text),
      correctIdx: Math.max(0, q.options.findIndex((o) => q.correct.includes(o.id))),
      explanation: q.explanation,
    })) ?? [],
  );

  // Assignment state
  const [hasAssignment, setHasAssignment] = useState(!!lesson.assignment);
  const [aTitle, setATitle] = useState(lesson.assignment?.title ?? "");
  const [aInstr, setAInstr] = useState(lesson.assignment?.instructions ?? "");

  function flash(s: string) { setMsg(s); setTimeout(() => setMsg(null), 2500); }

  async function saveLesson() {
    setBusy(true);
    await fetch(`/api/admin/lessons/${lesson.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, content, xpReward: xp }) });
    setBusy(false); flash("Lesson saved"); router.refresh();
  }

  async function saveQuiz() {
    setBusy(true);
    const payload = {
      passThreshold,
      questions: questions.map((q) => ({
        prompt: q.prompt,
        options: q.options.filter((o) => o.trim()).map((text, i) => ({ id: letter(i), text })),
        correct: [letter(q.correctIdx)],
        explanation: q.explanation,
      })),
    };
    const res = await fetch(`/api/admin/lessons/${lesson.id}/quiz`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    flash(res.ok ? "Quiz saved" : "Quiz save failed"); router.refresh();
  }

  async function saveAssignment() {
    setBusy(true);
    const body = hasAssignment ? { title: aTitle, instructions: aInstr } : { remove: true };
    const res = await fetch(`/api/admin/lessons/${lesson.id}/assignment`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    flash(res.ok ? "Assignment saved" : "Assignment save failed"); router.refresh();
  }

  async function deleteLesson() {
    if (!confirm("Delete this lesson? Earned XP will be reversed.")) return;
    setBusy(true);
    await fetch(`/api/admin/lessons/${lesson.id}`, { method: "DELETE" });
    setBusy(false); router.refresh();
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between text-sm border border-[var(--border)] rounded-lg px-3 py-2">
        <span>{index + 1}. {lesson.title}</span>
        <span className="flex items-center gap-3 text-xs text-[var(--muted)]">
          <span>+{lesson.xpReward} XP</span>
          {lesson.quiz && <span>· Quiz ({lesson.quiz.questions.length}q)</span>}
          {lesson.assignment && <span>· Assignment</span>}
          <button className="text-[var(--accent)] hover:underline" onClick={() => setOpen(true)}>Edit</button>
        </span>
      </div>
    );
  }

  return (
    <div className="border border-[var(--brand)] rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Editing lesson {index + 1}</span>
        <button className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]" onClick={() => setOpen(false)}>Close</button>
      </div>

      {/* Lesson fields */}
      <label className="block"><span className="text-xs text-[var(--muted)] mb-1 block">Title</span><input className="ei" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="block"><span className="text-xs text-[var(--muted)] mb-1 block">Content (supports **bold**)</span><textarea className="ei min-h-32" value={content} onChange={(e) => setContent(e.target.value)} /></label>
      <label className="block w-32"><span className="text-xs text-[var(--muted)] mb-1 block">XP reward</span><input type="number" className="ei" value={xp} onChange={(e) => setXp(Number(e.target.value))} /></label>
      <button className="btn btn-primary py-1.5 px-4 text-xs" onClick={saveLesson} disabled={busy}>Save lesson</button>

      {/* Quiz */}
      <div className="border-t border-[var(--border)] pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Quiz ({questions.length})</span>
          <span className="flex gap-2">
            <button type="button" className="btn btn-ghost text-xs py-1 px-2" onClick={() => setQuestions((q) => [...q, { prompt: "", options: ["", ""], correctIdx: 0, explanation: "" }])}>+ Question</button>
            <button type="button" className="btn btn-primary text-xs py-1 px-2" onClick={saveQuiz} disabled={busy}>Save quiz</button>
          </span>
        </div>
        <label className="text-xs text-[var(--muted)] flex items-center gap-2 mb-2">Pass threshold
          <input type="number" className="ei w-20" value={passThreshold} onChange={(e) => setPassThreshold(Number(e.target.value))} />
        </label>
        {questions.map((q, qi) => (
          <div key={qi} className="bg-[var(--surface-2)] rounded-lg p-3 mb-2 space-y-2">
            <div className="flex gap-2">
              <input className="ei" placeholder="Question prompt" value={q.prompt} onChange={(e) => setQuestions((qs) => qs.map((x, i) => i === qi ? { ...x, prompt: e.target.value } : x))} />
              <button className="text-xs text-[var(--brand-2)]" onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== qi))}>✕</button>
            </div>
            {q.options.map((o, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input type="radio" name={`c-${lesson.id}-${qi}`} checked={q.correctIdx === oi} onChange={() => setQuestions((qs) => qs.map((x, i) => i === qi ? { ...x, correctIdx: oi } : x))} title="Correct answer" />
                <input className="ei" placeholder={`Option ${oi + 1}`} value={o} onChange={(e) => setQuestions((qs) => qs.map((x, i) => i === qi ? { ...x, options: x.options.map((y, yi) => yi === oi ? e.target.value : y) } : x))} />
              </div>
            ))}
            <button className="text-xs text-[var(--accent)]" onClick={() => setQuestions((qs) => qs.map((x, i) => i === qi ? { ...x, options: [...x.options, ""] } : x))}>+ option</button>
            <input className="ei" placeholder="Explanation" value={q.explanation} onChange={(e) => setQuestions((qs) => qs.map((x, i) => i === qi ? { ...x, explanation: e.target.value } : x))} />
          </div>
        ))}
        {questions.length === 0 && <p className="text-xs text-[var(--muted)]">No quiz. Add a question, or saving with none removes the quiz.</p>}
      </div>

      {/* Assignment */}
      <div className="border-t border-[var(--border)] pt-3">
        <label className="flex items-center gap-2 text-sm mb-2">
          <input type="checkbox" checked={hasAssignment} onChange={(e) => setHasAssignment(e.target.checked)} /> Has an AI-reviewed assignment
        </label>
        {hasAssignment && (
          <div className="space-y-2">
            <input className="ei" placeholder="Assignment title" value={aTitle} onChange={(e) => setATitle(e.target.value)} />
            <textarea className="ei min-h-16" placeholder="Instructions" value={aInstr} onChange={(e) => setAInstr(e.target.value)} />
          </div>
        )}
        <button className="btn btn-primary py-1.5 px-4 text-xs mt-2" onClick={saveAssignment} disabled={busy}>Save assignment</button>
      </div>

      <div className="border-t border-[var(--border)] pt-3 flex items-center justify-between">
        {msg && <span className="text-xs text-[var(--success)]">{msg}</span>}
        <button className="btn btn-ghost py-1.5 px-4 text-xs ml-auto text-[var(--brand-2)]" onClick={deleteLesson} disabled={busy}>Delete lesson</button>
      </div>
      <Styles />
    </div>
  );
}
