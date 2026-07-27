import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { boardAccess, ensureWatching } from "@/lib/boards";

async function cardBoardId(id: string) {
  const c = await prisma.card.findUnique({ where: { id }, select: { boardId: true } });
  return c?.boardId ?? null;
}

// POST /api/cards/[id]/watch — follow this card (self). Any member.
export const POST = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const boardId = await cardBoardId(id);
  if (!boardId || !(await boardAccess(boardId, session.id))) return fail("Card not found", 404);
  await ensureWatching(id, session.id);
  return ok({ watching: true }, 201);
});

// DELETE /api/cards/[id]/watch — stop following this card (self).
export const DELETE = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const boardId = await cardBoardId(id);
  if (!boardId || !(await boardAccess(boardId, session.id))) return fail("Card not found", 404);
  await prisma.cardWatcher.deleteMany({ where: { cardId: id, userId: session.id } });
  return ok({ watching: false });
});
