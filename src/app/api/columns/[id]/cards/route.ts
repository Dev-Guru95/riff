import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { boardAccess, logActivity, loadColumnCards } from "@/lib/boards";

// GET /api/columns/[id]/cards?offset=N — lazy-load more cards for a column.
export const GET = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const offset = Math.max(0, Number(new URL(req.url).searchParams.get("offset") ?? "0") || 0);
  const cards = await loadColumnCards(id, session.id, offset);
  if (cards === null) return fail("Column not found", 404);
  return ok({ cards });
});

const createSchema = z.object({ title: z.string().trim().min(1).max(300) });

// POST /api/columns/[id]/cards — add a card to the end of a column. member+.
export const POST = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`card:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const { id } = await params;
  const column = await prisma.boardColumn.findUnique({ where: { id }, select: { id: true, boardId: true } });
  if (!column) return fail("Column not found", 404);
  const access = await boardAccess(column.boardId, session.id);
  if (!access) return fail("Column not found", 404);
  if (!access.can.editCards) return fail("You don't have permission to add cards", 403);
  const body = await parseBody(req, createSchema);
  if (body.error) return body.error;

  const agg = await prisma.card.aggregate({ where: { columnId: id, archived: false }, _max: { orderIndex: true } });
  const card = await prisma.card.create({
    data: { boardId: column.boardId, columnId: id, title: body.data.title, orderIndex: (agg._max.orderIndex ?? -1) + 1 },
  });
  await logActivity({ boardId: column.boardId, actorId: session.id, verb: "card_created", cardId: card.id, meta: { title: body.data.title } });
  return ok({ id: card.id, orderIndex: card.orderIndex }, 201);
});
