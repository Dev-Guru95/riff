import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getKpis } from "@/lib/analytics";

export default async function AdminOverview() {
  const kpis = await getKpis(30);
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

  const cards = [
    { label: "Artists", value: users, icon: "👥" },
    { label: "Courses", value: courses, icon: "🎓" },
    { label: "Lessons", value: lessons, icon: "📚" },
    { label: "Submissions", value: submissions, icon: "📝" },
    { label: "Quiz attempts", value: attempts, icon: "🧠" },
    { label: "Course completion", value: `${completionRate}%`, icon: "✅" },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className="text-2xl mb-1">{c.icon}</div>
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-xs text-[var(--muted)]">{c.label}</div>
          </div>
        ))}
      </div>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-4">Activity — last 30 days (event-tracked)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
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

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-4">Engagement funnel</h2>
          <FunnelRow label="Signed up" value={users} max={users} />
          <FunnelRow label="Enrolled" value={enrolledUsers.length} max={users} />
          <FunnelRow label="Activated (≥1 lesson)" value={usersWithProgress.length} max={users} />
          <FunnelRow label="Completed a course" value={completedEnroll} max={users} />
          <p className="text-xs text-[var(--muted)] mt-3">Activation rate: <strong>{activationRate}%</strong></p>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-4">Needs attention</h2>
          <AttentionRow label="Submissions flagged for review" value={flagged} href="/admin/submissions" />
          <AttentionRow label="AI content suggestions pending" value={pendingContent} href="/admin/content" />
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--surface-2)] rounded-lg p-3">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
}

function FunnelRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1"><span>{label}</span><span className="text-[var(--muted)]">{value}</span></div>
      <div className="progress-track h-2"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function AttentionRow({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0 hover:text-[var(--accent)] transition">
      <span className="text-sm">{label}</span>
      <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${value > 0 ? "bg-[var(--brand)] text-white" : "text-[var(--muted)]"}`}>{value}</span>
    </Link>
  );
}
