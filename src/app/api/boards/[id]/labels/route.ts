import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { UI_COLORS } from "@/lib/constants";
import { boardAccess, logActivity } from "@/lib/boards";

const createSchema = z.object({
  name: z.string().trim().max(40).default(""),
  color: z.enum(UI_COLORS),
});

// POST /api/boards/[id]/labels — create a board label. manager+.
export const POST = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`label:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const { id } = await params;
  const access = await boardAccess(id, session.id);
  if (!access) return fail("Board not found", 404);
  if (!access.can.manageLabels) return fail("You don't have permission to manage labels", 403);
  const body = await parseBody(req, createSchema);
  if (body.error) return body.error;

  const label = await prisma.label.create({ data: { boardId: id, name: body.data.name, color: body.data.color } });
  await logActivity({ boardId: id, actorId: session.id, verb: "label_created", meta: { name: body.data.name } });
  return ok({ id: label.id, name: label.name, color: label.color }, 201);
});
