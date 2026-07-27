"use client";

import { useState } from "react";
import Link from "next/link";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import type { BroadcastDTO } from "@/lib/studio-growth";

const inp = "text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 outline-none focus:border-[var(--brand)]";

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export function BroadcastsClient({ initial }: { initial: BroadcastDTO[] }) {
  const [items, setItems] = useState<BroadcastDTO[]>(initial);
  const [activeId, setActiveId] = useState<string | null>(initial.find((b) => !b.sentAt)?.id ?? null);
  const active = items.find((b) => b.id === activeId) ?? null;
  const [subject, setSubject] = useState(active?.subject ?? "");
  const [body, setBody] = useState(active?.body ?? "");
  const [segment, setSegment] = useState(active?.segment ?? "");
  const [newSubj, setNewSubj] = useState("");

  async function reload() { const { ok, data } = await api("/api/studio/broadcasts", "GET"); if (ok) setItems(data.broadcasts); }
  async function select(b: BroadcastDTO) {
    // Auto-save the current draft's edits before switching so they aren't lost.
    if (active && !active.sentAt && (subject !== active.subject || body !== active.body || segment !== active.segment)) {
      await api(`/api/studio/broadcasts/${active.id}`, "PATCH", { subject, body, segment });
      reload();
    }
    setActiveId(b.id); setSubject(b.subject); setBody(b.body); setSegment(b.segment);
  }
  async function create() { const s = newSubj.trim(); if (!s) return; setNewSubj(""); const { ok, data } = await api("/api/studio/broadcasts", "POST", { subject: s }); if (ok) { await reload(); const nb = { id: data.id, subject: s, body: "", segment: "", recipientCount: 0, sentAt: null }; select(nb); } }
  async function save() { if (!active) return; await api(`/api/studio/broadcasts/${active.id}`, "PATCH", { subject, body, segment }); reload(); }
  async function send() {
    if (!active) return;
    await api(`/api/studio/broadcasts/${active.id}`, "PATCH", { subject, body, segment });
    const { ok, data } = await api(`/api/studio/broadcasts/${active.id}/send`, "POST");
    if (ok) { alert(`Recorded — this broadcast targets ${data.recipientCount} fan(s) with an email. (Connect an email provider to actually deliver.)`); reload(); }
  }
  async function del(id: string) {
    setItems((is) => is.filter((b) => b.id !== id));
    if (id === activeId) setActiveId(null);
    const { ok } = await api(`/api/studio/broadcasts/${id}`, "DELETE");
    if (!ok) reload();
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/studio" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">← Studio</Link>
      <h1 className="text-2xl font-bold flex items-center gap-2 mt-1">📣 Broadcasts</h1>
      <p className="text-sm text-[var(--muted)] mb-3">Compose updates for your fans and target them by segment.</p>
      <div className="card p-3 mb-4 text-xs text-[var(--warning)] bg-[var(--warning)]/5">
        ⚠️ Email delivery is not connected yet. Sending records the broadcast and its audience size; hook up an email provider to actually deliver (mirrors how billing/social degrade until keys are set).
      </div>

      <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
        <div>
          <div className="flex gap-2 mb-3">
            <input value={newSubj} onChange={(e) => setNewSubj(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="New broadcast" className={`flex-1 ${inp}`} />
            <button className="btn btn-primary text-sm" onClick={create}>+</button>
          </div>
          <div className="space-y-1">
            {items.map((b) => (
              <button key={b.id} onClick={() => select(b)} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${b.id === activeId ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]"}`}>
                <span className="flex-1 truncate">{b.subject}</span>
                {b.sentAt ? <span className="text-[10px] text-[var(--success)]">sent · {b.recipientCount}</span> : <span className="text-[10px] text-[var(--muted)]">draft</span>}
              </button>
            ))}
            {items.length === 0 && <p className="text-xs text-[var(--muted)] px-1">No broadcasts yet.</p>}
          </div>
        </div>

        {active ? (
          <div>
            <input value={subject} disabled={!!active.sentAt} onChange={(e) => setSubject(e.target.value)} className={`w-full text-lg font-semibold ${inp} mb-2 disabled:opacity-70`} />
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs text-[var(--muted)]">Segment (fan tag, blank = all)</label>
              <input value={segment} disabled={!!active.sentAt} onChange={(e) => setSegment(e.target.value)} placeholder="all fans" className={`${inp} disabled:opacity-70`} />
            </div>
            <MarkdownEditor value={body} onChange={setBody} disabled={!!active.sentAt} placeholder="Write your update…" />
            <div className="flex gap-2 mt-3">
              {active.sentAt ? (
                <span className="text-sm text-[var(--success)]">Sent to {active.recipientCount} fan(s) · {new Date(active.sentAt).toLocaleDateString()}</span>
              ) : (
                <>
                  <button className="btn btn-primary text-sm" onClick={send}>Send</button>
                  <button className="btn btn-ghost text-sm" onClick={save}>Save draft</button>
                </>
              )}
              <button className="btn btn-ghost text-sm text-[var(--brand-2)] ml-auto" onClick={() => del(active.id)}>Delete</button>
            </div>
          </div>
        ) : (
          <div className="card p-10 text-center"><p className="text-sm text-[var(--muted)]">Select or create a broadcast.</p></div>
        )}
      </div>
    </main>
  );
}
