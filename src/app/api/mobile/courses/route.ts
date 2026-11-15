import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { getCourseProgression } from "@/lib/course-progression";
import type { CoursesResponse } from "@/lib/mobile/types";

// GET /api/mobile/courses — the catalog from src/app/(app)/courses/page.tsx.
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  // Same advisory ordering the web catalog shows ("Start here" / "Recommended
  // after X") — never enforced, because Skool deep-links into any track.
  const progression = await getCourseProgression(session.id);
  const courses = await prisma.course.findMany({
    where: { isPublished: true },
    // slug tiebreaker: same stable order as the web catalog.
    orderBy: [{ orderIndex: "asc" }, { slug: "asc" }],
    include: {
      modules: { include: { lessons: { select: { id: true } } } },
      enrollments: { where: { userId: session.id } },
    },
  });

  const body: CoursesResponse = {
    courses: courses.map((c) => {
      const enrolled = c.enrollments[0];
      const prog = progression.get(c.id);
      return {
        id: c.id,
        slug: c.slug,
        title: c.title,
        description: c.description,
        level: c.level,
        orderIndex: c.orderIndex,
        moduleCount: c.modules.length,
        lessonCount: c.modules.reduce((n, m) => n + m.lessons.length, 0),
        enrollment: enrolled
          ? {
              progressPct: enrolled.progressPct,
              startedAt: enrolled.startedAt.toISOString(),
              completedAt: enrolled.completedAt?.toISOString() ?? null,
            }
          : null,
        progression: prog
          ? { position: prog.position, completed: prog.completed, unlocked: prog.unlocked, blockedBy: prog.blockedBy }
          : undefined,
      };
    }),
  };
  return ok(body);
});
