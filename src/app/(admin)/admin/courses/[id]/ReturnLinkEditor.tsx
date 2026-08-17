"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_RETURN_LABEL, RETURN_LABEL_MAX, RETURN_URL_MAX } from "@/lib/returnLink";

// Wires the Skool ⇄ Riff loop for one track: where the learner is sent once they
// finish this track's questions. Normally the NEXT Skool track, so the cycle
// repeats without them navigating back by hand.

export function ReturnLinkEditor({
  courseId,
  returnUrl,
  returnLabel,
  fallbackUrl,
}: {
  courseId: string;
  returnUrl: string | null;
  returnLabel: string | null;
  fallbackUrl: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(returnUrl ?? "");
  const [label, setLabel] = useState(returnLabel ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await fetch(`/api/admin/courses/${courseId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ returnUrl: url, returnLabel: label }),
    });
    setBusy(false);
    if (res.ok) {
      // Adopt the stored (trimmed/normalized) values, otherwise the form stays
      // "dirty" forever whenever the server tidied up what was pasted in.
      const saved = await res.json().catch(() => null);
      if (saved) {
        setUrl(saved.returnUrl ?? "");
        setLabel(saved.returnLabel ?? "");
      }
      setMsg("Saved");
      router.refresh();
      setTimeout(() => setMsg(null), 2500);
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? "Could not save the return link");
    }
  }

  const dirty = url !== (returnUrl ?? "") || label !== (returnLabel ?? "");

  return (
    <section className="card p-5 space-y-3">
      <div>
        <h2 className="font-semibold">When this track is finished</h2>
        <p className="text-xs text-[var(--muted)] mt-1">
          Where learners go after completing this track&apos;s questions — normally the next track in Skool.
          Shown on the completion screen and on the track page once it&apos;s 100% done.
        </p>
      </div>

      <label className="block">
        <span className="text-xs text-[var(--muted)] mb-1 block">Return link</span>
        <input
          className="rl-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          maxLength={RETURN_URL_MAX}
          placeholder="https://www.skool.com/…  (link to the NEXT track)"
        />
      </label>

      <label className="block">
        <span className="text-xs text-[var(--muted)] mb-1 block">Button label</span>
        <input
          className="rl-input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={RETURN_LABEL_MAX}
          placeholder={`${DEFAULT_RETURN_LABEL} — e.g. "Continue to Track 2"`}
        />
      </label>

      {!url.trim() && (
        <p className="text-xs text-[var(--muted)]">
          Empty — learners will be sent to the community home page instead:{" "}
          <span className="font-mono break-all">{fallbackUrl}</span>
        </p>
      )}
      {err && <p className="text-sm text-[var(--brand-2)]">{err}</p>}
      {msg && <p className="text-sm text-[var(--success)]">{msg}</p>}

      <button className="btn btn-primary py-1.5 px-4 text-xs" onClick={save} disabled={busy || !dirty}>
        {busy ? "Saving…" : "Save return link"}
      </button>

      <style>{`.rl-input{width:100%;background:var(--surface-2);border:1px solid var(--border);border-radius:.5rem;padding:.5rem .7rem;font-size:.85rem;color:var(--foreground);outline:none}.rl-input:focus{border-color:var(--brand)}`}</style>
    </section>
  );
}
