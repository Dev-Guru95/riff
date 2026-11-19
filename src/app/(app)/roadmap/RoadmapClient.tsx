"use client";

import { useState } from "react";
import Link from "next/link";

type Plan = { summary: string; milestones: { title: string; why?: string; tasks: string[] }[] };
type HorizonKey = "30d" | "90d" | "6m" | "12m";

const HORIZONS: { key: HorizonKey; label: string; blurb: string }[] = [
  { key: "30d", label: "30 days", blurb: "What to do this month to get moving." },
  { key: "90d", label: "90 days", blurb: "A release cycle: build, launch, follow through." },
  { key: "6m", label: "6 months", blurb: "Two cycles — compounding audience and catalogue." },
  { key: "12m", label: "12 months", blurb: "The year: positioning, revenue and the next level." },
];

export function RoadmapClient({
  initial,
  allowedHorizons,
  plan,
}: {
  initial: Record<string, Plan>;
  /** Horizons this plan may generate. Free is the 30-day plan. */
  allowedHorizons: readonly string[];
  plan: "free" | "pro" | "premium";
}) {
  const [plans, setPlans] = useState<Record<string, Plan>>(initial);
  const [horizon, setHorizon] = useState<HorizonKey>("30d");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const current = plans[horizon];
  const meta = HORIZONS.find((h) => h.key === horizon)!;
  const locked = !allowedHorizons.includes(horizon);

  async function generate() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/roadmap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ horizon }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.plan) {
        setPlans((p) => ({ ...p, [horizon]: data.plan }));
      } else {
        // Previously swallowed: a refused generation left the button looking
        // broken with no explanation.
        setErr(data.error ?? "Could not generate that roadmap. Try again.");
      }
    } catch {
      setErr("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        {HORIZONS.map((h) => {
          const on = horizon === h.key;
          const isLocked = !allowedHorizons.includes(h.key);
          return (
            <button
              key={h.key}
              onClick={() => {
                setHorizon(h.key);
                setErr(null);
              }}
              className={`text-sm px-4 py-2 rounded-lg transition ${
                on ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {h.label}
              {isLocked && <span className="ml-1.5 opacity-80">🔒</span>}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-[var(--muted)]">{meta.blurb}</p>

      {locked ? (
        // A clear, honest wall rather than a button that fails when pressed.
        <div className="card p-6 sm:p-8 text-center border-[var(--brand)]">
          <div className="text-2xl mb-2">🔒</div>
          <h2 className="font-semibold">{meta.label} planning is part of Pro</h2>
          <p className="text-sm text-[var(--muted)] mt-2 max-w-md mx-auto">
            Your 30-day roadmap is always free. Pro unlocks the 90-day, 6-month and 12-month plans — each one
            generated from your real goals, genre, audit scores and progress, and regenerated whenever your numbers
            change.
          </p>
          <Link href="/pricing" className="btn btn-primary mt-4 inline-flex">See Pro plans</Link>
          {plan === "free" && (
            <p className="text-xs text-[var(--muted)] mt-3">
              Switch to the 30-day view to generate your free plan now.
            </p>
          )}
        </div>
      ) : !current ? (
        <div className="card p-8 text-center">
          <p className="text-[var(--muted)] mb-4">No {meta.label} plan yet.</p>
          <button className="btn btn-primary" onClick={generate} disabled={loading}>
            {loading ? "Generating…" : `Generate my ${meta.label} roadmap`}
          </button>
          {err && <p className="text-xs text-[var(--brand-2)] mt-3">{err}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card p-5">
            <p className="text-sm leading-relaxed">{current.summary}</p>
          </div>
          <div className="space-y-3">
            {current.milestones.map((m, i) => (
              <div key={i} className="card p-5">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[var(--brand)] text-white text-xs flex items-center justify-center shrink-0">{i + 1}</span>
                  {m.title}
                </h3>
                {/* What this stage buys you. Without it the roadmap read as a
                    to-do list rather than a plan. */}
                {m.why && <p className="text-sm text-[var(--muted)] mb-3 leading-relaxed">{m.why}</p>}
                <ul className="space-y-2">
                  {m.tasks.map((t, ti) => (
                    <li key={ti} className="flex items-start gap-2 text-sm">
                      <span className="text-[var(--accent)] mt-0.5">○</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <button className="btn btn-ghost w-full" onClick={generate} disabled={loading}>
            {loading ? "Regenerating…" : "Regenerate from my latest data"}
          </button>
          {err && <p className="text-xs text-[var(--brand-2)]">{err}</p>}
        </div>
      )}
    </div>
  );
}
