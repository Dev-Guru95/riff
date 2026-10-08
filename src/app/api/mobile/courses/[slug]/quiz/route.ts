import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { ensureEnrollment, quizLessonId } from "@/lib/mobile/tracks";
import type { TrackLinkResolveResponse } from "@/lib/mobile/types";

// GET /api/mobile/courses/[slug]/quiz — resolves the publishable Skool link
// /courses/<slug>/quiz the way its page does (enrol, then find the quiz lesson),
// returning where the page would redirect instead of redirecting.
export const GET = withRoute(async (_req: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { slug } = await params;

  const course = await prisma.course.findUnique({ where: { slug }, select: { id: true } });
  if (!course) return fail("Course not found", 404);

  await ensureEnrollment(session.id, course.id);
  const lessonId = await quizLessonId(course.id);

  const body: TrackLinkResolveResponse = {
    lessonId,
    redirectTo: lessonId ? `/learn/${lessonId}` : `/courses/${slug}`,
  };
  return ok(body);
});
