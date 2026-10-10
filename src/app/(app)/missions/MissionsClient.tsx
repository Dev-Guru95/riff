"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mission = { id: string; title: string; description: string; category: string; xpReward: number; status: string };

const CATEGORY_ICON: Record<string, string> = { branding: "🎨", content: "📸", engagement: "💬", release: "🚀" };

export function MissionCard({ mission }: { mission: Mission }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const done = mission.status === "completed";

  async function complete() {
    setLoading(true);
    const res = await fetch(`/api/missions/${mission.id}/complete`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setToast(`+${data.xp?.awarded ?? mission.xpReward} XP · 🔥 ${data.streak?.currentLen}-day streak`);
      setTimeout(() => { setToast(null); router.refresh(); }, 1800);
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
        ) : (
          <button className="btn btn-primary py-2 px-4 text-sm whitespace-nowrap shrink-0" onClick={complete} disabled={loading}>
            {loading ? "…" : "Mark done"}
          </button>
        )}
      </div>
      {toast && (
        <div className="mt-3 text-sm text-[var(--success)] font-semibold animate-pop">{toast}</div>
      )}
    </div>
  );
}
