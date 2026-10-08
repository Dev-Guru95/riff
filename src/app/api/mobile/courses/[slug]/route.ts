import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { getCourseTree } from "@/lib/progression";
import { trackBadgeMeta } from "@/lib/gamification";
import { badgeAsset } from "@/lib/assets";
import { buildShare } from "@/lib/share";
import { resolveReturnLink } from "@/lib/returnLink";
import { ensureEnrollment, quizLessonId, stepLessonIds } from "@/lib/mobile/tracks";
import type { CourseDetailResponse, LessonStatus } from "@/lib/mobile/types";

// GET /api/mobile/courses/[slug] — src/app/(app)/courses/[slug]/page.tsx.
// SIDE EFFECT (same as visiting the page): upserts the artist's Enrollment.
export const GET = withRoute(async (_req: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { slug } = await params;

  const course = await prisma.course.findUnique({ where: { slug } });
  if (!course) return fail("Course not found", 404);

  await ensureEnrollment(session.id, course.id);

  const tree = await getCourseTree(course.id, session.id);
  if (!tree) return fail("Course not found", 404);
  const completed = tree.progressPct === 100;
  const badge = trackBadgeMeta(course);
  const profile = completed
    ? await prisma.artistProfile.findUnique({ where: { userId: session.id }, select: { stageName: true } })
    : null;
  const [quizId, stepIds] = await Promise.all([quizLessonId(course.id), stepLessonIds(course.id)]);

  const body: CourseDetailResponse = {
    course: {
      id: tree.id,
      slug: tree.slug,
      title: tree.title,
      description: tree.description,
      level: course.level,
      progressPct: tree.progressPct,
      lessonCount: tree.lessonCount,
      completedCount: tree.completedCount,
    },
    modules: tree.modules.map((m) => ({
      id: m.id,
      title: m.title,
      lessons: m.lessons.map((l) => ({ ...l, status: l.status as LessonStatus })),
    })),
    completed,
    badge: {
      key: badge.key,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      tier: badge.tier,
      image: badgeAsset(badge.key),
    },
    share: completed
      ? buildShare({ kind: "badge", value: badge.name, stageName: profile?.stageName, detail: badge.icon })
      : null,
    returnLink: resolveReturnLink(course),
    quizLessonId: quizId,
    stepLessonIds: stepIds,
  };
  return ok(body);
});
