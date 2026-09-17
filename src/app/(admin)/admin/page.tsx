import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getKpis, getSignupsBySource } from "@/lib/analytics";
import { PageHeader, StatCard, GoalBar } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";

export default async function AdminOverview() {
  const kpis = await getKpis(30);
  const signupSources = await getSignupsBySource();
  const [users, courses, lessons, submissions, flagged, attempts, completedEnroll, totalEnroll, pendingContent] =
    await Promise.all([
      prisma.user.count({ where: { role: "artist" } }),
      prisma.course.count(),
      prisma.lesson.count(),
      prisma.submission.count(),
      prisma.submission.count({ where: { status: "flagged" } }),
      prisma.quizAttempt.count(),
      prisma.enrollment.count({ where: { completedAt: { not: null } } }),
      prisma.enrollment.count(),
      prisma.contentSuggestion.count({ where: { status: "pending" } }),
    ]);

  // Simple activation/completion funnel.
  const enrolledUsers = await prisma.enrollment.findMany({ select: { userId: true }, distinct: ["userId"] });
  const usersWithProgress = await prisma.lessonProgress.findMany({
    where: { status: "completed" },
    select: { userId: true },
    distinct: ["userId"],
  });
  const completionRate = totalEnroll ? Math.round((completedEnroll / totalEnroll) * 100) : 0;
  const activationRate = users ? Math.round((usersWithProgress.length / users) * 100) : 0;

  const cards: { label: string; value: React.ReactNode; icon: IconName }[] = [
    { label: "Artists", value: users, icon: "community" },
    { label: "Courses", value: courses, icon: "graduation" },
    { label: "Lessons", value: lessons, icon: "book" },
    { label: "Submissions", value: submissions, icon: "clipboard" },
    { label: "Quiz attempts", value: attempts, icon: "target" },
    { label: "Course completion", value: `${completionRate}%`, icon: "check" },
  ];

  return (
    <div className="max-w-5xl">
      <PageHeader title="Overview" subtitle="Your audience in one place" />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {cards.map((c) => (
          <StatCard key={c.label} value={c.value} label={c.label} icon={c.icon} />
        ))}
      </div>

      <section className="card p-5 mb-4">
        <h2 className="text-sm font-semibold mb-4">Activity (last 30 days)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="Active users" value={kpis.activeUsers} />
          <Kpi label="Lessons done" value={kpis.lessonCompletions} />
          <Kpi label="Quiz passes" value={kpis.quizPasses} />
          <Kpi label="Submissions" value={kpis.assignmentSubmits} />
          <Kpi label="Coach msgs" value={kpis.coachMessages} />
          <Kpi label="Audits run" value={kpis.auditRuns} />
          <Kpi label="Missions" value={kpis.missionCompletions} />
          <Kpi label="Signups" value={kpis.signups} />
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-4">Engagement funnel</h2>
          <div className="space-y-3">
            <GoalBar label={<FunnelLabel text="Signed up" value={users} />} pct={pct(users, users)} />
            <GoalBar label={<FunnelLabel text="Enrolled" value={enrolledUsers.length} />} pct={pct(enrolledUsers.length, users)} />
            <GoalBar
              label={<FunnelLabel text="Activated (≥1 lesson)" value={usersWithProgress.length} />}
              pct={pct(usersWithProgress.length, users)}
            />
            <GoalBar label={<FunnelLabel text="Completed a course" value={completedEnroll} />} pct={pct(completedEnroll, users)} />
          </div>
          <p className="text-xs text-[var(--muted)] mt-4">
            Activation rate: <strong className="text-[var(--foreground)]">{activationRate}%</strong>
          </p>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-4">Critical</h2>
          <AttentionRow label="Submissions flagged for review" value={flagged} href="/admin/submissions" />
          <AttentionRow label="AI content suggestions pending" value={pendingContent} href="/admin/content" />
        </div>

        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-4">Signup source</h2>
          {signupSources.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No signups yet.</p>
          ) : (
            <ul className="space-y-2">
              {signupSources.map((s) => (
                <li key={s.source ?? "direct"} className="flex items-center justify-between text-sm">
                  <span className={s.source ? "" : "text-[var(--muted)]"}>{s.source ?? "Direct / untagged"}</span>
                  <span className="font-bold tabular-nums">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-[var(--muted)] mt-3">
            Tagged by the <code>?ref=</code> on the link the artist arrived through.
          </p>
        </div>
      </div>
    </div>
  );
}

const pct = (value: number, max: number) => (max ? Math.round((value / max) * 100) : 0);

// Keeps the absolute count visible next to each funnel stage, not just the %.
function FunnelLabel({ text, value }: { text: string; value: number }) {
  return (
    <span className="flex items-center justify-between gap-2">
      <span>{text}</span>
      <span className="text-xs text-[var(--muted)] tabular-nums">{value}</span>
    </span>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[var(--border)] rounded-lg p-3 text-center">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-xs text-[var(--muted)] mt-0.5">{label}</div>
    </div>
  );
}

function AttentionRow({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--border)] last:border-0 group"
    >
      <span className="text-sm text-[var(--muted)] group-hover:text-[var(--foreground)] transition">{label}</span>
      <span className="flex items-center gap-2 shrink-0">
        <span className={`text-sm font-bold tabular-nums ${value > 0 ? "text-[var(--brand)]" : "text-[var(--muted)]"}`}>
          {value}
        </span>
        <Icon name="chevronRight" size={14} className="text-[var(--muted)]" />
      </span>
    </Link>
  );
}
