import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveLevel } from "@/lib/constants";
import { getCourseTree } from "@/lib/progression";
import { getUserRanks } from "@/lib/leaderboard";
import { getMilestones } from "@/lib/milestones";
import { getDailyGoal, getWeeklyGoals } from "@/lib/goals";
import { getProgramProgress } from "@/lib/certificates";
import { PROGRAM_KEY } from "@/lib/constants";
import { buildShare } from "@/lib/share";
import { ProgressBar, ProgressRing, Stat, Badge } from "@/components/ui";
import { ShareToSkool } from "@/components/ShareToSkool";
import { GoalRow } from "@/components/GoalRow";

export default async function Dashboard() {
  // Layouts and pages render in parallel, so the layout's auth redirect is not a
  // guarantee this page has a session by the time it runs — check it here too
  // rather than asserting non-null and crashing the whole segment.
  const session = await getSession();
  if (!session) redirect("/login");

  const [level, streak, profile, badges, allBadges, enrollment, ranks] = await Promise.all([
    prisma.userLevel.findUnique({ where: { userId: session.id } }),
    prisma.streak.findUnique({ where: { userId: session.id } }),
    prisma.artistProfile.findUnique({ where: { userId: session.id } }),
    prisma.userBadge.findMany({ where: { userId: session.id }, include: { badge: true } }),
    // Explicit ordering is required: Postgres returns rows in whatever order it
    // likes, so an unordered findMany() made the Achievements section reshuffle
    // between page loads. `key` is the tiebreaker so the order is total, and
    // therefore identical on every render.
    prisma.badge.findMany({ orderBy: [{ orderIndex: "asc" }, { key: "asc" }] }),
    prisma.enrollment.findFirst({ where: { userId: session.id }, include: { course: true }, orderBy: { startedAt: "asc" } }),
    getUserRanks(session.id),
  ]);
  const [milestones, dailyGoal, weeklyGoals, programProgress, certificate] = await Promise.all([
    getMilestones(session.id),
    getDailyGoal(session.id),
    getWeeklyGoals(session.id),
    getProgramProgress(session.id),
    prisma.certificate.findUnique({
      where: { userId_programKey: { userId: session.id, programKey: PROGRAM_KEY } },
    }),
  ]);

  const totalXp = level?.totalXp ?? 0;
  const lvl = resolveLevel(totalXp);
  const stageName = profile?.stageName ?? null;

  // Next best action: first non-completed unlocked lesson in the enrolled course.
  let nextLesson: { id: string; title: string; courseTitle: string } | null = null;
  let courseProgress = 0;
  if (enrollment) {
    const tree = await getCourseTree(enrollment.courseId, session.id);
    courseProgress = tree?.progressPct ?? 0;
    const flat = tree?.modules.flatMap((m) => m.lessons) ?? [];
    const next = flat.find((l) => l.status === "available" || l.status === "in_progress");
    if (next) nextLesson = { id: next.id, title: next.title, courseTitle: enrollment.course.title };
  }

  const earnedKeys = new Set(badges.map((b) => b.badge.key));

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Hey {profile?.stageName ?? "artist"} 👋</h1>
          <p className="text-[var(--muted)] text-sm">
            Level {lvl.levelIndex + 1} · <span className="text-[var(--brand)] font-medium">{lvl.levelName}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ProgressRing pct={lvl.progressPct} label={`${totalXp} XP`} size={72} />
          <div className="flex flex-col gap-2">
            <div className="text-xs text-[var(--muted)] max-w-[140px]">
              {lvl.isMax ? "Max level reached!" : `${lvl.xpForNextLevel - lvl.xpIntoLevel} XP to ${lvl.nextLevelName}`}
            </div>
            <ShareToSkool
              share={buildShare({ kind: "level", value: lvl.levelName, stageName })}
              label="Share progress"
              size="sm"
              variant="ghost"
            />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon="🔥" value={streak?.currentLen ?? 0} label="Day streak" />
        <Stat icon="⚡" value={totalXp} label="Total XP" />
        <Stat icon="🏅" value={badges.length} label="Badges" />
        <Stat icon="🏆" value={ranks?.globalRank ? `#${ranks.globalRank}` : "—"} label="Global rank" />
      </div>

      {/* Next best action */}
      <section className="card p-6">
        <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">Your next move</h2>
        {nextLesson ? (
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-xs text-[var(--accent)]">{nextLesson.courseTitle}</div>
              <div className="text-lg font-semibold">{nextLesson.title}</div>
              <div className="mt-2 w-56"><ProgressBar pct={courseProgress} /></div>
              <div className="text-xs text-[var(--muted)] mt-1">{courseProgress}% of course complete</div>
            </div>
            <Link href={`/learn/${nextLesson.id}`} className="btn btn-primary px-6 py-3">Continue →</Link>
          </div>
        ) : enrollment ? (
          <div className="flex items-center justify-between">
            <p className="text-[var(--success)] font-medium">🎉 Course complete! Explore more courses.</p>
            <Link href="/courses" className="btn btn-ghost">Browse courses</Link>
          </div>
        ) : (
          <Link href="/courses" className="btn btn-primary">Enroll in a course</Link>
        )}
      </section>

      {/* Daily & weekly goals */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide">Your goals</h2>
          <span className="text-xs text-[var(--muted)]">Resets daily · weekly</span>
        </div>
        <div className="space-y-3">
          <GoalRow goal={dailyGoal} cadence="Today" />
          {weeklyGoals.map((g) => (
            <GoalRow key={g.key} goal={g} cadence="This week" />
          ))}
        </div>
      </section>

      {/* Ranks */}
      <section className="grid sm:grid-cols-3 gap-3">
        <Stat icon="🌍" value={ranks?.globalRank ? `#${ranks.globalRank}` : "—"} label="Global rank" />
        <Stat icon="📍" value={ranks?.countryRank ? `#${ranks.countryRank}` : "—"} label="Country rank" />
        <Stat icon="🎵" value={ranks?.genreRank ? `#${ranks.genreRank}` : "—"} label="Genre rank" />
      </section>
      {ranks?.globalRank ? (
        <div className="flex justify-center -mt-2">
          <ShareToSkool
            share={buildShare({ kind: "leaderboard", value: ranks.globalRank, stageName, detail: "Climbing the Riff ranks." })}
            label="Share your rank"
            size="sm"
            variant="ghost"
          />
        </div>
      ) : null}

      {/* Tools */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">Your toolkit</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { href: "/coach", icon: "🤖", title: "AI Coach", body: "Personalized mentor" },
            { href: "/missions", icon: "🎯", title: "Missions", body: "Weekly challenges" },
            { href: "/audit", icon: "📈", title: "Social Audit", body: "Track real growth" },
            { href: "/roadmap", icon: "🧭", title: "Roadmap", body: "30/90-day plans" },
            { href: "/community", icon: "🤝", title: "Community", body: "Join on Skool" },
            { href: "/leaderboard", icon: "🏆", title: "Leaderboard", body: "Global ranks" },
            { href: "/certificates", icon: "🎓", title: "Certificates", body: "Your credentials" },
          ].map((t) => (
            <Link key={t.href} href={t.href} className="card p-4 hover:border-[var(--brand)] transition">
              <div className="text-2xl mb-1">{t.icon}</div>
              <div className="font-semibold text-sm">{t.title}</div>
              <div className="text-xs text-[var(--muted)]">{t.body}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Milestones */}
      <section className="card p-6">
        <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-4">Milestones</h2>
        <div className="space-y-3">
          {milestones.map((m) => (
            <div key={m.key} className="flex items-center gap-3">
              <span className={`text-xl ${m.achieved ? "" : "grayscale opacity-50"}`}>{m.icon}</span>
              <div className="flex-1">
                <div className="text-sm flex justify-between">
                  <span className={m.achieved ? "text-[var(--success)]" : ""}>{m.title}</span>
                  <span className="text-xs text-[var(--muted)]">{m.progress}/{m.target}</span>
                </div>
                <div className="progress-track h-1.5 mt-1"><div className="progress-fill" style={{ width: `${(m.progress / m.target) * 100}%` }} /></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Achievements: certificate + badges */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide">Achievements</h2>
          <span className="text-xs text-[var(--muted)]">{badges.length} badge{badges.length === 1 ? "" : "s"} earned</span>
        </div>

        {/* Program certificate strip */}
        <Link
          href="/certificates"
          className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-3 mb-4 hover:border-[var(--brand)] transition"
        >
          <span className="text-2xl">🎓</span>
          <div className="flex-1">
            <div className="text-sm font-semibold">
              {certificate ? "Program certificate earned" : "Program certificate"}
            </div>
            <div className="text-xs text-[var(--muted)]">
              {certificate
                ? "Tap to view and share your credential"
                : programProgress.total === 0
                  ? "No tracks published yet"
                  : `${programProgress.completed}/${programProgress.total} tracks complete — finish all to unlock`}
            </div>
          </div>
          {!certificate && programProgress.total > 0 && (
            <span className="text-xs text-[var(--muted)]">{Math.round((programProgress.completed / programProgress.total) * 100)}%</span>
          )}
          {certificate && <span className="text-xs text-[var(--success)]">✓ View</span>}
        </Link>

        <div className="flex flex-wrap gap-2">
          {allBadges.map((b) => (
            <Badge key={b.key} badgeKey={b.key} icon={b.icon} name={b.name} dim={!earnedKeys.has(b.key)} />
          ))}
        </div>
      </section>
    </main>
  );
}
