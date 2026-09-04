import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseStepNumber } from "@/lib/trackLinks";

/**
 * Stable, publishable address for one action step: /courses/<slug>/step/<n>
 *
 * `n` is 1-based and counts only the lessons that actually carry an action step,
 * in track order — so "step 2" is the second thing the artist is asked to do,
 * regardless of how the lessons around it are arranged. That keeps the number in
 * the Skool link meaningful to a human, and stable if a lesson without a step is
 * ever added or removed.
 */
export default async function TrackStepPage({ params }: { params: Promise<{ slug: string; n: string }> }) {
  const { slug, n } = await params;
  const step = parseStepNumber(n);
  if (step === null) notFound();

  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/courses/${slug}/step/${n}`)}`);

  const course = await prisma.course.findUnique({ where: { slug }, select: { id: true } });
  if (!course) notFound();

  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: session.id, courseId: course.id } },
    create: { userId: session.id, courseId: course.id },
    update: {},
  });

  const withSteps = await prisma.lesson.findMany({
    where: { module: { courseId: course.id }, assignment: { isNot: null } },
    orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
    select: { id: true },
  });

  const lesson = withSteps[step - 1];
  // Asking for a step this track does not have lands on the track page rather
  // than a 404: a mistyped link in Skool should still show the artist the track.
  if (!lesson) redirect(`/courses/${slug}`);

  redirect(`/learn/${lesson.id}`);
}
