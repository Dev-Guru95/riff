import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute, parseBody } from "@/lib/api";
import { boardAccess } from "@/lib/boards";

const patchSchema = z.object({ body: z.string().trim().min(1).max(5000) });

// PATCH /api/comments/[id] — edit your own comment.
export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const comment = await prisma.comment.findUnique({ where: { id }, select: { userId: true, card: { select: { boardId: true } } } });
  if (!comment) return fail("Comment not found", 404);
  if (!(await boardAccess(comment.card.boardId, session.id))) return fail("Comment not found", 404);
  if (comment.userId !== session.id) return fail("You can only edit your own comments", 403);
  const body = await parseBody(req, patchSchema);
  if (body.error) return body.error;
  await prisma.comment.update({ where: { id }, data: { body: body.data.body } });
  return ok({ ok: true });
});

// DELETE /api/comments/[id] — delete your own comment, or any comment as a manager+.
export const DELETE = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const comment = await prisma.comment.findUnique({ where: { id }, select: { userId: true, card: { select: { boardId: true } } } });
  if (!comment) return fail("Comment not found", 404);
  const access = await boardAccess(comment.card.boardId, session.id);
  if (!access) return fail("Comment not found", 404);
  if (comment.userId !== session.id && !access.can.manageColumns) {
    return fail("You can only delete your own comments", 403);
  }
  await prisma.comment.delete({ where: { id } });
  return ok({ ok: true });
});
