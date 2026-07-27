import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute, parseBody } from "@/lib/api";
import { boardAccess } from "@/lib/boards";

const schema = z.object({ labelId: z.string().min(1) });

// POST /api/cards/[id]/labels — attach a board label to a card. member+.
export const POST = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const card = await prisma.card.findUnique({ where: { id }, select: { boardId: true } });
  if (!card) return fail("Card not found", 404);
  const access = await boardAccess(card.boardId, session.id);
  if (!access) return fail("Card not found", 404);
  if (!access.can.editCards) return fail("You don't have permission to edit cards", 403);
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  // Label must belong to the same board.
  const label = await prisma.label.findUnique({ where: { id: body.data.labelId }, select: { boardId: true } });
  if (!label || label.boardId !== card.boardId) return fail("Label not found", 404);

  await prisma.cardLabel.upsert({
    where: { cardId_labelId: { cardId: id, labelId: body.data.labelId } },
    create: { cardId: id, labelId: body.data.labelId },
    update: {},
  });
  return ok({ ok: true }, 201);
});
