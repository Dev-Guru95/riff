import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { boardAccess, logActivity } from "@/lib/boards";

// Links an already-uploaded file (see POST /api/uploads) to a card.
const schema = z.object({
  url: z.string().min(1).max(1000),
  name: z.string().trim().min(1).max(300),
  mime: z.string().max(200).default(""),
  size: z.number().int().min(0).max(1_000_000_000).default(0),
});

// POST /api/cards/[id]/attachments — attach an uploaded file to a card. member+.
export const POST = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`attach:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const { id } = await params;
  const card = await prisma.card.findUnique({ where: { id }, select: { boardId: true } });
  if (!card) return fail("Card not found", 404);
  const access = await boardAccess(card.boardId, session.id);
  if (!access) return fail("Card not found", 404);
  if (!access.can.editCards) return fail("You don't have permission to edit cards", 403);
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  // Only accept app-hosted upload paths under /uploads/ — no external URLs, no
  // path traversal.
  if (!/^\/uploads\/[\w.\-/]+$/.test(body.data.url) || body.data.url.includes("..")) {
    return fail("Invalid attachment URL", 422);
  }

  const att = await prisma.attachment.create({
    data: { cardId: id, userId: session.id, url: body.data.url, name: body.data.name, mime: body.data.mime, size: body.data.size },
  });
  await logActivity({ boardId: card.boardId, actorId: session.id, verb: "attachment_added", cardId: id, meta: { name: body.data.name } });
  return ok({ id: att.id, name: att.name, url: att.url, mime: att.mime, size: att.size }, 201);
});
