import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute, parseBody } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { boardAccess, cardParticipants, logActivity } from "@/lib/boards";

async function itemCard(id: string) {
  const it = await prisma.checklistItem.findUnique({
    where: { id },
    select: { checklist: { select: { cardId: true, card: { select: { boardId: true, title: true } } } } },
  });
  if (!it) return null;
  return { cardId: it.checklist.cardId, boardId: it.checklist.card.boardId, cardTitle: it.checklist.card.title };
}

const patchSchema = z
  .object({ text: z.string().trim().min(1).max(300).optional(), done: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// PATCH /api/checklist-items/[id] — toggle done / rename an item. member+.
// When the LAST open item is checked, notify the card's watchers/assignees.
export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const info = await itemCard(id);
  if (!info) return fail("Item not found", 404);
  const access = await boardAccess(info.boardId, session.id);
  if (!access || !access.can.editCards) return fail(access ? "Forbidden" : "Item not found", access ? 403 : 404);
  const body = await parseBody(req, patchSchema);
  if (body.error) return body.error;
  await prisma.checklistItem.update({ where: { id }, data: body.data });

  if (body.data.done === true) {
    // Did that complete every checklist item on the card?
    const [total, open] = await Promise.all([
      prisma.checklistItem.count({ where: { checklist: { cardId: info.cardId } } }),
      prisma.checklistItem.count({ where: { checklist: { cardId: info.cardId }, done: false } }),
    ]);
    if (total > 0 && open === 0) {
      await logActivity({ boardId: info.boardId, actorId: session.id, verb: "checklist_completed", cardId: info.cardId });
      for (const uid of await cardParticipants(info.cardId, session.id)) {
        await notify(uid, {
          type: "task",
          title: "Checklist completed",
          body: info.cardTitle,
          link: `/boards/${info.boardId}?card=${info.cardId}`,
        });
      }
    }
  }
  return ok({ ok: true });
});

// DELETE /api/checklist-items/[id] — remove an item. member+.
export const DELETE = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const info = await itemCard(id);
  if (!info) return fail("Item not found", 404);
  const access = await boardAccess(info.boardId, session.id);
  if (!access || !access.can.editCards) return fail(access ? "Forbidden" : "Item not found", access ? 403 : 404);
  await prisma.checklistItem.delete({ where: { id } });
  return ok({ ok: true });
});
