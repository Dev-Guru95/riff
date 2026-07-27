import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute, parseBody } from "@/lib/api";
import { boardAccess } from "@/lib/boards";

const schema = z.object({ title: z.string().trim().min(1).max(80).default("Checklist") });

// POST /api/cards/[id]/checklists — add a checklist to a card. member+.
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

  const agg = await prisma.checklist.aggregate({ where: { cardId: id }, _max: { orderIndex: true } });
  const checklist = await prisma.checklist.create({ data: { cardId: id, title: body.data.title, orderIndex: (agg._max.orderIndex ?? -1) + 1 } });
  return ok({ id: checklist.id, title: checklist.title }, 201);
});
