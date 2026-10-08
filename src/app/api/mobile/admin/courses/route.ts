import { prisma } from "@/lib/prisma";
import { ok, withRoute } from "@/lib/api";
import { requireStaff } from "@/lib/mobile/staff";
import type { AdminCoursesResponse } from "@/lib/mobile/types";

// GET /api/mobile/admin/courses — src/app/(admin)/admin/courses/page.tsx. Staff only.
export const GET = withRoute(async () => {
  const gate = await requireStaff();
  if (gate.error) return gate.error;

  const courses = await prisma.course.findMany({
    orderBy: { orderIndex: "asc" },
    include: { _count: { select: { modules: true } }, modules: { include: { _count: { select: { lessons: true } } } } },
  });

  const body: AdminCoursesResponse = {
    courses: courses.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      level: c.level,
      version: c.version,
      orderIndex: c.orderIndex,
      isPublished: c.isPublished,
      moduleCount: c._count.modules,
      lessonCount: c.modules.reduce((n, m) => n + m._count.lessons, 0),
    })),
  };
  return ok(body);
});
