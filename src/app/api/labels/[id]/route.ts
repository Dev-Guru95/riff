import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute, parseBody } from "@/lib/api";
import { UI_COLORS } from "@/lib/constants";
import { boardAccess, logActivity } from "@/lib/boards";

const patchSchema = z
  .object({ name: z.string().trim().max(40).optional(), color: z.enum(UI_COLORS).optional() })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// PATCH /api/labels/[id] — rename / recolour a board label. manager+.
export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const label = await prisma.label.findUnique({ where: { id }, select: { boardId: true } });
  if (!label) return fail("Label not found", 404);
  const access = await boardAccess(label.boardId, session.id);
  if (!access) return fail("Label not found", 404);
  if (!access.can.manageLabels) return fail("You don't have permission to manage labels", 403);
  const body = await parseBody(req, patchSchema);
  if (body.error) return body.error;
  const updated = await prisma.label.update({ where: { id }, data: body.data });
  return ok({ id: updated.id, name: updated.name, color: updated.color });
});

// DELETE /api/labels/[id] — delete a board label (detaches from all cards). manager+.
export const DELETE = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const label = await prisma.label.findUnique({ where: { id }, select: { boardId: true } });
  if (!label) return fail("Label not found", 404);
  const access = await boardAccess(label.boardId, session.id);
  if (!access) return fail("Label not found", 404);
  if (!access.can.manageLabels) return fail("You don't have permission to manage labels", 403);
  await prisma.label.delete({ where: { id } });
  await logActivity({ boardId: label.boardId, actorId: session.id, verb: "label_deleted" });
  return ok({ ok: true });
});
