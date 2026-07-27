"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Results = {
  boards: { id: string; title: string }[];
  cards: { id: string; boardId: string; title: string; boardTitle: string }[];
  labels: { id: string; boardId: string; name: string; color: string; boardTitle: string }[];
  comments: { cardId: string; boardId: string; snippet: string; boardTitle: string }[];
  attachments: { cardId: string; boardId: string; name: string; boardTitle: string }[];
  users: { userId: string; name: string; email: string }[];
};

const LABEL_VAR: Record<string, string> = {
  brand: "var(--brand)", "brand-2": "var(--brand-2)", accent: "var(--accent)",
  success: "var(--success)", warning: "var(--warning)", muted: "var(--muted)",
};

const empty: Results = { boards: [], cards: [], labels: [], comments: [], attachments: [], users: [] };

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results>(empty);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    let active = true;
    const t = setTimeout(async () => {
      if (term.length < 2) { if (active) setResults(empty); return; }
      setLoading(true);
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
      const data = await res.json().catch(() => ({}));
      if (active) { setResults(data.results ?? empty); setLoading(false); setOpen(true); }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const total = results.boards.length + results.cards.length + results.labels.length + results.comments.length + results.attachments.length + results.users.length;

  const close = () => setOpen(false);

  return (
    <div className="relative" ref={box}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => q.trim().length >= 2 && setOpen(true)}
        placeholder="Search boards, tasks, labels, comments, people…"
        className="w-full text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--brand)]"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full card bg-[var(--surface)] max-h-[70vh] overflow-y-auto p-2 shadow-xl">
          {loading && total === 0 ? (
            <p className="text-xs text-[var(--muted)] p-2">Searching…</p>
          ) : total === 0 ? (
            <p className="text-xs text-[var(--muted)] p-2">No matches for “{q.trim()}”.</p>
          ) : (
            <div className="space-y-2">
              <Group label="Boards" show={results.boards.length > 0}>
                {results.boards.map((b) => (
                  <Row key={b.id} href={`/boards/${b.id}`} icon="🗂️" onNavigate={close}>{b.title}</Row>
                ))}
              </Group>
              <Group label="Tasks" show={results.cards.length > 0}>
                {results.cards.map((c) => (
                  <Row key={c.id} href={`/boards/${c.boardId}?card=${c.id}`} icon="🗒️" sub={c.boardTitle} onNavigate={close}>{c.title}</Row>
                ))}
              </Group>
              <Group label="Labels" show={results.labels.length > 0}>
                {results.labels.map((l) => (
                  <Row key={l.id} href={`/boards/${l.boardId}`} sub={l.boardTitle} onNavigate={close}
                    icon={<span className="h-3 w-6 rounded-full inline-block" style={{ background: LABEL_VAR[l.color] }} />}>
                    {l.name || l.color}
                  </Row>
                ))}
              </Group>
              <Group label="Comments" show={results.comments.length > 0}>
                {results.comments.map((c, i) => (
                  <Row key={i} href={`/boards/${c.boardId}?card=${c.cardId}`} icon="💬" sub={c.boardTitle} onNavigate={close}>{c.snippet}</Row>
                ))}
              </Group>
              <Group label="Attachments" show={results.attachments.length > 0}>
                {results.attachments.map((a, i) => (
                  <Row key={i} href={`/boards/${a.boardId}?card=${a.cardId}`} icon="📎" sub={a.boardTitle} onNavigate={close}>{a.name}</Row>
                ))}
              </Group>
              <Group label="People" show={results.users.length > 0}>
                {results.users.map((u) => (
                  <div key={u.userId} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                    <span className="h-5 w-5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] grid place-items-center text-[9px] font-bold">
                      {u.name.split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                    <span className="flex-1 truncate">{u.name}</span>
                    <span className="text-xs text-[var(--muted)] truncate">{u.email}</span>
                  </div>
                ))}
              </Group>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ label, show, children }: { label: string; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)] px-2 mb-0.5">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function Row({ href, icon, sub, children, onNavigate }: { href: string; icon: React.ReactNode; sub?: string; children: React.ReactNode; onNavigate: () => void }) {
  return (
    <Link href={href} onClick={onNavigate} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--surface-2)] text-sm">
      <span className="w-6 text-center shrink-0">{icon}</span>
      <span className="flex-1 min-w-0 truncate">{children}</span>
      {sub && <span className="text-xs text-[var(--muted)] truncate max-w-[7rem]">{sub}</span>}
    </Link>
  );
}
