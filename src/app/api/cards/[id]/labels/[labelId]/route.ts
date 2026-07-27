import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { boardAccess } from "@/lib/boards";

// DELETE /api/cards/[id]/labels/[labelId] — detach a label from a card. member+.
export const DELETE = withRoute(
  async (_req: Request, { params }: { params: Promise<{ id: string; labelId: string }> }) => {
    const session = await getSession();
    if (!session) return fail("Not authenticated", 401);
    const { id, labelId } = await params;
    const card = await prisma.card.findUnique({ where: { id }, select: { boardId: true } });
    if (!card) return fail("Card not found", 404);
    const access = await boardAccess(card.boardId, session.id);
    if (!access) return fail("Card not found", 404);
    if (!access.can.editCards) return fail("You don't have permission to edit cards", 403);

    await prisma.cardLabel.deleteMany({ where: { cardId: id, labelId } });
    return ok({ ok: true });
  },
);
