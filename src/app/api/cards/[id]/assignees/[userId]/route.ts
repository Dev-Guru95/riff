import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { boardAccess, logActivity } from "@/lib/boards";

// DELETE /api/cards/[id]/assignees/[userId] — unassign. Self-removal needs
// editCards; removing others needs assignOthers.
export const DELETE = withRoute(
  async (_req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) => {
    const session = await getSession();
    if (!session) return fail("Not authenticated", 401);
    const { id, userId } = await params;
    const card = await prisma.card.findUnique({ where: { id }, select: { boardId: true } });
    if (!card) return fail("Card not found", 404);
    const access = await boardAccess(card.boardId, session.id);
    if (!access) return fail("Card not found", 404);
    const isSelf = userId === session.id;
    if (isSelf ? !access.can.editCards : !access.can.assignOthers) {
      return fail("You don't have permission to change assignees", 403);
    }
    await prisma.cardAssignee.deleteMany({ where: { cardId: id, userId } });
    await logActivity({ boardId: card.boardId, actorId: session.id, verb: "unassigned", cardId: id, meta: { userId } });
    return ok({ ok: true });
  },
);
