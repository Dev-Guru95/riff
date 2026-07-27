"use client";

import { useState } from "react";
import Link from "next/link";
import type { LinkPageDTO, LinkItem } from "@/lib/studio-growth";

const THEMES = ["brand", "brand-2", "accent", "success", "warning"];
const VAR: Record<string, string> = { brand: "var(--brand)", "brand-2": "var(--brand-2)", accent: "var(--accent)", success: "var(--success)", warning: "var(--warning)" };
const inp = "text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 outline-none focus:border-[var(--brand)]";

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export function LinkInBioClient({ initial }: { initial: LinkPageDTO }) {
  const [p, setP] = useState<LinkPageDTO>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof LinkPageDTO>(k: K, v: LinkPageDTO[K]) { setP((prev) => ({ ...prev, [k]: v })); }
  function setLink(i: number, item: LinkItem) { setP((prev) => ({ ...prev, links: prev.links.map((l, j) => (j === i ? item : l)) })); }

  async function save(patch?: Partial<LinkPageDTO>) {
    setSaving(true); setErr(null);
    const { ok, data } = await api("/api/studio/link-page", "PATCH", patch ?? { handle: p.handle, title: p.title, bio: p.bio, theme: p.theme, links: p.links });
    setSaving(false);
    if (ok) { setP(data.page); setSaved(true); setTimeout(() => setSaved(false), 1500); }
    else setErr(data.error ?? "Couldn't save");
  }
  // Send the full current payload (not just `published`) so unsaved edits aren't
  // clobbered by the server echoing the last-saved page.
  async function togglePublish() {
    await save({ handle: p.handle, title: p.title, bio: p.bio, theme: p.theme, links: p.links, published: !p.published });
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/studio" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">← Studio</Link>
      <div className="flex items-center justify-between gap-4 mt-1 mb-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">🔗 Link-in-Bio</h1>
        <div className="flex gap-2">
          <button className="btn btn-ghost text-sm" onClick={() => save()} disabled={saving}>{saving ? "Saving…" : saved ? "Saved ✓" : "Save"}</button>
          <button className={`btn text-sm ${p.published ? "btn-ghost" : "btn-primary"}`} onClick={togglePublish}>{p.published ? "Unpublish" : "Publish"}</button>
        </div>
      </div>
      <p className="text-sm text-[var(--muted)] mb-1">Your public landing page for every link. {p.published ? (
        <a href={`/u/${p.handle}`} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline">View live → /u/{p.handle}</a>
      ) : <span className="text-[var(--warning)]">Not published yet.</span>}</p>
      {err && <p className="text-sm text-[var(--brand-2)] mb-2">{err}</p>}

      <div className="grid gap-4 md:grid-cols-2 mt-4">
        {/* Editor */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--muted)]">Handle</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-[var(--muted)]">/u/</span>
              <input value={p.handle} onChange={(e) => set("handle", e.target.value)} className={`flex-1 ${inp}`} />
            </div>
          </div>
          <div><label className="text-xs text-[var(--muted)]">Title</label><input value={p.title} onChange={(e) => set("title", e.target.value)} className={`w-full ${inp}`} /></div>
          <div><label className="text-xs text-[var(--muted)]">Bio</label><textarea value={p.bio} onChange={(e) => set("bio", e.target.value)} rows={2} className={`w-full ${inp} resize-y`} /></div>
          <div>
            <label className="text-xs text-[var(--muted)]">Theme</label>
            <div className="flex gap-1.5 mt-1">
              {THEMES.map((t) => <button key={t} onClick={() => set("theme", t)} className={`h-6 w-6 rounded-full ${p.theme === t ? "ring-2 ring-white" : ""}`} style={{ background: VAR[t] }} />)}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between"><label className="text-xs text-[var(--muted)]">Links</label><button className="btn btn-ghost text-xs py-1 px-2" onClick={() => set("links", [...p.links, { label: "", url: "https://" }])}>+ Link</button></div>
            <div className="space-y-2 mt-1">
              {p.links.map((l, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input value={l.label} onChange={(e) => setLink(i, { ...l, label: e.target.value })} placeholder="Label" className={`w-28 ${inp}`} />
                  <input value={l.url} onChange={(e) => setLink(i, { ...l, url: e.target.value })} placeholder="https://" className={`flex-1 ${inp}`} />
                  <button className="text-[var(--muted)] hover:text-[var(--brand-2)]" onClick={() => set("links", p.links.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div>
          <div className="text-xs text-[var(--muted)] mb-1">Preview</div>
          <div className="card p-5 text-center" style={{ borderTopColor: VAR[p.theme], borderTopWidth: 3 }}>
            <div className="h-16 w-16 rounded-full mx-auto grid place-items-center text-2xl font-bold text-white" style={{ background: VAR[p.theme] }}>{(p.title || "A")[0]?.toUpperCase()}</div>
            <div className="font-bold mt-2">{p.title || "Your name"}</div>
            <p className="text-xs text-[var(--muted)] mt-1">{p.bio || "Your bio…"}</p>
            <div className="space-y-2 mt-4">
              {p.links.filter((l) => l.url).map((l, i) => (
                <div key={i} className="text-sm py-2 rounded-lg border" style={{ borderColor: VAR[p.theme] }}>{l.label || l.url}</div>
              ))}
              {p.links.length === 0 && <p className="text-xs text-[var(--muted)]">Add links to see them here.</p>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
