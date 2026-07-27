"use client";

import { useState } from "react";
import Link from "next/link";
import { ProgressRing } from "@/components/ui";
import type { Builder, DraftDTO } from "@/lib/studio";

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export function AiBuilder({ builder, initialDrafts }: { builder: Builder; initialDrafts: DraftDTO[] }) {
  const [drafts, setDrafts] = useState<DraftDTO[]>(initialDrafts);
  const [activeId, setActiveId] = useState<string | null>(initialDrafts[0]?.id ?? null);
  const active = drafts.find((d) => d.id === activeId) ?? null;
  const [title, setTitle] = useState(active?.title ?? "");
  const [content, setContent] = useState(active?.content ?? "");
  const [busy, setBusy] = useState<"" | "save" | "score">("");
  const [dirty, setDirty] = useState(false);

  function select(d: DraftDTO) {
    setActiveId(d.id);
    setTitle(d.title);
    setContent(d.content);
    setDirty(false);
  }

  async function newDraft() {
    const { ok, data } = await api("/api/studio/drafts", "POST", { kind: builder.kind, title: "Untitled" });
    if (ok && data.id) {
      const fresh = await api(`/api/studio/drafts/${data.id}`, "GET");
      if (fresh.ok) {
        setDrafts((ds) => [fresh.data.draft, ...ds]);
        select(fresh.data.draft);
      }
    }
  }

  async function save() {
    if (!active) return;
    setBusy("save");
    const { ok, data } = await api(`/api/studio/drafts/${active.id}`, "PATCH", { title: title.trim() || "Untitled", content });
    setBusy("");
    if (ok) { setDrafts((ds) => ds.map((d) => (d.id === active.id ? data.draft : d))); setDirty(false); }
  }

  async function score() {
    if (!active) return;
    setBusy("score");
    // Persist latest edits first, then score.
    await api(`/api/studio/drafts/${active.id}`, "PATCH", { title: title.trim() || "Untitled", content });
    const { ok, data } = await api(`/api/studio/drafts/${active.id}/score`, "POST");
    setBusy("");
    if (ok) { setDrafts((ds) => ds.map((d) => (d.id === active.id ? data.draft : d))); setDirty(false); }
  }

  async function del(id: string) {
    if (!confirm("Delete this draft?")) return;
    await api(`/api/studio/drafts/${id}`, "DELETE");
    setDrafts((ds) => {
      const next = ds.filter((d) => d.id !== id);
      if (id === activeId) {
        if (next[0]) select(next[0]);
        else { setActiveId(null); setTitle(""); setContent(""); }
      }
      return next;
    });
  }

  const fb = active?.feedback ?? null;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/studio" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">← Studio</Link>
      <h1 className="text-2xl font-bold flex items-center gap-2 mt-1">
        <span>{builder.icon}</span> {builder.name}
      </h1>
      <p className="text-sm text-[var(--muted)] mb-6">{builder.tagline}</p>

      <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
        {/* Draft list */}
        <div>
          <button className="btn btn-primary text-sm w-full mb-3" onClick={newDraft}>+ New draft</button>
          <div className="space-y-1">
            {drafts.map((d) => (
              <button
                key={d.id}
                onClick={() => select(d)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${d.id === activeId ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]"}`}
              >
                <span className="flex-1 truncate">{d.title || "Untitled"}</span>
                {d.score != null && <span className="text-xs text-[var(--accent)]">{d.score}</span>}
              </button>
            ))}
            {drafts.length === 0 && <p className="text-xs text-[var(--muted)] px-1">No drafts yet — create one.</p>}
          </div>
        </div>

        {/* Editor + feedback */}
        {active ? (
          <div>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
              placeholder="Draft title"
              className="w-full text-lg font-semibold bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand)] outline-none pb-1 mb-3"
            />
            <p className="text-xs text-[var(--muted)] mb-2">{builder.instructions}</p>
            <textarea
              value={content}
              onChange={(e) => { setContent(e.target.value); setDirty(true); }}
              rows={10}
              placeholder={builder.placeholder}
              className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--brand)] resize-y"
            />
            <div className="flex items-center gap-2 mt-3">
              <button className="btn btn-primary text-sm" onClick={score} disabled={busy !== "" || !content.trim()}>
                {busy === "score" ? "Scoring…" : "Get Riff Score"}
              </button>
              <button className="btn btn-ghost text-sm" onClick={save} disabled={busy !== "" || !dirty}>
                {busy === "save" ? "Saving…" : dirty ? "Save" : "Saved"}
              </button>
              <button className="btn btn-ghost text-sm text-[var(--brand-2)] ml-auto" onClick={() => del(active.id)}>Delete</button>
            </div>

            {/* Rubric */}
            <div className="mt-4 text-xs text-[var(--muted)]">
              <span className="font-medium text-[var(--foreground)]">Scored on:</span>{" "}
              {builder.rubric.map((r) => `${r.criterion} (${r.weight}%)`).join(" · ")}
            </div>

            {/* Feedback */}
            {fb && (
              <div className="card p-5 mt-4">
                <div className="flex items-center gap-4 mb-4">
                  <ProgressRing pct={fb.score} label={`${fb.score}`} />
                  <div>
                    <div className="font-bold">Your Riff Score</div>
                    <div className="text-xs text-[var(--muted)]">
                      {active.scoredAt ? `Scored ${new Date(active.scoredAt).toLocaleString()}` : ""}
                      {fb.confidence < 0.6 && " · low confidence — consider human review"}
                    </div>
                  </div>
                </div>
                <FbList title="✅ Strengths" items={fb.strengths} tone="text-[var(--success)]" />
                <FbList title="⚠️ Weaknesses" items={fb.weaknesses} tone="text-[var(--warning)]" />
                <FbList title="🛠️ Recommendations" items={fb.recommendations} />
                <FbList title="➡️ Next actions" items={fb.nextActions} tone="text-[var(--accent)]" />
              </div>
            )}
          </div>
        ) : (
          <div className="card p-10 text-center">
            <div className="text-4xl mb-2">{builder.icon}</div>
            <p className="font-semibold">Start your first draft</p>
            <p className="text-sm text-[var(--muted)] mt-1">Write it, get a Riff Score, then revise to improve.</p>
          </div>
        )}
      </div>
    </main>
  );
}

function FbList({ title, items, tone }: { title: string; items: string[]; tone?: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-3">
      <div className={`text-sm font-medium mb-1 ${tone ?? ""}`}>{title}</div>
      <ul className="list-disc pl-5 space-y-0.5 text-sm text-[var(--muted)]">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}
