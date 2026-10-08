import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { parseStepNumber } from "@/lib/trackLinks";
import { ensureEnrollment, stepLessonIds } from "@/lib/mobile/tracks";
import type { TrackLinkResolveResponse } from "@/lib/mobile/types";

// GET /api/mobile/courses/[slug]/step/[n] — resolves /courses/<slug>/step/<n>
// (1-based, counting only lessons with an action step) like its page does.
export const GET = withRoute(
  async (_req: Request, { params }: { params: Promise<{ slug: string; n: string }> }) => {
    const { slug, n } = await params;
    const step = parseStepNumber(n);
    if (step === null) return fail("Step not found", 404);

    const session = await getSession();
    if (!session) return fail("Not authenticated", 401);

    const course = await prisma.course.findUnique({ where: { slug }, select: { id: true } });
    if (!course) return fail("Course not found", 404);

    await ensureEnrollment(session.id, course.id);
    const lessonId = (await stepLessonIds(course.id))[step - 1] ?? null;

    const body: TrackLinkResolveResponse = {
      lessonId,
      redirectTo: lessonId ? `/learn/${lessonId}` : `/courses/${slug}`,
    };
    return ok(body);
  },
);
