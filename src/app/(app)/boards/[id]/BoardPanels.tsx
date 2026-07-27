"use client";

import { useEffect, useState } from "react";

type Member = { userId: string; role: string; name: string; email: string };
const ROLES = ["admin", "manager", "member", "guest"];

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 bg-black/50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-[var(--surface)] border-l border-[var(--border)] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">{title}</h2>
          <button className="text-[var(--muted)] hover:text-[var(--foreground)]" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function MembersPanel({
  boardId,
  members: initial,
  ownerId,
  onClose,
  onReload,
}: {
  boardId: string;
  members: Member[];
  ownerId: string;
  onClose: () => void;
  onReload: () => void;
}) {
  const [members, setMembers] = useState<Member[]>(initial);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ userId: string; name: string; email: string }[]>([]);
  const [role, setRole] = useState("member");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    let active = true;
    const t = setTimeout(async () => {
      if (term.length < 2) { if (active) setResults([]); return; }
      const { ok, data } = await api(`/api/boards/${boardId}/members?q=${encodeURIComponent(term)}`, "GET");
      if (active && ok) setResults(data.users ?? []);
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [q, boardId]);

  async function add(email: string) {
    setErr(null);
    const { ok, data } = await api(`/api/boards/${boardId}/members`, "POST", { email, role });
    if (ok) {
      setMembers((m) => [...m, { userId: data.userId, role: data.role, name: data.name, email: data.email }]);
      setQ(""); setResults([]);
      onReload();
    } else setErr(data.error ?? "Couldn't add member");
  }
  async function changeRole(userId: string, newRole: string) {
    const { ok } = await api(`/api/boards/${boardId}/members/${userId}`, "PATCH", { role: newRole });
    if (ok) { setMembers((ms) => ms.map((m) => (m.userId === userId ? { ...m, role: newRole } : m))); onReload(); }
  }
  async function remove(userId: string) {
    const { ok } = await api(`/api/boards/${boardId}/members/${userId}`, "DELETE");
    if (ok) { setMembers((ms) => ms.filter((m) => m.userId !== userId)); onReload(); }
  }

  return (
    <Drawer title="Board members" onClose={onClose}>
      <div className="card p-3 mb-4">
        <div className="text-xs text-[var(--muted)] mb-2">Add a member by email or stage name</div>
        <div className="flex gap-2 mb-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…"
            className="flex-1 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--brand)]" />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2">
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        {results.map((u) => (
          <button key={u.userId} onClick={() => add(u.email)} className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--surface-2)] text-sm flex justify-between">
            <span>{u.name}</span><span className="text-[var(--muted)] text-xs">{u.email}</span>
          </button>
        ))}
        {q.trim().length >= 2 && results.length === 0 && <p className="text-xs text-[var(--muted)] px-2">No matching users</p>}
        {err && <p className="text-xs text-[var(--brand-2)] mt-1">{err}</p>}
      </div>

      <div className="space-y-1">
        {members.map((m) => {
          const isOwner = m.userId === ownerId || m.role === "owner";
          return (
            <div key={m.userId} className="flex items-center gap-2 px-2 py-2 rounded hover:bg-[var(--surface-2)]">
              <span className="h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border)] grid place-items-center text-[11px] font-bold">
                {m.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{m.name}</div>
                <div className="text-xs text-[var(--muted)] truncate">{m.email}</div>
              </div>
              {isOwner ? (
                <span className="text-xs px-2 py-1 rounded-full bg-[var(--surface-2)] text-[var(--muted)]">owner</span>
              ) : (
                <>
                  <select value={m.role} onChange={(e) => changeRole(m.userId, e.target.value)} className="text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded px-1 py-1">
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button className="text-xs text-[var(--muted)] hover:text-[var(--brand-2)] px-1" onClick={() => remove(m.userId)}>Remove</button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}

export function ActivityPanel({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const [activity, setActivity] = useState<{ id: string; actor: string; text: string; createdAt: string }[] | null>(null);
  useEffect(() => {
    api(`/api/boards/${boardId}/activity`, "GET").then(({ ok, data }) => { if (ok) setActivity(data.activity ?? []); });
  }, [boardId]);
  const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <Drawer title="Board activity" onClose={onClose}>
      {activity === null ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : activity.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No activity yet.</p>
      ) : (
        <div className="space-y-2.5">
          {activity.map((a) => (
            <div key={a.id} className="text-sm flex gap-2">
              <span className="font-medium">{a.actor}</span>
              <span className="text-[var(--muted)] flex-1">{a.text}</span>
              <span className="text-xs text-[var(--muted)] whitespace-nowrap">{fmt(a.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}

export function ArchivePanel({ boardId, onClose, onReload }: { boardId: string; onClose: () => void; onReload: () => void }) {
  const [cards, setCards] = useState<{ id: string; title: string; columnTitle: string }[] | null>(null);

  useEffect(() => {
    api(`/api/boards/${boardId}/archive`, "GET").then(({ ok, data }) => { if (ok) setCards(data.cards ?? []); });
  }, [boardId]);

  async function restore(id: string) {
    const { ok } = await api(`/api/cards/${id}`, "PATCH", { archived: false });
    if (ok) { setCards((cs) => (cs ?? []).filter((c) => c.id !== id)); onReload(); }
  }

  return (
    <Drawer title="Archived cards" onClose={onClose}>
      {cards === null ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : cards.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No archived cards.</p>
      ) : (
        <div className="space-y-2">
          {cards.map((c) => (
            <div key={c.id} className="card p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{c.title}</div>
                <div className="text-xs text-[var(--muted)]">was in {c.columnTitle}</div>
              </div>
              <button className="btn btn-ghost text-xs py-1.5 px-3" onClick={() => restore(c.id)}>Restore</button>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
