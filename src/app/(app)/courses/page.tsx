import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageSession } from "@/lib/auth";
import { ProgressBar } from "@/components/ui";
import { getCourseProgression } from "@/lib/course-progression";

export default async function CoursesPage() {
  const session = await requirePageSession();
  const progression = await getCourseProgression(session.id);
  const courses = await prisma.course.findMany({
    where: { isPublished: true },
    // slug is the tiebreaker so two courses sharing an orderIndex (the seeded
    // demo course ties with Track 1) still list in a stable, repeatable order.
    orderBy: [{ orderIndex: "asc" }, { slug: "asc" }],
    include: {
      modules: { include: { lessons: { select: { id: true } } } },
      enrollments: { where: { userId: session.id } },
    },
  });

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Courses</h1>
      <p className="text-[var(--muted)] text-sm mb-6">Structured paths from foundations to entrepreneurship.</p>

      <div className="grid sm:grid-cols-2 gap-4">
        {courses.map((c) => {
          const lessonCount = c.modules.reduce((n, m) => n + m.lessons.length, 0);
          const enrolled = c.enrollments[0];
          const prog = progression.get(c.id);
          return (
            <Link key={c.id} href={`/courses/${c.slug}`} className="card p-6 hover:border-[var(--brand)] transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wide text-[var(--accent)]">
                  {prog ? `Track ${prog.position} · ` : ""}{c.level}
                </span>
                {prog?.completed ? (
                  <span className="text-xs text-[var(--success)]">✓ Quiz passed</span>
                ) : enrolled ? (
                  <span className="text-xs text-[var(--success)]">Enrolled</span>
                ) : null}
              </div>
              <h2 className="text-lg font-semibold">{c.title}</h2>
              <p className="text-sm text-[var(--muted)] mt-1 mb-4">{c.description}</p>
              <div className="text-xs text-[var(--muted)] mb-2">{c.modules.length} {c.modules.length === 1 ? "module" : "modules"} · {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}</div>
              {enrolled && (
                <>
                  <ProgressBar pct={enrolled.progressPct} />
                  <div className="text-xs text-[var(--muted)] mt-1">{Math.round(enrolled.progressPct)}% complete</div>
                </>
              )}
              {/* The recommended order, shown rather than enforced: Skool links
                  deep-link into any track's quiz, and blocking those would
                  dead-end students arriving from the classroom. */}
              {prog && !prog.completed && !prog.unlocked && prog.blockedBy && (
                <div className="text-xs text-[var(--muted)] mt-2">
                  ↪ Recommended after <span className="text-[var(--foreground)]">{prog.blockedBy}</span>
                </div>
              )}
              {prog?.unlocked && !prog.completed && (
                <div className="text-xs text-[var(--accent)] mt-2">▶ Start here</div>
              )}
            </Link>
          );
        })}
      </div>
    </main>
  );
}
