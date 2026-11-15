"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Mission = {
  id: string;
  title: string;
  description: string;
  category: string;
  xpReward: number;
  status: string;
  proof?: string | null;
};

const CATEGORY_ICON: Record<string, string> = { branding: "🎨", content: "📸", engagement: "💬", release: "🚀" };

export function MissionCard({ mission, locked = false }: { mission: Mission; locked?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // The proof form stays collapsed until the artist says they've done the work,
  // so the list reads as a list rather than a wall of inputs.
  const [proving, setProving] = useState(false);
  const [proof, setProof] = useState("");
  const done = mission.status === "completed";

  async function complete() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/missions/${mission.id}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proof }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast(`+${data.xp?.awarded ?? mission.xpReward} XP · 🔥 ${data.streak?.currentLen}-day streak`);
        setProving(false);
        setTimeout(() => {
          setToast(null);
          router.refresh();
        }, 1800);
      } else {
        setErr(data.error ?? "Could not complete this mission.");
      }
    } catch {
      setErr("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`card p-5 ${done ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
            <span className="text-lg">{CATEGORY_ICON[mission.category] ?? "🎯"}</span>
            <span className="font-semibold">{mission.title}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--muted)]">{mission.category}</span>
          </div>
          <p className="text-sm text-[var(--muted)]">{mission.description}</p>
          <div className="text-xs text-[var(--accent)] mt-2">+{mission.xpReward} XP</div>
        </div>

        {done ? (
          <span className="text-[var(--success)] text-sm font-medium whitespace-nowrap">✓ Done</span>
        ) : locked ? (
          <span className="text-xs px-2 py-1 rounded-full bg-[var(--surface-2)] text-[var(--muted)] whitespace-nowrap shrink-0">
            🔒 Pro
          </span>
        ) : !proving ? (
          <button
            className="btn btn-primary py-2 px-4 text-sm whitespace-nowrap shrink-0"
            onClick={() => setProving(true)}
          >
            I&apos;ve done this
          </button>
        ) : null}
      </div>

      {/* Proof. XP, badges and leaderboard points are real, so completing a
          mission asks what you actually did rather than taking your word. */}
      {proving && !done && !locked && (
        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <label htmlFor={`proof-${mission.id}`} className="block text-sm font-medium mb-1">
            What did you do?
          </label>
          <p className="text-xs text-[var(--muted)] mb-2">
            Paste a link to the post, track or page — or write a sentence or two about what you did.
          </p>
          <textarea
            id={`proof-${mission.id}`}
            value={proof}
            onChange={(e) => setProof(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="https://instagram.com/p/… or: Rewrote my bio and updated it on Spotify and Instagram."
            className="w-full rounded-lg bg-[var(--surface-2)] border border-[var(--border)] p-2.5 text-sm"
          />
          <div className="flex items-center gap-2 mt-2">
            <button className="btn btn-primary py-2 px-4 text-sm" onClick={complete} disabled={loading || proof.trim().length < 10}>
              {loading ? "…" : "Complete mission"}
            </button>
            <button
              className="btn btn-ghost py-2 px-4 text-sm"
              onClick={() => {
                setProving(false);
                setErr(null);
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <span className="text-xs text-[var(--muted)] ml-auto">{proof.trim().length}/500</span>
          </div>
        </div>
      )}

      {/* What they submitted, kept visible so it can be checked later. */}
      {done && mission.proof && (
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <div className="text-xs text-[var(--muted)] mb-1">Your proof</div>
          <p className="text-sm break-words">{mission.proof}</p>
        </div>
      )}

      {locked && (
        <div className="mt-3 border-t border-[var(--border)] pt-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-[var(--muted)]">Weekly missions are part of Pro.</p>
          <Link href="/pricing" className="btn btn-primary py-1.5 px-3 text-sm">
            Upgrade
          </Link>
        </div>
      )}

      {err && <p className="mt-2 text-xs text-[var(--brand-2)]">{err}</p>}
      {toast && <div className="mt-3 text-sm text-[var(--success)] font-semibold animate-pop">{toast}</div>}
    </div>
  );
}
