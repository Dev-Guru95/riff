"use client";

import { useState } from "react";
import Link from "next/link";
import { ProgressBar } from "@/components/ui";
import type { GoalDTO, Milestone } from "@/lib/studio-growth";

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}
const inp = "text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 outline-none focus:border-[var(--brand)]";
const mPct = (ms: Milestone[]) => (ms.length ? Math.round((ms.filter((m) => m.done).length / ms.length) * 100) : 0);

export function GoalsClient({ initial }: { initial: GoalDTO[] }) {
  const [goals, setGoals] = useState<GoalDTO[]>(initial);
  const [title, setTitle] = useState("");

  async function reload() { const { ok, data } = await api("/api/studio/goals", "GET"); if (ok) setGoals(data.goals); }
  async function add() { const t = title.trim(); if (!t) return; setTitle(""); await api("/api/studio/goals", "POST", { title: t }); reload(); }
  async function patch(id: string, d: Partial<GoalDTO>) { setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, ...d } : g))); const { ok } = await api(`/api/studio/goals/${id}`, "PATCH", d); if (!ok) reload(); }
  async function del(id: string) { setGoals((gs) => gs.filter((g) => g.id !== id)); const { ok } = await api(`/api/studio/goals/${id}`, "DELETE"); if (!ok) reload(); }

  function setMilestones(g: GoalDTO, ms: Milestone[]) { patch(g.id, { milestones: ms, progress: mPct(ms) }); }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/studio" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">← Studio</Link>
      <h1 className="text-2xl font-bold flex items-center gap-2 mt-1">🎯 Goals & Milestones</h1>
      <p className="text-sm text-[var(--muted)] mb-6">Set career goals, break them into milestones, and watch the progress build.</p>

      <div className="flex gap-2 mb-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="New goal (e.g. Reach 10k monthly listeners)" className={`flex-1 ${inp}`} />
        <button className="btn btn-primary text-sm" onClick={add}>Add</button>
      </div>

      <div className="space-y-3">
        {goals.map((g) => (
          <div key={g.id} className={`card p-4 ${g.status === "done" ? "opacity-70" : ""}`}>
            <div className="flex items-center gap-2">
              <input defaultValue={g.title} onBlur={(e) => e.target.value.trim() && patch(g.id, { title: e.target.value.trim() })} className={`flex-1 font-semibold ${inp}`} />
              <select value={g.status} onChange={(e) => patch(g.id, { status: e.target.value })} className={`${inp} capitalize`}>
                <option value="active">active</option><option value="done">done</option><option value="archived">archived</option>
              </select>
              <button className="text-[var(--muted)] hover:text-[var(--brand-2)]" onClick={() => del(g.id)}>✕</button>
            </div>

            <div className="flex items-center gap-2 mt-3 mb-1">
              <ProgressBar pct={g.progress} />
              <span className="text-xs text-[var(--muted)] w-10 text-right">{g.progress}%</span>
            </div>

            <div className="mt-3 space-y-1">
              {g.milestones.map((m, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <input type="checkbox" checked={m.done} onChange={() => setMilestones(g, g.milestones.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} className="accent-[var(--brand)]" />
                  <span className={`text-sm flex-1 ${m.done ? "line-through text-[var(--muted)]" : ""}`}>{m.text}</span>
                  <button className="text-xs text-[var(--muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--brand-2)]" onClick={() => setMilestones(g, g.milestones.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <input placeholder="+ Add milestone + Enter" onKeyDown={(e) => { const v = (e.target as HTMLInputElement).value.trim(); if (e.key === "Enter" && v) { setMilestones(g, [...g.milestones, { text: v, done: false }]); (e.target as HTMLInputElement).value = ""; } }} className={`w-full mt-1 ${inp}`} />
            </div>
          </div>
        ))}
        {goals.length === 0 && <p className="text-sm text-[var(--muted)] text-center py-6">No goals yet — add your first above.</p>}
      </div>
    </main>
  );
}
