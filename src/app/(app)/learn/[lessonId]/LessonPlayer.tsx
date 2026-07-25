"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Quiz = {
  id: string;
  passThreshold: number;
  questions: { id: string; prompt: string; options: { id: string; text: string }[] }[];
};
type Assignment = { id: string; title: string; instructions: string };
type Lesson = {
  id: string;
  title: string;
  content: string;
  xpReward: number;
  courseSlug: string;
  courseTitle: string;
  alreadyCompleted: boolean;
};

type Step = "read" | "quiz" | "assignment" | "done";

export function LessonPlayer({
  lesson,
  quiz,
  assignment,
  nextLessonId,
}: {
  lesson: Lesson;
  quiz: Quiz | null;
  assignment: Assignment | null;
  nextLessonId: string | null;
}) {
  const [step, setStep] = useState<Step>("read");
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link href={`/courses/${lesson.courseSlug}`} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
        ← {lesson.courseTitle}
      </Link>

      <Stepper step={step} hasQuiz={!!quiz} hasAssignment={!!assignment} />

      {step === "read" && (
        <ReadStep
          lesson={lesson}
          onComplete={(msg) => {
            flash(msg);
            setStep(quiz ? "quiz" : assignment ? "assignment" : "done");
          }}
        />
      )}

      {step === "quiz" && quiz && (
        <QuizStep
          quiz={quiz}
          onPass={(msg) => {
            flash(msg);
            setStep(assignment ? "assignment" : "done");
          }}
        />
      )}

      {step === "assignment" && assignment && (
        <AssignmentStep assignment={assignment} onDone={(msg) => { flash(msg); setStep("done"); }} />
      )}

      {step === "done" && <DoneStep nextLessonId={nextLessonId} courseSlug={lesson.courseSlug} />}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 card px-5 py-3 animate-pop border-[var(--brand)] z-30">
          <span className="font-semibold">{toast}</span>
        </div>
      )}
    </main>
  );
}

function Stepper({ step, hasQuiz, hasAssignment }: { step: Step; hasQuiz: boolean; hasAssignment: boolean }) {
  const steps: { key: Step; label: string }[] = [{ key: "read", label: "Lesson" }];
  if (hasQuiz) steps.push({ key: "quiz", label: "Quiz" });
  if (hasAssignment) steps.push({ key: "assignment", label: "Assignment" });
  steps.push({ key: "done", label: "Done" });
  const order: Step[] = ["read", "quiz", "assignment", "done"];
  const curIdx = order.indexOf(step);
  return (
    <div className="flex items-center gap-2 my-5">
      {steps.map((s) => {
        const active = order.indexOf(s.key) <= curIdx;
        return (
          <div key={s.key} className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full ${active ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ReadStep({ lesson, onComplete }: { lesson: Lesson; onComplete: (msg: string) => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function complete() {
    setLoading(true);
    const res = await fetch(`/api/lessons/${lesson.id}/complete`, { method: "POST" });
    const data = await res.json();
    router.refresh();
    if (res.ok) {
      onComplete(celebrate(data) || "Lesson complete");
    } else {
      onComplete(data.error ?? "Error");
      setLoading(false);
    }
  }

  return (
    <article className="card p-7">
      <h1 className="text-2xl font-bold mb-4">{lesson.title}</h1>
      <div className="prose-invert text-[var(--foreground)] leading-relaxed space-y-3">
        {lesson.content.split("\n").filter(Boolean).map((p, i) => (
          <p key={i}>{renderBold(p)}</p>
        ))}
      </div>
      <button className="btn btn-primary mt-6 w-full py-3" onClick={complete} disabled={loading}>
        {loading ? "Saving…" : lesson.alreadyCompleted ? "Continue" : `Complete lesson · +${lesson.xpReward} XP`}
      </button>
    </article>
  );
}

function QuizStep({ quiz, onPass }: { quiz: Quiz; onPass: (msg: string) => void }) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<null | {
    score: number;
    passed: boolean;
    perQuestion: { questionId: string; isCorrect: boolean; explanation: string }[];
    xp?: { awarded: number } | null;
    streak?: { currentLen: number } | null;
  }>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    const res = await fetch(`/api/quizzes/${quiz.id}/attempts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
    if (data.passed) {
      const xp = data.xp?.awarded ?? 0;
      setTimeout(() => onPass(xp > 0 ? `Passed! +${xp} XP` : "Quiz passed"), 1200);
    }
  }

  const allAnswered = quiz.questions.every((q) => (answers[q.id]?.length ?? 0) > 0);

  return (
    <div className="card p-7 space-y-6">
      <h2 className="text-xl font-bold">Quick quiz</h2>
      <p className="text-sm text-[var(--muted)]">Score {quiz.passThreshold}%+ to pass and earn XP.</p>
      {quiz.questions.map((q, qi) => {
        const verdict = result?.perQuestion.find((p) => p.questionId === q.id);
        return (
          <div key={q.id}>
            <div className="font-medium mb-2">{qi + 1}. {q.prompt}</div>
            <div className="space-y-2">
              {q.options.map((o) => {
                const selected = answers[q.id]?.includes(o.id);
                return (
                  <button
                    key={o.id}
                    disabled={!!result}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: [o.id] }))}
                    className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition ${
                      selected ? "border-[var(--brand)] bg-[var(--surface-2)]" : "border-[var(--border)] hover:border-[var(--muted)]"
                    }`}
                  >
                    {o.text}
                  </button>
                );
              })}
            </div>
            {verdict && (
              <p className={`text-xs mt-2 ${verdict.isCorrect ? "text-[var(--success)]" : "text-[var(--brand-2)]"}`}>
                {verdict.isCorrect ? "✓ Correct. " : "✗ Not quite. "}{verdict.explanation}
              </p>
            )}
          </div>
        );
      })}

      {!result && (
        <button className="btn btn-primary w-full py-3" onClick={submit} disabled={!allAnswered || loading}>
          {loading ? "Checking…" : "Submit answers"}
        </button>
      )}
      {result && !result.passed && (
        <div className="text-center">
          <p className="text-[var(--brand-2)] font-medium mb-3">Scored {result.score}%. Need {quiz.passThreshold}%. Review and retry.</p>
          <button className="btn btn-ghost" onClick={() => { setResult(null); setAnswers({}); }}>Try again</button>
        </div>
      )}
      {result?.passed && <p className="text-center text-[var(--success)] font-semibold animate-pop">🎉 Passed with {result.score}%!</p>}
    </div>
  );
}

function AssignmentStep({ assignment, onDone }: { assignment: Assignment; onDone: (msg: string) => void }) {
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [uploads, setUploads] = useState<{ url: string; category: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<null | {
    review: { score: number; strengths: string[]; weaknesses: string[]; recommendations: string[]; nextActions: string[] };
    passed: boolean;
    flaggedForHumanReview: boolean;
    xp?: { awarded: number } | null;
  }>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (res.ok) setUploads((u) => [...u, { url: data.url, category: data.category }]);
    else setError(data.error ?? "Upload failed");
    e.target.value = "";
  }

  async function submit() {
    setError(null);
    setLoading(true);
    const artifactType = uploads[0]?.category ?? (link ? "link" : "text");
    const body: Record<string, unknown> = { artifactType };
    if (text) body.textContent = text;
    if (link) body.externalLink = link;
    if (uploads.length) body.artifactUrls = uploads.map((u) => new URL(u.url, window.location.origin).href);
    const res = await fetch(`/api/assignments/${assignment.id}/submissions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setReview(data);
      const xp = data.xp?.awarded ?? 0;
      setTimeout(() => onDone(xp > 0 ? `Reviewed! +${xp} XP` : "Submission reviewed"), 800);
    } else {
      setError(data.error ?? "Error submitting");
    }
  }

  if (review) {
    const r = review.review;
    return (
      <div className="card p-7 space-y-5 animate-pop">
        <div className="flex items-center gap-4">
          <div className="text-4xl font-extrabold" style={{ color: scoreColor(r.score) }}>{r.score}</div>
          <div>
            <div className="font-semibold">AI Review · {assignment.title}</div>
            <div className="text-xs text-[var(--muted)]">
              {review.flaggedForHumanReview ? "Flagged for human review" : review.passed ? "Passed" : "Below passing — revise & resubmit"}
            </div>
          </div>
        </div>
        <ReviewList title="Strengths" items={r.strengths} color="var(--success)" />
        <ReviewList title="Weaknesses" items={r.weaknesses} color="var(--brand-2)" />
        <ReviewList title="Recommendations" items={r.recommendations} color="var(--accent)" />
        <ReviewList title="Next actions" items={r.nextActions} color="var(--warning)" />
      </div>
    );
  }

  return (
    <div className="card p-7 space-y-4">
      <h2 className="text-xl font-bold">{assignment.title}</h2>
      <p className="text-sm text-[var(--muted)]">{assignment.instructions}</p>
      <textarea
        className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-3 text-sm min-h-32 outline-none focus:border-[var(--brand)]"
        placeholder="Write your submission here…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <input
        className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-3 text-sm outline-none focus:border-[var(--brand)]"
        placeholder="Optional: link to a post / artwork / track"
        value={link}
        onChange={(e) => setLink(e.target.value)}
      />

      {/* File upload: artwork / audio / video / PDF */}
      <div className="border border-dashed border-[var(--border)] rounded-lg p-3">
        <label className="text-sm cursor-pointer flex items-center gap-2">
          <span className="btn btn-ghost py-1.5 px-3 text-xs">{uploading ? "Uploading…" : "📎 Attach file"}</span>
          <span className="text-xs text-[var(--muted)]">image, audio, video, or PDF (max 25MB)</span>
          <input type="file" className="hidden" accept="image/*,audio/*,video/mp4,video/quicktime,application/pdf" onChange={handleFile} disabled={uploading} />
        </label>
        {uploads.length > 0 && (
          <ul className="mt-2 space-y-1">
            {uploads.map((u, i) => (
              <li key={i} className="text-xs text-[var(--success)] flex items-center gap-2">
                ✓ {u.category} attached
                <button className="text-[var(--muted)] hover:text-[var(--brand-2)]" onClick={() => setUploads((arr) => arr.filter((_, idx) => idx !== i))}>remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-[var(--brand-2)]">{error}</p>}
      <button className="btn btn-primary w-full py-3" onClick={submit} disabled={loading || uploading || (!text && !link && uploads.length === 0)}>
        {loading ? "AI is reviewing…" : "Submit for AI review"}
      </button>
    </div>
  );
}

function DoneStep({ nextLessonId, courseSlug }: { nextLessonId: string | null; courseSlug: string }) {
  return (
    <div className="card p-8 text-center animate-pop">
      <div className="text-5xl mb-3">🎉</div>
      <h2 className="text-2xl font-bold mb-2">Lesson complete!</h2>
      <p className="text-[var(--muted)] mb-6">You earned XP and kept your streak alive.</p>
      <div className="flex gap-3 justify-center">
        {nextLessonId ? (
          <Link href={`/learn/${nextLessonId}`} className="btn btn-primary px-6 py-3">Next lesson →</Link>
        ) : (
          <Link href={`/courses/${courseSlug}`} className="btn btn-primary px-6 py-3">Back to course</Link>
        )}
        <Link href="/dashboard" className="btn btn-ghost px-6 py-3">Dashboard</Link>
      </div>
    </div>
  );
}

function ReviewList({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color }}>{title}</div>
      <ul className="space-y-1.5 text-sm">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2"><span style={{ color }}>•</span><span>{it}</span></li>
        ))}
      </ul>
    </div>
  );
}

function scoreColor(s: number) {
  if (s >= 80) return "var(--success)";
  if (s >= 60) return "var(--warning)";
  return "var(--brand-2)";
}

// Compose a celebration line from the XP/streak payload, including level-ups,
// newly-unlocked badges, the track-completion badge, and the program certificate.
function celebrate(data: {
  xp?: { awarded: number; leveledUp?: boolean; level?: { levelName: string }; newBadges?: { name: string; icon: string }[] } | null;
  streak?: { currentLen: number } | null;
  courseProgress?: {
    rewards?: {
      trackBadge?: { name: string; icon: string } | null;
      certificate?: { title: string } | null;
    } | null;
  } | null;
}): string {
  const parts: string[] = [];
  const xp = data.xp?.awarded ?? 0;
  if (xp > 0) parts.push(`+${xp} XP`);
  if (data.streak?.currentLen) parts.push(`🔥 ${data.streak.currentLen}-day streak`);
  if (data.xp?.leveledUp && data.xp.level) parts.push(`⬆️ ${data.xp.level.levelName}!`);
  for (const b of data.xp?.newBadges ?? []) parts.push(`${b.icon} ${b.name}`);
  // Course-completion rewards (only present on the lesson that finishes a track).
  const rewards = data.courseProgress?.rewards;
  if (rewards?.trackBadge) parts.push(`${rewards.trackBadge.icon} ${rewards.trackBadge.name}`);
  if (rewards?.certificate) parts.push(`🎓 Program complete — certificate earned!`);
  return parts.join(" · ");
}

// Render **bold** as real React nodes — never raw HTML — so lesson content can
// never inject markup/script (audit H1: stored XSS).
function renderBold(s: string): React.ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
