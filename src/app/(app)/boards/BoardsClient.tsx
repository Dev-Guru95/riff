"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BOARD_TEMPLATES, templateFor, type BoardTemplate } from "@/lib/board-templates";

type Board = {
  id: string;
  title: string;
  description: string;
  color: string;
  kind: string;
  archived: boolean;
  role: string;
  memberCount: number;
  cardCount: number;
  updatedAt: string;
};

export function BoardsClient({ initialBoards }: { initialBoards: Board[] }) {
  const router = useRouter();
  const [boards] = useState<Board[]>(initialBoards);
  const [creating, setCreating] = useState(false);
  const [kind, setKind] = useState("generic");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCreating(false);
    setKind("generic");
    setTitle("");
    setError(null);
  }

  function pick(t: BoardTemplate) {
    setKind(t.kind);
    // Prefill the title with the tool's name (blank board stays empty).
    setTitle(t.kind === "generic" ? "" : t.name);
  }

  async function createBoard(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/boards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: t, kind }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && data.id) router.push(`/boards/${data.id}`);
    else setError(data.error ?? "Couldn't create board");
  }

  return (
    <div>
      <div className="mb-6">
        {creating ? (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm">Start a new board</span>
              <button className="text-[var(--muted)] hover:text-[var(--foreground)]" onClick={reset}>✕</button>
            </div>
            <p className="text-xs text-[var(--muted)] mb-3">Pick a tool — each comes pre-set with the right columns and labels.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {BOARD_TEMPLATES.map((t) => (
                <button
                  key={t.kind}
                  type="button"
                  onClick={() => pick(t)}
                  className={`text-left card p-3 transition hover:border-[var(--brand)] ${kind === t.kind ? "border-[var(--brand)] ring-1 ring-[var(--brand)]" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{t.icon}</span>
                    {t.track && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--muted)]">Track {t.track}</span>}
                  </div>
                  <div className="text-sm font-medium mt-1">{t.name}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5 line-clamp-2">{t.tagline}</div>
                </button>
              ))}
            </div>
            <form onSubmit={createBoard} className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="Board name"
                className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
              />
              <button type="submit" className="btn btn-primary py-2 px-4 text-sm" disabled={busy}>
                {busy ? "Creating…" : `Create ${templateFor(kind).name}`}
              </button>
            </form>
            {error && <p className="text-[var(--brand-2)] text-sm mt-2">{error}</p>}
          </div>
        ) : (
          <button className="btn btn-primary text-sm" onClick={() => setCreating(true)}>+ New board</button>
        )}
      </div>

      {boards.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-2">🗂️</div>
          <p className="font-semibold">No boards yet</p>
          <p className="text-sm text-[var(--muted)] mt-1">Create your first board — pick a tool like Content Calendar or Release Planner to get started fast.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => {
            const tpl = templateFor(b.kind);
            return (
              <Link key={b.id} href={`/boards/${b.id}`} className="card p-4 hover:border-[var(--brand)] transition group">
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none mt-0.5" title={tpl.name}>{tpl.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate group-hover:text-[var(--brand)] transition">{b.title}</div>
                    <div className="text-xs text-[var(--muted)] mt-0.5">{b.kind === "generic" ? "Board" : tpl.name}</div>
                    <div className="flex items-center gap-3 text-xs text-[var(--muted)] mt-3">
                      <span>🗒️ {b.cardCount}</span>
                      <span>👥 {b.memberCount}</span>
                      <span className="ml-auto capitalize px-2 py-0.5 rounded-full bg-[var(--surface-2)]">{b.role}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
