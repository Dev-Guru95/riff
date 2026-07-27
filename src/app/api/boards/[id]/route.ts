import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { UI_COLORS } from "@/lib/constants";
import { boardAccess, loadBoardForUser, logActivity } from "@/lib/boards";

// GET /api/boards/[id] — full board tree (columns + cards), member-scoped.
export const GET = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const board = await loadBoardForUser(id, session.id);
  if (!board) return fail("Board not found", 404);
  return ok({ board });
});

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  color: z.enum(UI_COLORS).optional(),
  archived: z.boolean().optional(),
});

// PATCH /api/boards/[id] — rename / describe / recolour / archive. admin+ only.
export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`board:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const { id } = await params;
  const access = await boardAccess(id, session.id);
  if (!access) return fail("Board not found", 404);
  if (!access.can.manageBoard) return fail("You don't have permission to edit this board", 403);
  const body = await parseBody(req, patchSchema);
  if (body.error) return body.error;

  const board = await prisma.board.update({ where: { id }, data: body.data });
  await logActivity({ boardId: id, actorId: session.id, verb: "updated", meta: { fields: Object.keys(body.data) } });
  return ok({ board: { id: board.id, title: board.title, archived: board.archived } });
});

// DELETE /api/boards/[id] — owner only. Cascades to columns/cards/etc.
export const DELETE = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const access = await boardAccess(id, session.id);
  if (!access) return fail("Board not found", 404);
  if (!access.can.deleteBoard) return fail("Only the board owner can delete it", 403);
  await prisma.board.delete({ where: { id } });
  return ok({ ok: true });
});
