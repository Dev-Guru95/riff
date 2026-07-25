"use client";

import { useState } from "react";

type Plan = { summary: string; milestones: { title: string; tasks: string[] }[] };
const HORIZONS: { key: "30d" | "90d" | "6m" | "12m"; label: string }[] = [
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "6m", label: "6 months" },
  { key: "12m", label: "12 months" },
];

export function RoadmapClient({ initial }: { initial: Record<string, Plan> }) {
  const [plans, setPlans] = useState<Record<string, Plan>>(initial);
  const [horizon, setHorizon] = useState<"30d" | "90d" | "6m" | "12m">("30d");
  const [loading, setLoading] = useState(false);

  const current = plans[horizon];

  async function generate() {
    setLoading(true);
    const res = await fetch("/api/roadmap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ horizon }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setPlans((p) => ({ ...p, [horizon]: data.plan }));
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {HORIZONS.map((h) => (
          <button
            key={h.key}
            onClick={() => setHorizon(h.key)}
            className={`text-sm px-4 py-2 rounded-lg ${horizon === h.key ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}
          >
            {h.label}
          </button>
        ))}
      </div>

      {!current ? (
        <div className="card p-8 text-center">
          <p className="text-[var(--muted)] mb-4">No {HORIZONS.find((h) => h.key === horizon)?.label} plan yet.</p>
          <button className="btn btn-primary" onClick={generate} disabled={loading}>
            {loading ? "Generating…" : `Generate my ${HORIZONS.find((h) => h.key === horizon)?.label} roadmap`}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card p-5">
            <p className="text-sm leading-relaxed">{current.summary}</p>
          </div>
          <div className="space-y-3">
            {current.milestones.map((m, i) => (
              <div key={i} className="card p-5">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[var(--brand)] text-white text-xs flex items-center justify-center">{i + 1}</span>
                  {m.title}
                </h3>
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
        </div>
      )}
    </div>
  );
}
