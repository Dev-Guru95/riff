"use client";

import { useState } from "react";
import Link from "next/link";
import type { FanDTO } from "@/lib/studio-growth";

type Data = { fans: FanDTO[]; segments: { tag: string; count: number }[]; total: number };
const inp = "text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 outline-none focus:border-[var(--brand)]";

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export function FansClient({ initial }: { initial: Data }) {
  const [data, setData] = useState<Data>(initial);
  const [filter, setFilter] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tags, setTags] = useState("");

  async function reload(tag?: string | null) {
    const { ok, data } = await api(`/api/studio/fans${tag ? `?tag=${encodeURIComponent(tag)}` : ""}`, "GET");
    if (ok) setData(data);
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    await api("/api/studio/fans", "POST", { name: name.trim(), email: email.trim(), tags: tagList });
    setName(""); setEmail(""); setTags("");
    reload(filter);
  }
  async function patchTags(id: string, tagStr: string) {
    const tagList = tagStr.split(",").map((t) => t.trim()).filter(Boolean);
    await api(`/api/studio/fans/${id}`, "PATCH", { tags: tagList });
    reload(filter);
  }
  async function del(id: string) { await api(`/api/studio/fans/${id}`, "DELETE"); reload(filter); }
  function pick(tag: string | null) { setFilter(tag); reload(tag); }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/studio" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">← Studio</Link>
      <h1 className="text-2xl font-bold flex items-center gap-2 mt-1">👥 Fan CRM</h1>
      <p className="text-sm text-[var(--muted)] mb-6">Your audience in one place — tag fans into segments you can target.</p>

      <form onSubmit={add} className="card p-4 mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={inp} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className={inp} />
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma-sep)" className={inp} />
        <button type="submit" className="btn btn-primary text-sm">Add fan</button>
      </form>

      {/* Segments */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className="text-xs text-[var(--muted)]">Segments:</span>
        <button onClick={() => pick(null)} className={`text-xs px-2 py-1 rounded-full ${!filter ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)]"}`}>All ({data.total})</button>
        {data.segments.map((s) => (
          <button key={s.tag} onClick={() => pick(s.tag)} className={`text-xs px-2 py-1 rounded-full ${filter === s.tag ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)]"}`}>{s.tag} ({s.count})</button>
        ))}
      </div>

      <div className="space-y-2">
        {data.fans.map((f) => (
          <div key={f.id} className="card p-3 flex items-center gap-3 group">
            <span className="h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border)] grid place-items-center text-[11px] font-bold shrink-0">
              {f.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm truncate">{f.name}</div>
              <div className="text-xs text-[var(--muted)] truncate">{f.email || "no email"}</div>
            </div>
            <input defaultValue={f.tags.join(", ")} onBlur={(e) => patchTags(f.id, e.target.value)} placeholder="tags" className={`w-40 ${inp}`} />
            <button className="text-xs text-[var(--muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--brand-2)]" onClick={() => del(f.id)}>✕</button>
          </div>
        ))}
        {data.fans.length === 0 && <p className="text-sm text-[var(--muted)] text-center py-6">{filter ? "No fans in this segment." : "No fans yet — add your first."}</p>}
      </div>
    </main>
  );
}
