import Link from "next/link";
import { ProgressBar, StatCard, Avatar } from "@/components/ui";
import type { DashboardDTO } from "@/lib/boards";

const COLOR_VAR: Record<string, string> = {
  brand: "var(--brand)", "brand-2": "var(--brand-2)", accent: "var(--accent)",
  success: "var(--success)", warning: "var(--warning)", muted: "var(--muted)",
};
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");
const rel = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

type Task = DashboardDTO["dueToday"][number];

function TaskRow({ t, tone }: { t: Task; tone?: string }) {
  return (
    <Link href={`/boards/${t.boardId}?card=${t.id}`} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[var(--surface-2)] text-sm">
      <span className="flex-1 min-w-0 truncate">{t.title}</span>
      <span className="text-xs text-[var(--muted)] truncate max-w-[6rem]">{t.boardTitle}</span>
      {t.dueDate && <span className={`text-xs whitespace-nowrap ${tone ?? "text-[var(--muted)]"}`}>{fmtDate(t.dueDate)}</span>}
    </Link>
  );
}

function List({ title, tasks, tone, empty }: { title: string; tasks: Task[]; tone?: string; empty: string }) {
  return (
    <div className="card p-4">
      <div className="text-sm font-semibold mb-2 flex items-center justify-between">
        <span>{title}</span>
        <span className="text-xs text-[var(--muted)]">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-xs text-[var(--muted)] px-2 py-1">{empty}</p>
      ) : (
        <div className="space-y-0.5">{tasks.slice(0, 6).map((t) => <TaskRow key={t.id} t={t} tone={tone} />)}</div>
      )}
    </div>
  );
}

export function Dashboard({ data }: { data: DashboardDTO }) {
  const hasAnything =
    data.openCount || data.completedCount || data.boardProgress.length || data.recentBoards.length;
  if (!hasAnything) return null;

  return (
    <div className="mb-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard value={data.openCount} label="Open tasks" icon="kanban" />
        <StatCard value={data.overdue.length} label="Overdue" icon="flame" />
        <StatCard value={data.dueToday.length} label="Due today" icon="calendar" />
        <StatCard value={data.completedCount} label="Completed" icon="check" />
      </div>

      <div className="grid gap-3 md:grid-cols-3 mb-4">
        <List title="Due today" tasks={data.dueToday} empty="Nothing due today." />
        <List title="Overdue" tasks={data.overdue} tone="text-[var(--brand-2)] font-medium" empty="No overdue tasks. 🎉" />
        <List title="Upcoming (7 days)" tasks={data.upcoming} empty="No deadlines this week." />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {/* Project progress */}
        <div className="card p-4 md:col-span-2">
          <div className="text-sm font-semibold mb-3">Project progress</div>
          {data.boardProgress.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">No boards yet.</p>
          ) : (
            <div className="space-y-3">
              {data.boardProgress.slice(0, 6).map((b) => {
                const pct = b.total ? Math.round((b.done / b.total) * 100) : 0;
                return (
                  <Link key={b.id} href={`/boards/${b.id}`} className="block group">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COLOR_VAR[b.color] ?? "var(--brand)" }} />
                        <span className="truncate group-hover:text-[var(--brand)]">{b.title}</span>
                      </span>
                      <span className="text-xs text-[var(--muted)] whitespace-nowrap">{b.done}/{b.total} · {pct}%</span>
                    </div>
                    <ProgressBar pct={pct} />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Team workload + recent boards */}
        <div className="space-y-3">
          <div className="card p-4">
            <div className="text-sm font-semibold mb-2">Team workload</div>
            {data.workload.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">No open assignments.</p>
            ) : (
              <div className="space-y-1.5">
                {data.workload.map((w) => (
                  <div key={w.userId} className="flex items-center gap-2 text-sm">
                    <Avatar name={w.name} size={24} />
                    <span className="flex-1 truncate">{w.name}</span>
                    <span className="text-xs text-[var(--muted)]">{w.open} open</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card p-4">
            <div className="text-sm font-semibold mb-2">Recently active</div>
            {data.recentBoards.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">No recent activity.</p>
            ) : (
              <div className="space-y-1">
                {data.recentBoards.map((b) => (
                  <Link key={b.id} href={`/boards/${b.id}`} className="flex items-center gap-2 text-sm py-1 px-1.5 rounded hover:bg-[var(--surface-2)]">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COLOR_VAR[b.color] ?? "var(--brand)" }} />
                    <span className="flex-1 truncate">{b.title}</span>
                    <span className="text-xs text-[var(--muted)] whitespace-nowrap">{rel(b.when)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
