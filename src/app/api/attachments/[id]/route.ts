import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { boardAccess } from "@/lib/boards";

// DELETE /api/attachments/[id] — remove an attachment (uploader, or manager+).
export const DELETE = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const att = await prisma.attachment.findUnique({ where: { id }, select: { userId: true, card: { select: { boardId: true } } } });
  if (!att) return fail("Attachment not found", 404);
  const access = await boardAccess(att.card.boardId, session.id);
  if (!access) return fail("Attachment not found", 404);
  if (att.userId !== session.id && !access.can.manageColumns) {
    return fail("You can only remove your own attachments", 403);
  }
  await prisma.attachment.delete({ where: { id } });
  return ok({ ok: true });
});
