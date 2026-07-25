"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminInput, AdminInputStyles } from "../CourseAdminClient";

export function AddModuleForm({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/admin/courses/${courseId}/modules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
    setLoading(false);
    if (res.ok) { setTitle(""); router.refresh(); }
  }
  return (
    <form onSubmit={submit} className="flex gap-2 items-end card p-4">
      <div className="flex-1"><AdminInput label="New module title" value={title} onChange={setTitle} placeholder="e.g. Release Strategy" /></div>
      <button className="btn btn-ghost" disabled={loading || !title}>+ Add module</button>
    </form>
  );
}

type QField = { prompt: string; options: string[]; correctIdx: number; explanation: string };

export function AddLessonForm({ moduleId }: { moduleId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [xpReward, setXpReward] = useState(20);
  const [questions, setQuestions] = useState<QField[]>([]);
  const [hasAssignment, setHasAssignment] = useState(false);
  const [aTitle, setATitle] = useState("");
  const [aInstr, setAInstr] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function addQuestion() {
    setQuestions((q) => [...q, { prompt: "", options: ["", ""], correctIdx: 0, explanation: "" }]);
  }
  function updateQ(i: number, patch: Partial<QField>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    const quiz =
      questions.length > 0
        ? {
            passThreshold: 80,
            questions: questions.map((q) => {
              const opts = q.options.filter((o) => o.trim()).map((text, idx) => ({ id: String.fromCharCode(97 + idx), text }));
              return {
                prompt: q.prompt,
                options: opts,
                correct: [String.fromCharCode(97 + q.correctIdx)],
                explanation: q.explanation,
              };
            }),
          }
        : undefined;

    const assignment = hasAssignment ? { title: aTitle, instructions: aInstr, rubric: [] } : undefined;

    const res = await fetch(`/api/admin/modules/${moduleId}/lessons`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, content, xpReward, quiz, assignment }),
    });
    setLoading(false);
    if (res.ok) {
      setTitle(""); setContent(""); setQuestions([]); setHasAssignment(false); setATitle(""); setAInstr(""); setOpen(false);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? "Failed to create lesson");
    }
  }

  if (!open) return <button className="btn btn-ghost text-xs" onClick={() => setOpen(true)}>+ Add lesson</button>;

  return (
    <form onSubmit={submit} className="border border-[var(--border)] rounded-xl p-4 space-y-3 mt-2">
      <AdminInput label="Lesson title" value={title} onChange={setTitle} />
      <label className="block">
        <span className="text-xs text-[var(--muted)] mb-1 block">Content (supports **bold**)</span>
        <textarea className="admin-input min-h-24" value={content} onChange={(e) => setContent(e.target.value)} />
      </label>
      <label className="block w-32">
        <span className="text-xs text-[var(--muted)] mb-1 block">XP reward</span>
        <input type="number" className="admin-input" value={xpReward} onChange={(e) => setXpReward(Number(e.target.value))} />
      </label>

      {/* Quiz builder */}
      <div className="border-t border-[var(--border)] pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Quiz ({questions.length})</span>
          <button type="button" className="btn btn-ghost text-xs py-1 px-2" onClick={addQuestion}>+ Question</button>
        </div>
        {questions.map((q, i) => (
          <div key={i} className="bg-[var(--surface-2)] rounded-lg p-3 mb-2 space-y-2">
            <input className="admin-input" placeholder="Question prompt" value={q.prompt} onChange={(e) => updateQ(i, { prompt: e.target.value })} />
            {q.options.map((o, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input type="radio" name={`correct-${i}`} checked={q.correctIdx === oi} onChange={() => updateQ(i, { correctIdx: oi })} title="Mark correct" />
                <input className="admin-input" placeholder={`Option ${oi + 1}`} value={o} onChange={(e) => updateQ(i, { options: q.options.map((x, xi) => (xi === oi ? e.target.value : x)) })} />
              </div>
            ))}
            <button type="button" className="text-xs text-[var(--accent)]" onClick={() => updateQ(i, { options: [...q.options, ""] })}>+ option</button>
            <input className="admin-input" placeholder="Explanation (shown after answering)" value={q.explanation} onChange={(e) => updateQ(i, { explanation: e.target.value })} />
          </div>
        ))}
      </div>

      {/* Assignment */}
      <div className="border-t border-[var(--border)] pt-3">
        <label className="flex items-center gap-2 text-sm mb-2">
          <input type="checkbox" checked={hasAssignment} onChange={(e) => setHasAssignment(e.target.checked)} />
          Add an AI-reviewed assignment
        </label>
        {hasAssignment && (
          <div className="space-y-2">
            <AdminInput label="Assignment title" value={aTitle} onChange={setATitle} />
            <label className="block">
              <span className="text-xs text-[var(--muted)] mb-1 block">Instructions</span>
              <textarea className="admin-input min-h-16" value={aInstr} onChange={(e) => setAInstr(e.target.value)} />
            </label>
          </div>
        )}
      </div>

      {err && <p className="text-sm text-[var(--brand-2)]">{err}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={loading || !title || !content}>{loading ? "Saving…" : "Create lesson"}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <AdminInputStyles />
    </form>
  );
}
