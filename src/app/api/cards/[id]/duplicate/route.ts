import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { boardAccess, logActivity } from "@/lib/boards";

// POST /api/cards/[id]/duplicate — deep-copy a card (fields, labels, assignees,
// checklists + items) to the end of the same column. member+.
export const POST = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`card:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const { id } = await params;

  const src = await prisma.card.findUnique({
    where: { id },
    include: {
      labels: { select: { labelId: true } },
      assignees: { select: { userId: true } },
      checklists: { orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }], include: { items: { orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }] } } },
    },
  });
  if (!src) return fail("Card not found", 404);
  const access = await boardAccess(src.boardId, session.id);
  if (!access) return fail("Card not found", 404);
  if (!access.can.editCards) return fail("You don't have permission to duplicate cards", 403);

  const agg = await prisma.card.aggregate({ where: { columnId: src.columnId, archived: false }, _max: { orderIndex: true } });
  const copy = await prisma.card.create({
    data: {
      boardId: src.boardId,
      columnId: src.columnId,
      title: `${src.title} (copy)`,
      description: src.description,
      orderIndex: (agg._max.orderIndex ?? -1) + 1,
      priority: src.priority,
      dueDate: src.dueDate,
      startDate: src.startDate,
      estimateMinutes: src.estimateMinutes,
      completion: src.completion,
      labels: { create: src.labels.map((l) => ({ labelId: l.labelId })) },
      assignees: { create: src.assignees.map((a) => ({ userId: a.userId })) },
      checklists: {
        create: src.checklists.map((cl) => ({
          title: cl.title,
          orderIndex: cl.orderIndex,
          items: { create: cl.items.map((it) => ({ text: it.text, done: it.done, orderIndex: it.orderIndex })) },
        })),
      },
    },
  });
  await logActivity({ boardId: src.boardId, actorId: session.id, verb: "card_duplicated", cardId: copy.id, meta: { from: id } });
  return ok({ id: copy.id }, 201);
});
