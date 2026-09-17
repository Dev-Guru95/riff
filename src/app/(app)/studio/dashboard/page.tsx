import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveLevel } from "@/lib/constants";
import { listFinance } from "@/lib/studio-tools";
import { listGoals } from "@/lib/studio-growth";
import { PageHeader, Breadcrumb, StatCard, GoalBar } from "@/components/ui";
import { Icon } from "@/components/icons";

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

  return (
    <main className="max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb href="/studio" label="Studio" />
      <PageHeader
        title="Career Dashboard"
        subtitle="Your whole music career at a glance — pulled from across Riff."
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <StatCard value={lv.levelName} label={`${level?.totalXp ?? 0} XP`} icon="zap" />
        <StatCard value={`${streak?.currentLen ?? 0}d`} label={`Streak · best ${streak?.longestLen ?? 0}d`} icon="flame" />
        <StatCard value={badgeCount} label="Badges" icon="award" />
        <StatCard
          value={<span className={finance.totals.net < 0 ? "text-[var(--brand-2)]" : "text-[var(--success)]"}>{money(finance.totals.net)}</span>}
          label="Net revenue"
          icon="dollar"
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard value={fanCount} label="Fans" icon="community" />
        <StatCard value={boardCount} label="Boards" icon="kanban" />
        <StatCard value={openTasks} label="Open tasks" icon="check" />
        <StatCard value={gigCount} label="Gigs" icon="flag" />
      </div>

      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm">Goal progress</h2>
          <Link href="/studio/goals" className="text-xs text-[var(--accent)] flex items-center gap-1">
            Manage goals <Icon name="chevronRight" size={12} />
          </Link>
        </div>
        {active.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No active goals. <Link href="/studio/goals" className="text-[var(--accent)]">Set one →</Link></p>
        ) : (
          <div className="space-y-3">
            {active.slice(0, 5).map((g) => (
              <GoalBar key={g.id} label={g.title} pct={g.progress} />
            ))}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-3 text-sm">
        <Link href="/studio/finance" className="card px-4 py-3 hover:border-[var(--brand)] transition">
          <span className="font-medium">Revenue</span>
          <span className="text-[var(--muted)]"> &middot; {money(finance.totals.income)} in / {money(finance.totals.expense)} out</span>
        </Link>
        <Link href="/studio/fans" className="card px-4 py-3 hover:border-[var(--brand)] transition">
          <span className="font-medium">Fan CRM</span>
          <span className="text-[var(--muted)]"> &middot; {fanCount} fans</span>
        </Link>
        <Link href="/boards" className="card px-4 py-3 hover:border-[var(--brand)] transition">
          <span className="font-medium">Projects</span>
          <span className="text-[var(--muted)]"> &middot; {openTasks} open</span>
        </Link>
      </div>
    </main>
  );
}
