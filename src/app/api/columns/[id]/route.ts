import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { boardAccess, logActivity } from "@/lib/boards";

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    toIndex: z.number().int().min(0).optional(),
  })
  .refine((v) => v.title !== undefined || v.toIndex !== undefined, { message: "Nothing to update" });

// PATCH /api/columns/[id] — rename and/or reorder within the board. manager+.
export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`col:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const { id } = await params;
  const column = await prisma.boardColumn.findUnique({ where: { id }, select: { id: true, boardId: true } });
  if (!column) return fail("Column not found", 404);
  const access = await boardAccess(column.boardId, session.id);
  if (!access) return fail("Column not found", 404);
  if (!access.can.manageColumns) return fail("You don't have permission to manage columns", 403);
  const body = await parseBody(req, patchSchema);
  if (body.error) return body.error;

  if (body.data.title !== undefined) {
    await prisma.boardColumn.update({ where: { id }, data: { title: body.data.title } });
  }

  if (body.data.toIndex !== undefined) {
    // Resequence the board's columns with this one moved to toIndex.
    const others = await prisma.boardColumn.findMany({
      where: { boardId: column.boardId, id: { not: id } },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const order = others.map((c) => c.id);
    const idx = Math.max(0, Math.min(body.data.toIndex, order.length));
    order.splice(idx, 0, id);
    await prisma.$transaction(
      order.map((cid, i) => prisma.boardColumn.update({ where: { id: cid }, data: { orderIndex: i } })),
    );
  }

  await logActivity({ boardId: column.boardId, actorId: session.id, verb: "column_updated" });
  return ok({ ok: true });
});

// DELETE /api/columns/[id] — remove a column and its cards. manager+.
export const DELETE = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const column = await prisma.boardColumn.findUnique({ where: { id }, select: { id: true, boardId: true, title: true } });
  if (!column) return fail("Column not found", 404);
  const access = await boardAccess(column.boardId, session.id);
  if (!access) return fail("Column not found", 404);
  if (!access.can.manageColumns) return fail("You don't have permission to manage columns", 403);

  await prisma.boardColumn.delete({ where: { id } });
  await logActivity({ boardId: column.boardId, actorId: session.id, verb: "column_deleted", meta: { title: column.title } });
  return ok({ ok: true });
});
