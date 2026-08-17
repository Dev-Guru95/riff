import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getCourseTree } from "@/lib/progression";
import { trackBadgeMeta } from "@/lib/gamification";
import { badgeAsset } from "@/lib/assets";
import { buildShare } from "@/lib/share";
import { ProgressBar } from "@/components/ui";
import { ShareToSkool } from "@/components/ShareToSkool";
import { TrackReturnButton } from "@/components/TrackReturnLink";
import { resolveReturnLink } from "@/lib/returnLink";

export default async function CourseDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = (await getSession())!;
  const course = await prisma.course.findUnique({ where: { slug } });
  if (!course) notFound();

  // Ensure enrollment exists (idempotent).
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: session.id, courseId: course.id } },
    create: { userId: session.id, courseId: course.id },
    update: {},
  });

  const tree = (await getCourseTree(course.id, session.id))!;
  const completed = tree.progressPct === 100;
  const badge = trackBadgeMeta(course);
  const profile = completed
    ? await prisma.artistProfile.findUnique({ where: { userId: session.id }, select: { stageName: true } })
    : null;
  // Closes the Skool ⇄ Riff loop: finishing the track hands the learner back,
  // normally to the next Skool track. Also reachable on a revisit, so someone
  // who closed the completion screen can still pick the cycle back up.
  const returnLink = resolveReturnLink(course);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/courses" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">← All courses</Link>
      <h1 className="text-2xl font-bold mt-2">{tree.title}</h1>
      <p className="text-[var(--muted)] text-sm mt-1 mb-4">{tree.description}</p>

      {completed && (
        <div className="card p-5 mb-6 flex items-center gap-4 flex-wrap border-[var(--brand)]">
          {/* Placeholder track-badge art — swap public/badges/track.svg to reskin. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={badgeAsset(badge.key)} alt="" width={56} height={56} className="shrink-0" />
          <div className="flex-1 min-w-40">
            <div className="text-xs text-[var(--success)] uppercase tracking-wide">Track complete</div>
            <div className="font-semibold">{badge.name}</div>
            <div className="text-xs text-[var(--muted)]">This track badge is now yours. 🎉</div>
          </div>
          <div className="flex items-center gap-2">
            <ShareToSkool
              share={buildShare({ kind: "badge", value: badge.name, stageName: profile?.stageName, detail: badge.icon })}
              size="sm"
              variant="ghost"
            />
            <TrackReturnButton link={returnLink} className="py-1.5 px-3 text-xs" />
          </div>
        </div>
      )}

      <div className="mb-8">
        <ProgressBar pct={tree.progressPct} />
        <div className="text-xs text-[var(--muted)] mt-1">
          {tree.completedCount}/{tree.lessonCount} lessons · {tree.progressPct}% complete
        </div>
      </div>

      <div className="space-y-6">
        {tree.modules.map((m, mi) => (
          <section key={m.id}>
            <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">
              Module {mi + 1}: {m.title}
            </h2>
            <ul className="space-y-2">
              {m.lessons.map((l) => {
                const locked = l.status === "locked";
                const done = l.status === "completed";
                return (
                  <li key={l.id}>
                    <LessonRow
                      id={l.id}
                      title={l.title}
                      status={l.status}
                      estMinutes={l.estMinutes}
                      xp={l.xpReward}
                      hasQuiz={l.hasQuiz}
                      hasAssignment={l.hasAssignment}
                      locked={locked}
                      done={done}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

function LessonRow(props: {
  id: string;
  title: string;
  status: string;
  estMinutes: number;
  xp: number;
  hasQuiz: boolean;
  hasAssignment: boolean;
  locked: boolean;
  done: boolean;
}) {
  const inner = (
    <div className={`card p-4 flex items-center justify-between ${props.locked ? "opacity-50" : "hover:border-[var(--brand)]"} transition`}>
      <div className="flex items-center gap-3">
        <span className="text-lg">{props.done ? "✅" : props.locked ? "🔒" : "▶️"}</span>
        <div>
          <div className="font-medium">{props.title}</div>
          <div className="text-xs text-[var(--muted)] flex gap-2 mt-0.5">
            <span>{props.estMinutes} min</span>
            <span>· +{props.xp} XP</span>
            {props.hasQuiz && <span>· Quiz</span>}
            {props.hasAssignment && <span>· Assignment</span>}
          </div>
        </div>
      </div>
      {props.done && <span className="text-xs text-[var(--success)]">Done</span>}
    </div>
  );
  return props.locked ? inner : <Link href={`/learn/${props.id}`}>{inner}</Link>;
}
