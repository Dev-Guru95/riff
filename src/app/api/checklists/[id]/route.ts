import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute, parseBody } from "@/lib/api";
import { boardAccess } from "@/lib/boards";

async function checklistBoard(id: string) {
  const cl = await prisma.checklist.findUnique({ where: { id }, select: { card: { select: { boardId: true } } } });
  return cl?.card.boardId ?? null;
}

const patchSchema = z.object({ title: z.string().trim().min(1).max(80) });

// PATCH /api/checklists/[id] — rename a checklist. member+.
export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const boardId = await checklistBoard(id);
  if (!boardId) return fail("Checklist not found", 404);
  const access = await boardAccess(boardId, session.id);
  if (!access || !access.can.editCards) return fail(access ? "Forbidden" : "Checklist not found", access ? 403 : 404);
  const body = await parseBody(req, patchSchema);
  if (body.error) return body.error;
  await prisma.checklist.update({ where: { id }, data: { title: body.data.title } });
  return ok({ ok: true });
});

// DELETE /api/checklists/[id] — delete a checklist and its items. member+.
export const DELETE = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const boardId = await checklistBoard(id);
  if (!boardId) return fail("Checklist not found", 404);
  const access = await boardAccess(boardId, session.id);
  if (!access || !access.can.editCards) return fail(access ? "Forbidden" : "Checklist not found", access ? 403 : 404);
  await prisma.checklist.delete({ where: { id } });
  return ok({ ok: true });
});
