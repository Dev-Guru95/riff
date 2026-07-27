"use client";

import { useState } from "react";
import Link from "next/link";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import type { BrandKitDTO, BrandColor, BrandFont } from "@/lib/studio-tools";

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export function BrandKitClient({ initial }: { initial: BrandKitDTO }) {
  const [colors, setColors] = useState<BrandColor[]>(initial.colors);
  const [fonts, setFonts] = useState<BrandFont[]>(initial.fonts);
  const [guidelines, setGuidelines] = useState(initial.guidelines);
  const [assets, setAssets] = useState(initial.assets);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function save() {
    setSaving(true); setSaved(false);
    const clean = colors.filter((c) => /^#[0-9a-fA-F]{3,8}$/.test(c.hex));
    const { ok } = await api("/api/studio/brand-kit", "PATCH", { colors: clean, fonts, guidelines });
    setSaving(false);
    if (ok) { setColors(clean); setSaved(true); setTimeout(() => setSaved(false), 1500); }
  }

  async function upload(file: File) {
    setUploading(true);
    const form = new FormData(); form.append("file", file);
    const up = await fetch("/api/uploads", { method: "POST", body: form });
    const upData = await up.json().catch(() => ({}));
    if (up.ok && upData.url) {
      const { ok, data } = await api("/api/studio/brand-kit/assets", "POST", { name: file.name, url: upData.url });
      if (ok && data.id) setAssets((a) => [...a, { id: data.id, name: data.name, url: data.url }]);
    }
    setUploading(false);
  }
  async function delAsset(id: string) {
    await api(`/api/studio/brand-kit/assets/${id}`, "DELETE");
    setAssets((a) => a.filter((x) => x.id !== id));
  }

  const isImage = (url: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(url);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/studio" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">← Studio</Link>
      <div className="flex items-center justify-between gap-4 mt-1 mb-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">🪪 Brand Kit</h1>
        <button className="btn btn-primary text-sm" onClick={save} disabled={saving}>{saving ? "Saving…" : saved ? "Saved ✓" : "Save"}</button>
      </div>
      <p className="text-sm text-[var(--muted)] mb-6">Your palette, fonts, logos, and guidelines — one source of truth for every post and cover.</p>

      {/* Colours */}
      <section className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">Colour palette</h2>
          <button className="btn btn-ghost text-xs py-1 px-2" onClick={() => setColors((c) => [...c, { name: "", hex: "#8b5cf6" }])}>+ Colour</button>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {colors.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : "#8b5cf6"} onChange={(e) => setColors((cs) => cs.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))} className="h-8 w-10 rounded bg-transparent border border-[var(--border)]" />
              <input value={c.hex} onChange={(e) => setColors((cs) => cs.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))} className="w-24 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 outline-none" />
              <input value={c.name} placeholder="Name" onChange={(e) => setColors((cs) => cs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="flex-1 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 outline-none" />
              <button className="text-[var(--muted)] hover:text-[var(--brand-2)]" onClick={() => setColors((cs) => cs.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          {colors.length === 0 && <p className="text-xs text-[var(--muted)]">No colours yet.</p>}
        </div>
      </section>

      {/* Fonts */}
      <section className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">Fonts</h2>
          <button className="btn btn-ghost text-xs py-1 px-2" onClick={() => setFonts((f) => [...f, { name: "", usage: "" }])}>+ Font</button>
        </div>
        <div className="space-y-2">
          {fonts.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={f.name} placeholder="Font name" onChange={(e) => setFonts((fs) => fs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="flex-1 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 outline-none" />
              <input value={f.usage} placeholder="Usage (e.g. headings)" onChange={(e) => setFonts((fs) => fs.map((x, j) => (j === i ? { ...x, usage: e.target.value } : x)))} className="flex-1 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 outline-none" />
              <button className="text-[var(--muted)] hover:text-[var(--brand-2)]" onClick={() => setFonts((fs) => fs.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          {fonts.length === 0 && <p className="text-xs text-[var(--muted)]">No fonts yet.</p>}
        </div>
      </section>

      {/* Assets */}
      <section className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">Logos & assets</h2>
          <label className="btn btn-ghost text-xs py-1 px-2 cursor-pointer">
            {uploading ? "Uploading…" : "+ Upload"}
            <input type="file" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          </label>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {assets.map((a) => (
            <div key={a.id} className="card bg-[var(--surface-2)] p-2 group relative">
              {isImage(a.url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt={a.name} className="w-full h-16 object-contain" />
              ) : (
                <div className="h-16 grid place-items-center text-2xl">📄</div>
              )}
              <div className="text-[10px] text-[var(--muted)] truncate mt-1">{a.name}</div>
              <button className="absolute top-1 right-1 text-xs opacity-0 group-hover:opacity-100 hover:text-[var(--brand-2)]" onClick={() => delAsset(a.id)}>✕</button>
            </div>
          ))}
          {assets.length === 0 && <p className="text-xs text-[var(--muted)] col-span-full">No assets uploaded.</p>}
        </div>
      </section>

      {/* Guidelines */}
      <section className="card p-4">
        <h2 className="font-semibold text-sm mb-3">Brand guidelines</h2>
        <MarkdownEditor value={guidelines} onChange={setGuidelines} placeholder="Tone of voice, do's and don'ts, taglines…" />
      </section>
    </main>
  );
}
