import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { notify } from "@/lib/notifications";
import { boardAccess, getMembership, logActivity } from "@/lib/boards";

const schema = z.object({ userId: z.string().min(1) });

// POST /api/cards/[id]/assignees — assign a board member to a card.
// Self-assign needs editCards (member+); assigning others needs assignOthers (manager+).
export const POST = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`assign:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const { id } = await params;
  const card = await prisma.card.findUnique({ where: { id }, select: { boardId: true, title: true } });
  if (!card) return fail("Card not found", 404);
  const access = await boardAccess(card.boardId, session.id);
  if (!access) return fail("Card not found", 404);
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const isSelf = body.data.userId === session.id;
  if (isSelf ? !access.can.editCards : !access.can.assignOthers) {
    return fail("You don't have permission to assign this card", 403);
  }
  // Assignee must already be a member of the board.
  if (!(await getMembership(card.boardId, body.data.userId))) {
    return fail("That user is not a member of this board", 422);
  }

  await prisma.cardAssignee.upsert({
    where: { cardId_userId: { cardId: id, userId: body.data.userId } },
    create: { cardId: id, userId: body.data.userId },
    update: {},
  });
  await logActivity({ boardId: card.boardId, actorId: session.id, verb: "assigned", cardId: id, meta: { userId: body.data.userId } });
  if (!isSelf) {
    await notify(body.data.userId, {
      type: "task",
      title: "You were assigned a task",
      body: card.title,
      link: `/boards/${card.boardId}?card=${id}`,
    });
  }
  return ok({ ok: true }, 201);
});
