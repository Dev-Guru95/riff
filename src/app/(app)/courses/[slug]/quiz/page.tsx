import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * Stable, publishable address for a track's quiz: /courses/<slug>/quiz
 *
 * Resolves the quiz-bearing lesson and forwards to the player. The link that
 * goes into Skool is this one — built from the course slug, which comes from the
 * course files and survives a rebuild — while the cuid the player actually needs
 * is looked up fresh on every visit.
 */
export default async function TrackQuizPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/courses/${slug}/quiz`)}`);

  const course = await prisma.course.findUnique({ where: { slug }, select: { id: true } });
  if (!course) notFound();

  // Enrol on arrival, exactly as the track page does: an artist following a
  // Skool link straight to the quiz must not have to visit the track page first.
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: session.id, courseId: course.id } },
    create: { userId: session.id, courseId: course.id },
    update: {},
  });

  const lesson = await prisma.lesson.findFirst({
    where: { module: { courseId: course.id }, quiz: { isNot: null } },
    orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
    select: { id: true },
  });
  // A track with no quiz yet falls back to its own page rather than 404ing —
  // the link stays valid while the content is still being written.
  if (!lesson) redirect(`/courses/${slug}`);

  redirect(`/learn/${lesson.id}`);
}
