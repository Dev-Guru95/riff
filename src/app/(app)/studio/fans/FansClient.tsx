"use client";

import { useState } from "react";
import type { FanDTO } from "@/lib/studio-growth";
import { PageHeader, Breadcrumb, Avatar, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icons";

type Data = { fans: FanDTO[]; segments: { tag: string; count: number }[]; total: number };
const inp = "field";

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
    <main className="max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb href="/studio" label="Studio" />
      <PageHeader
        title="Fan CRM"
        subtitle="Your audience in one place — tag fans into segments you can target."
      />

      <form onSubmit={add} className="card p-4 mb-5 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={inp} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className={inp} />
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma-sep)" className={inp} />
        <button type="submit" className="btn btn-primary text-sm shrink-0">Add</button>
      </form>

      {/* Segments */}
      <div className="flex items-center gap-1 flex-wrap mb-4">
        <button onClick={() => pick(null)} className={`pill ${!filter ? "pill-active" : ""}`}>
          All ({data.total})
        </button>
        {data.segments.map((s) => (
          <button key={s.tag} onClick={() => pick(s.tag)} className={`pill ${filter === s.tag ? "pill-active" : ""}`}>
            {s.tag} ({s.count})
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {data.fans.map((f) => (
          <div key={f.id} className="card p-3 flex items-center gap-3 group">
            <Avatar name={f.name} size={34} square />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{f.name}</div>
              <div className="text-xs text-[var(--muted)] truncate">{f.email || "no email"}</div>
            </div>
            <input
              defaultValue={f.tags.join(", ")}
              onBlur={(e) => patchTags(f.id, e.target.value)}
              placeholder="tags"
              className={`w-40 shrink-0 ${inp}`}
            />
            <button
              aria-label={`Remove ${f.name}`}
              className="text-[var(--muted)] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[var(--brand-2)] transition shrink-0"
              onClick={() => del(f.id)}
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        ))}
        {data.fans.length === 0 && (
          <EmptyState
            icon="community"
            title={filter ? "No fans in this segment." : "No fans yet — add your first."}
          />
        )}
      </div>
    </main>
  );
}
