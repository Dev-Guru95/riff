import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute, parseBody } from "@/lib/api";
import { boardAccess } from "@/lib/boards";

const schema = z.object({ text: z.string().trim().min(1).max(300) });

// POST /api/checklists/[id]/items — add an item to a checklist. member+.
export const POST = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const cl = await prisma.checklist.findUnique({ where: { id }, select: { card: { select: { boardId: true } } } });
  if (!cl) return fail("Checklist not found", 404);
  const access = await boardAccess(cl.card.boardId, session.id);
  if (!access) return fail("Checklist not found", 404);
  if (!access.can.editCards) return fail("You don't have permission to edit cards", 403);
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const agg = await prisma.checklistItem.aggregate({ where: { checklistId: id }, _max: { orderIndex: true } });
  const item = await prisma.checklistItem.create({ data: { checklistId: id, text: body.data.text, orderIndex: (agg._max.orderIndex ?? -1) + 1 } });
  return ok({ id: item.id, text: item.text, done: item.done }, 201);
});
