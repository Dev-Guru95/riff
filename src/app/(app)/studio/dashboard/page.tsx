import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveLevel } from "@/lib/constants";
import { listFinance } from "@/lib/studio-tools";
import { listGoals } from "@/lib/studio-growth";
import { Stat, ProgressBar } from "@/components/ui";

export const metadata = { title: "Career Dashboard — Riff" };

const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default async function CareerDashboardPage() {
  const session = (await getSession())!;
  const uid = session.id;
  const [level, streak, finance, goals, fanCount, boardCount, openTasks, badgeCount, gigCount] = await Promise.all([
    prisma.userLevel.findUnique({ where: { userId: uid } }),
    prisma.streak.findUnique({ where: { userId: uid } }),
    listFinance(uid),
    listGoals(uid),
    prisma.fan.count({ where: { userId: uid } }),
    prisma.boardMember.count({ where: { userId: uid } }),
    prisma.card.count({ where: { archived: false, completion: { lt: 100 }, assignees: { some: { userId: uid } } } }),
    prisma.userBadge.count({ where: { userId: uid } }),
    prisma.gig.count({ where: { userId: uid } }),
  ]);
  const lv = resolveLevel(level?.totalXp ?? 0);
  const active = goals.filter((g) => g.status === "active");
  const avg = active.length ? Math.round(active.reduce((n, g) => n + g.progress, 0) / active.length) : 0;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/studio" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">← Studio</Link>
      <h1 className="text-2xl font-bold flex items-center gap-2 mt-1">📊 Career Dashboard</h1>
      <p className="text-sm text-[var(--muted)] mb-6">Your whole music career at a glance — pulled from across Riff.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat icon="⭐" value={lv.levelName} label={`${level?.totalXp ?? 0} XP`} />
        <Stat icon="🔥" value={`${streak?.currentLen ?? 0}d`} label={`Streak · best ${streak?.longestLen ?? 0}d`} />
        <Stat icon="🏅" value={badgeCount} label="Badges" />
        <Stat icon="🧮" value={<span className={finance.totals.net < 0 ? "text-[var(--brand-2)]" : "text-[var(--success)]"}>{money(finance.totals.net)}</span>} label="Net revenue" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat icon="👥" value={fanCount} label="Fans" />
        <Stat icon="🗂️" value={boardCount} label="Boards" />
        <Stat icon="✅" value={openTasks} label="Open tasks" />
        <Stat icon="🎤" value={gigCount} label="Gigs" />
      </div>

      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">Goal progress</h2>
          <Link href="/studio/goals" className="text-xs text-[var(--accent)]">Manage goals →</Link>
        </div>
        {active.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No active goals. <Link href="/studio/goals" className="text-[var(--accent)]">Set one →</Link></p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <ProgressBar pct={avg} /><span className="text-xs text-[var(--muted)] w-10 text-right">{avg}%</span>
            </div>
            <div className="space-y-2">
              {active.slice(0, 5).map((g) => (
                <div key={g.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">{g.title}</span>
                  <div className="w-28"><ProgressBar pct={g.progress} /></div>
                  <span className="text-xs text-[var(--muted)] w-8 text-right">{g.progress}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-3 text-sm">
        <Link href="/studio/finance" className="card p-3 hover:border-[var(--brand)]">💰 <span className="font-medium">Revenue</span> · {money(finance.totals.income)} in / {money(finance.totals.expense)} out</Link>
        <Link href="/studio/fans" className="card p-3 hover:border-[var(--brand)]">👥 <span className="font-medium">Fan CRM</span> · {fanCount} fans</Link>
        <Link href="/boards" className="card p-3 hover:border-[var(--brand)]">🗂️ <span className="font-medium">Projects</span> · {openTasks} open</Link>
      </div>
    </main>
  );
}
