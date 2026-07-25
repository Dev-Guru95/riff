import { prisma } from "./prisma";
import { notify } from "./notifications";
import { track } from "./analytics";
import { PROGRAM_KEY, PROGRAM_TITLE, PROGRAM_BADGE_KEY } from "./constants";

/**
 * Pure: is the program complete? The program is done when the user has completed
 * every published course. Extracted so the rule is unit-testable without a DB.
 */
export function isProgramCompleteFrom(
  publishedCourseIds: string[],
  completedCourseIds: Iterable<string>,
): boolean {
  if (publishedCourseIds.length === 0) return false;
  const done = new Set(completedCourseIds);
  return publishedCourseIds.every((id) => done.has(id));
}

export type ProgramProgress = {
  total: number;
  completed: number;
  complete: boolean;
  tracks: { slug: string; title: string; done: boolean }[];
};

/**
 * Per-track program progress for the profile/certificates UI: the ordered list
 * of published courses with a done flag, plus rollup counts. `complete` mirrors
 * isProgramComplete for the same user.
 */
export async function getProgramProgress(userId: string): Promise<ProgramProgress> {
  const [published, completed] = await Promise.all([
    prisma.course.findMany({
      where: { isPublished: true },
      orderBy: { orderIndex: "asc" },
      select: { id: true, slug: true, title: true },
    }),
    prisma.enrollment.findMany({
      where: { userId, completedAt: { not: null }, course: { isPublished: true } },
      select: { courseId: true },
    }),
  ]);
  const done = new Set(completed.map((e) => e.courseId));
  const tracks = published.map((c) => ({ slug: c.slug, title: c.title, done: done.has(c.id) }));
  const completedCount = tracks.filter((t) => t.done).length;
  return {
    total: tracks.length,
    completed: completedCount,
    complete: tracks.length > 0 && completedCount === tracks.length,
    tracks,
  };
}

/** Has the user finished every published course in the program? */
export async function isProgramComplete(userId: string): Promise<boolean> {
  const [published, completed] = await Promise.all([
    prisma.course.findMany({ where: { isPublished: true }, select: { id: true } }),
    prisma.enrollment.findMany({
      where: { userId, completedAt: { not: null }, course: { isPublished: true } },
      select: { courseId: true },
    }),
  ]);
  return isProgramCompleteFrom(published.map((c) => c.id), completed.map((e) => e.courseId));
}

/**
 * Issue the single program-completion certificate (and its paired capstone badge)
 * the moment an artist finishes every published course. Idempotent: the unique
 * (userId, programKey) constraint means a second call after issuance is a no-op,
 * so this is safe to invoke on every course completion. Returns the certificate
 * only when it is *newly* issued; null if the program is incomplete or already
 * certified.
 */
export async function issueProgramCertificate(
  userId: string,
): Promise<{ serial: string; title: string } | null> {
  if (!(await isProgramComplete(userId))) return null;

  // Check-first so the common re-run path (a completed program re-triggering this)
  // is a quiet no-op instead of a caught-but-logged unique-constraint error.
  const existing = await prisma.certificate.findUnique({
    where: { userId_programKey: { userId, programKey: PROGRAM_KEY } },
  });
  if (existing) return null;

  let cert;
  try {
    cert = await prisma.certificate.create({
      data: { userId, programKey: PROGRAM_KEY, title: PROGRAM_TITLE },
    });
  } catch {
    return null; // lost a race to a concurrent completion — already issued
  }

  // The capstone badge pairs the certificate with a spot on the badge wall.
  await awardProgramBadge(userId);

  await notify(userId, {
    type: "certificate",
    title: `🎓 Program complete: ${PROGRAM_TITLE}`,
    body: "You finished every course. Your certificate is ready — share your win with the community!",
    link: "/certificates",
  });
  await track("certificate_issued", userId, { programKey: PROGRAM_KEY });
  return { serial: cert.serial, title: cert.title };
}

/** Award the seeded program capstone badge. Idempotent (check-first, UserBadge PK). */
async function awardProgramBadge(userId: string): Promise<void> {
  const badge = await prisma.badge.findUnique({ where: { key: PROGRAM_BADGE_KEY } });
  if (!badge) return; // seed not run — certificate still issues
  const exists = await prisma.userBadge.findUnique({
    where: { userId_badgeId: { userId, badgeId: badge.id } },
  });
  if (exists) return;
  await prisma.userBadge.create({ data: { userId, badgeId: badge.id } });
}
