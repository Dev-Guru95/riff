import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { getCommunityStatus } from "@/lib/community";
import type { CoachResponse } from "@/lib/mobile/types";

// GET /api/mobile/coach — src/app/(app)/coach/page.tsx.
// Non-members get the locked state (200, locked:true) like the page.
// SIDE EFFECT for members (same as the page): if the artist has no coach thread
// yet, one is created. Send messages with POST /api/coach/threads/[id]/messages.
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  const status = await getCommunityStatus(session.id);
  if (status !== "member") {
    const locked: CoachResponse = { locked: true, status, pending: status === "pending" };
    return ok(locked);
  }

  // Most recent thread, or create one.
  let thread = await prisma.coachThread.findFirst({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!thread) {
    const created = await prisma.coachThread.create({ data: { userId: session.id } });
    thread = { ...created, messages: [] };
  }

  const profile = await prisma.artistProfile.findUnique({
    where: { userId: session.id },
    select: { stageName: true },
  });

  const body: CoachResponse = {
    locked: false,
    status: "member",
    thread: { id: thread.id, title: thread.title, createdAt: thread.createdAt.toISOString() },
    messages: thread.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      feedback: m.feedback,
      createdAt: m.createdAt.toISOString(),
    })),
    stageName: profile?.stageName ?? null,
  };
  return ok(body);
});
