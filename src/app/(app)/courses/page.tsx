import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageSession } from "@/lib/auth";
import { ProgressBar } from "@/components/ui";

export default async function CoursesPage() {
  const session = await requirePageSession();
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
          return (
            <Link key={c.id} href={`/courses/${c.slug}`} className="card p-6 hover:border-[var(--brand)] transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wide text-[var(--accent)]">{c.level}</span>
                {enrolled && <span className="text-xs text-[var(--success)]">Enrolled</span>}
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
            </Link>
          );
        })}
      </div>
    </main>
  );
}
