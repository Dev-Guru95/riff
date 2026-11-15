"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { countryOptions, GENRES, MAX_GENRES } from "@/lib/profile-options";

/**
 * Artist name, country and genre. Country and genre are what the Country and
 * Genre leaderboards rank on — before this form there was no way to set them,
 * so both ranks showed "—" forever.
 */
export function ProfileForm({
  initialStageName,
  initialCountryCode,
  initialGenres,
}: {
  initialStageName: string;
  initialCountryCode: string | null;
  initialGenres: string[];
}) {
  const router = useRouter();
  const countries = countryOptions();

  const [stageName, setStageName] = useState(initialStageName);
  const [countryCode, setCountryCode] = useState(initialCountryCode ?? "");
  const [genres, setGenres] = useState<string[]>(initialGenres);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function toggleGenre(value: string) {
    setGenres((cur) =>
      cur.includes(value) ? cur.filter((g) => g !== value) : cur.length >= MAX_GENRES ? cur : [...cur, value],
    );
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stageName: stageName.trim() || undefined,
          countryCode: countryCode || null,
          genres,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        setMsg("Saved.");
        router.refresh();
      } else {
        setErr(d.error ?? "Could not save your profile.");
      }
    } catch {
      setErr("Could not reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="stageName" className="block text-sm font-medium mb-1">Artist name</label>
        <input
          id="stageName"
          value={stageName}
          onChange={(e) => setStageName(e.target.value)}
          maxLength={60}
          placeholder="How you want to appear on the leaderboard"
          className="w-full rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="countryCode" className="block text-sm font-medium mb-1">Country</label>
        <select
          id="countryCode"
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
          className="w-full rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
        >
          <option value="">Not set</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
        <p className="text-xs text-[var(--muted)] mt-1">Sets your Country rank on the leaderboard.</p>
      </div>

      <div>
        <span className="block text-sm font-medium mb-1">
          Genres <span className="text-[var(--muted)] font-normal">(up to {MAX_GENRES})</span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          {GENRES.map((g) => {
            const on = genres.includes(g.value);
            const full = !on && genres.length >= MAX_GENRES;
            return (
              <button
                key={g.value}
                type="button"
                onClick={() => toggleGenre(g.value)}
                disabled={full}
                aria-pressed={on}
                className={`text-xs px-2.5 py-1 rounded-full border transition ${
                  on
                    ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                    : `bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)] ${full ? "opacity-40 cursor-not-allowed" : "hover:text-[var(--foreground)]"}`
                }`}
              >
                {g.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[var(--muted)] mt-1.5">
          {genres.length > 0
            ? `Your Genre rank uses the first one: ${GENRES.find((g) => g.value === genres[0])?.label}.`
            : "Pick at least one to get a Genre rank."}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </button>
        {msg && <span className="text-xs text-[var(--success)]">{msg}</span>}
        {err && <span className="text-xs text-[var(--brand-2)]">{err}</span>}
      </div>
    </div>
  );
}
