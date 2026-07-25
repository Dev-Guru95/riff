"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OverrideForm({ id, currentScore, passMark, alreadyReviewed }: { id: string; currentScore: number; passMark: number; alreadyReviewed: boolean }) {
  const router = useRouter();
  const [score, setScore] = useState(currentScore);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(alreadyReviewed);

  async function submit(decision: "reviewed" | "resubmit") {
    setLoading(true);
    const res = await fetch(`/api/admin/submissions/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aiScore: score, status: decision }),
    });
    setLoading(false);
    if (res.ok) { setDone(true); router.refresh(); }
  }

  if (done) return <p className="text-xs text-[var(--success)]">✓ Human-reviewed</p>;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <label className="text-xs text-[var(--muted)] flex items-center gap-2">
        Score
        <input type="range" min={0} max={100} value={score} onChange={(e) => setScore(Number(e.target.value))} />
        <span className="font-bold text-[var(--foreground)] w-8">{score}</span>
      </label>
      <button className="btn btn-primary py-1.5 px-3 text-xs" disabled={loading} onClick={() => submit("reviewed")}>
        Approve {score >= passMark ? "(pass + XP)" : "(below pass)"}
      </button>
      <button className="btn btn-ghost py-1.5 px-3 text-xs" disabled={loading} onClick={() => submit("resubmit")}>
        Request resubmit
      </button>
    </div>
  );
}
