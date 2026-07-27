import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { boardAccess, logActivity } from "@/lib/boards";

const createSchema = z.object({ title: z.string().trim().min(1).max(80) });

// POST /api/boards/[id]/columns — add a column (appended to the end). manager+.
export const POST = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`col:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const { id } = await params;
  const access = await boardAccess(id, session.id);
  if (!access) return fail("Board not found", 404);
  if (!access.can.manageColumns) return fail("You don't have permission to manage columns", 403);
  const body = await parseBody(req, createSchema);
  if (body.error) return body.error;

  const agg = await prisma.boardColumn.aggregate({ where: { boardId: id }, _max: { orderIndex: true } });
  const column = await prisma.boardColumn.create({
    data: { boardId: id, title: body.data.title, orderIndex: (agg._max.orderIndex ?? -1) + 1 },
  });
  await logActivity({ boardId: id, actorId: session.id, verb: "column_created", meta: { title: body.data.title } });
  return ok({ id: column.id, orderIndex: column.orderIndex }, 201);
});
