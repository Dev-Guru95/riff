import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { notify } from "@/lib/notifications";
import { boardAccess, logActivity, cardParticipants } from "@/lib/boards";

const moveSchema = z.object({
  toColumnId: z.string().min(1),
  toIndex: z.number().int().min(0),
});

// POST /api/cards/[id]/move — move a card to a column at a position, then
// re-sequence both affected columns so orderIndex stays dense (0,1,2,…).
// Powers drag-and-drop. member+ (editCards).
export const POST = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`card:move:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const { id } = await params;
  const body = await parseBody(req, moveSchema);
  if (body.error) return body.error;

  const card = await prisma.card.findUnique({ where: { id }, select: { id: true, boardId: true, columnId: true } });
  if (!card) return fail("Card not found", 404);
  const access = await boardAccess(card.boardId, session.id);
  if (!access) return fail("Card not found", 404);
  if (!access.can.editCards) return fail("You don't have permission to move cards", 403);

  // Target column must exist and belong to the same board.
  const dest = await prisma.boardColumn.findUnique({ where: { id: body.data.toColumnId }, select: { boardId: true } });
  if (!dest || dest.boardId !== card.boardId) return fail("Target column not found", 404);

  const fromColumnId = card.columnId;
  const toColumnId = body.data.toColumnId;

  await prisma.$transaction(async (tx) => {
    const destCards = await tx.card.findMany({
      where: { columnId: toColumnId, archived: false, id: { not: id } },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const order = destCards.map((c) => c.id);
    const idx = Math.max(0, Math.min(body.data.toIndex, order.length));
    order.splice(idx, 0, id);
    for (let i = 0; i < order.length; i++) {
      await tx.card.update({
        where: { id: order[i] },
        data: order[i] === id ? { orderIndex: i, columnId: toColumnId } : { orderIndex: i },
      });
    }
    if (fromColumnId !== toColumnId) {
      const srcCards = await tx.card.findMany({
        where: { columnId: fromColumnId, archived: false, id: { not: id } },
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      for (let i = 0; i < srcCards.length; i++) {
        await tx.card.update({ where: { id: srcCards[i].id }, data: { orderIndex: i } });
      }
    }
  });

  await logActivity({
    boardId: card.boardId,
    actorId: session.id,
    verb: "card_moved",
    cardId: id,
    meta: { fromColumnId, toColumnId, toIndex: body.data.toIndex },
  });

  // Notify watchers/assignees a card they follow was moved (only across columns).
  if (fromColumnId !== toColumnId) {
    const dest = await prisma.boardColumn.findUnique({ where: { id: toColumnId }, select: { title: true } });
    const cardRow = await prisma.card.findUnique({ where: { id }, select: { title: true } });
    for (const uid of await cardParticipants(id, session.id)) {
      await notify(uid, {
        type: "task",
        title: `Card moved to “${dest?.title ?? "another column"}”`,
        body: cardRow?.title ?? "",
        link: `/boards/${card.boardId}?card=${id}`,
      });
    }
  }
  return ok({ ok: true });
});
