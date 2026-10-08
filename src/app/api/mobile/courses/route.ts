import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import type { CoursesResponse } from "@/lib/mobile/types";

// GET /api/mobile/courses — the catalog from src/app/(app)/courses/page.tsx.
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

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
      };
    }),
  };
  return ok(body);
});
