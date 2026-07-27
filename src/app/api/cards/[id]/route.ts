import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { CARD_PRIORITIES } from "@/lib/constants";
import { boardAccess, logActivity, loadCardDetail } from "@/lib/boards";

// GET /api/cards/[id] — full card detail for the card modal. Member-scoped.
export const GET = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const detail = await loadCardDetail(id, session.id);
  if (!detail) return fail("Card not found", 404);
  return ok(detail);
});

// Accepts ISO date strings; empty string or null clears the date.
const isoOrNull = z.union([z.string().datetime(), z.literal(""), z.null()]);

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().max(20000).optional(),
    priority: z.union([z.enum(CARD_PRIORITIES), z.null()]).optional(),
    dueDate: isoOrNull.optional(),
    startDate: isoOrNull.optional(),
    estimateMinutes: z.union([z.number().int().min(0).max(100000), z.null()]).optional(),
    completion: z.number().int().min(0).max(100).optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

async function cardBoard(id: string) {
  return prisma.card.findUnique({ where: { id }, select: { id: true, boardId: true, columnId: true, archived: true } });
}

// PATCH /api/cards/[id] — edit card fields / archive. member+ (editCards).
export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`card:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const { id } = await params;
  const card = await cardBoard(id);
  if (!card) return fail("Card not found", 404);
  const access = await boardAccess(card.boardId, session.id);
  if (!access) return fail("Card not found", 404);
  if (!access.can.editCards) return fail("You don't have permission to edit cards", 403);
  const body = await parseBody(req, patchSchema);
  if (body.error) return body.error;

  const d = body.data;
  const data: Record<string, unknown> = {};
  if (d.title !== undefined) data.title = d.title;
  if (d.description !== undefined) data.description = d.description;
  if (d.priority !== undefined) data.priority = d.priority;
  if (d.dueDate !== undefined) data.dueDate = d.dueDate ? new Date(d.dueDate) : null;
  if (d.startDate !== undefined) data.startDate = d.startDate ? new Date(d.startDate) : null;
  if (d.estimateMinutes !== undefined) data.estimateMinutes = d.estimateMinutes;
  if (d.completion !== undefined) {
    data.completion = d.completion;
    data.completedAt = d.completion >= 100 ? new Date() : null;
  }
  if (d.archived !== undefined) data.archived = d.archived;

  await prisma.card.update({ where: { id }, data });
  await logActivity({
    boardId: card.boardId,
    actorId: session.id,
    verb: d.archived === true ? "card_archived" : "card_updated",
    cardId: id,
    meta: { fields: Object.keys(d) },
  });
  return ok({ ok: true });
});

// DELETE /api/cards/[id] — hard delete. manager+ (members should archive instead).
export const DELETE = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const card = await cardBoard(id);
  if (!card) return fail("Card not found", 404);
  const access = await boardAccess(card.boardId, session.id);
  if (!access) return fail("Card not found", 404);
  if (!access.can.manageColumns) return fail("Only managers can permanently delete cards — try archiving", 403);
  await prisma.card.delete({ where: { id } });
  await logActivity({ boardId: card.boardId, actorId: session.id, verb: "card_deleted", cardId: id });
  return ok({ ok: true });
});
