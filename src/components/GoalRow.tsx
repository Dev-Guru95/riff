import type { Goal } from "@/lib/goals";

// A single daily/weekly goal row with progress. Presentational (server-safe).
export function GoalRow({ goal, cadence }: { goal: Goal; cadence: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`text-xl ${goal.done ? "" : "opacity-70"}`}>{goal.done ? "✅" : goal.icon}</span>
      <div className="flex-1">
        <div className="text-sm flex justify-between">
          <span className={goal.done ? "text-[var(--success)]" : ""}>
            {goal.label} <span className="text-xs text-[var(--muted)]">· {cadence}</span>
          </span>
          <span className="text-xs text-[var(--muted)]">
            {goal.progress}/{goal.target}
          </span>
        </div>
        <div className="progress-track h-1.5 mt-1">
          <div className="progress-fill" style={{ width: `${goal.pct}%` }} />
        </div>
      </div>
    </div>
  );
}
