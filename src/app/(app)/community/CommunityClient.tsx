"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GroupJoinButton({ id, joined, full }: { id: string; joined: boolean; full: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function toggle() {
    setLoading(true);
    await fetch(`/api/community/groups/${id}/membership`, { method: "POST" });
    setLoading(false);
    router.refresh();
  }
  if (full && !joined) return <span className="text-xs text-[var(--muted)]">Full</span>;
  return (
    <button className={`btn py-1.5 px-4 text-xs ${joined ? "btn-ghost" : "btn-primary"}`} onClick={toggle} disabled={loading}>
      {joined ? "Leave" : "Join"}
    </button>
  );
}

export function NewThreadForm({ forumId }: { forumId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("discussion");
  const [link, setLink] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const payload: Record<string, unknown> = { title, body, kind };
    if (link.trim()) payload.link = link.trim();
    const res = await fetch(`/api/community/forums/${forumId}/threads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (res.ok) { setTitle(""); setBody(""); setLink(""); setOpen(false); router.refresh(); }
    else { const d = await res.json().catch(() => ({})); setErr(d.error ?? "Failed to post"); }
  }

  if (!open) return <button className="btn btn-primary" onClick={() => setOpen(true)}>+ New thread</button>;

  return (
    <form onSubmit={submit} className="card p-4 space-y-3">
      <input className="ci" placeholder="Thread title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
      <textarea className="ci min-h-24" placeholder="What's on your mind? (or your feedback request / win)" value={body} onChange={(e) => setBody(e.target.value)} required />
      <div className="flex gap-2">
        <select className="ci" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="discussion">Discussion</option>
          <option value="feedback">Feedback request</option>
          <option value="showcase">Showcase a win</option>
        </select>
        <input className="ci" placeholder="Optional link (post/track)" value={link} onChange={(e) => setLink(e.target.value)} />
      </div>
      {err && <p className="text-sm text-[var(--brand-2)]">{err}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={loading || !title || !body}>{loading ? "Posting…" : "Post"}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <style>{`.ci{width:100%;background:var(--surface-2);border:1px solid var(--border);border-radius:.5rem;padding:.5rem .7rem;font-size:.85rem;color:var(--foreground);outline:none}.ci:focus{border-color:var(--brand)}`}</style>
    </form>
  );
}

export function ReportButton({ targetType, targetId }: { targetType: "thread" | "post" | "user"; targetId: string }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  async function report() {
    const reason = window.prompt("Why are you reporting this? (spam, abuse, etc.)");
    if (!reason) return;
    setBusy(true);
    const res = await fetch("/api/community/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason }),
    });
    setBusy(false);
    if (res.ok) setDone(true);
  }
  if (done) return <span className="text-xs text-[var(--muted)]">Reported ✓</span>;
  return (
    <button onClick={report} disabled={busy} className="text-xs text-[var(--muted)] hover:text-[var(--brand-2)]" title="Report">
      ⚑ Report
    </button>
  );
}

export function BlockButton({ userId, blocked }: { userId: string; blocked: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    await fetch("/api/community/block", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blockedId: userId }),
    });
    setBusy(false);
    router.refresh();
  }
  return (
    <button onClick={toggle} disabled={busy} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]" title="Block this artist">
      {blocked ? "Unblock" : "Block"}
    </button>
  );
}

export function ReplyForm({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/community/threads/${threadId}/posts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setLoading(false);
    if (res.ok) { setBody(""); router.refresh(); }
  }
  return (
    <form onSubmit={submit} className="flex gap-2 mt-4">
      <input className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" placeholder="Add a reply or feedback…" value={body} onChange={(e) => setBody(e.target.value)} />
      <button className="btn btn-primary px-5" disabled={loading || !body.trim()}>Reply</button>
    </form>
  );
}
