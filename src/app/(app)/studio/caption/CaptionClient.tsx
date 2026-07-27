"use client";

import { useState } from "react";
import Link from "next/link";

const PLATFORMS = ["instagram", "tiktok", "youtube", "x", "facebook"];
const TONES = ["authentic", "hype", "playful", "professional", "moody"];
const sel = "text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2 py-2 outline-none capitalize";

export function CaptionClient() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [tone, setTone] = useState("authentic");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ captions: string[]; hashtags: string[] } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function gen() {
    if (!topic.trim()) return;
    setBusy(true);
    const res = await fetch("/api/studio/caption", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic, platform, tone }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) setResult(data);
  }
  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1200);
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/studio" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">← Studio</Link>
      <h1 className="text-2xl font-bold flex items-center gap-2 mt-1">✍️ Caption & Hashtag Generator</h1>
      <p className="text-sm text-[var(--muted)] mb-6">Describe your post — get scroll-stopping captions and hashtags.</p>

      <div className="card p-4 mb-4">
        <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} placeholder="What's the post about? (e.g. teaser for my new synthwave single 'Neon Drive')" className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--brand)] resize-y mb-2" />
        <div className="flex items-center gap-2 flex-wrap">
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={sel}>{PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
          <select value={tone} onChange={(e) => setTone(e.target.value)} className={sel}>{TONES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <button className="btn btn-primary text-sm ml-auto" onClick={gen} disabled={busy || !topic.trim()}>{busy ? "Generating…" : "Generate"}</button>
        </div>
      </div>

      {result && (
        <>
          <h2 className="text-sm font-semibold text-[var(--muted)] mb-2">Captions</h2>
          <div className="space-y-2 mb-4">
            {result.captions.map((c, i) => (
              <div key={i} className="card p-3 flex items-start gap-2">
                <p className="flex-1 text-sm">{c}</p>
                <button className="btn btn-ghost text-xs py-1 px-2 shrink-0" onClick={() => copy(c, `c${i}`)}>{copied === `c${i}` ? "Copied ✓" : "Copy"}</button>
              </div>
            ))}
          </div>
          <h2 className="text-sm font-semibold text-[var(--muted)] mb-2">Hashtags</h2>
          <div className="card p-3">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {result.hashtags.map((h, i) => <span key={i} className="text-xs px-2 py-1 rounded-full bg-[var(--surface-2)] text-[var(--accent)]">{h}</span>)}
            </div>
            <button className="btn btn-ghost text-xs py-1 px-2" onClick={() => copy(result.hashtags.join(" "), "tags")}>{copied === "tags" ? "Copied ✓" : "Copy all"}</button>
          </div>
        </>
      )}
    </main>
  );
}
