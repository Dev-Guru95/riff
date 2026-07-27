import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { notify } from "@/lib/notifications";
import { boardAccess, logActivity, parseMentions, cardParticipants, ensureWatching, loadCardComments } from "@/lib/boards";

// GET /api/cards/[id]/comments — list comments (member-scoped).
export const GET = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const comments = await loadCardComments(id, session.id);
  if (comments === null) return fail("Card not found", 404);
  return ok({ comments });
});

const schema = z.object({ body: z.string().trim().min(1).max(5000) });

// POST /api/cards/[id]/comments — add a comment. Parses @mentions, auto-watches
// the commenter, and notifies mentioned users + card watchers/assignees. Any
// member (incl. guest) may comment.
export const POST = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`comment:${session.id}`, 20, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const { id } = await params;
  const card = await prisma.card.findUnique({ where: { id }, select: { boardId: true, title: true } });
  if (!card) return fail("Card not found", 404);
  const access = await boardAccess(card.boardId, session.id);
  if (!access) return fail("Card not found", 404);
  if (!access.can.comment) return fail("You don't have permission to comment", 403);
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const comment = await prisma.comment.create({ data: { cardId: id, userId: session.id, body: body.data.body } });
  await ensureWatching(id, session.id);
  await logActivity({ boardId: card.boardId, actorId: session.id, verb: "commented", cardId: id });

  // Resolve mentions against board members.
  const memberRows = await prisma.boardMember.findMany({
    where: { boardId: card.boardId },
    select: { userId: true, user: { select: { email: true, profile: { select: { stageName: true } } } } },
  });
  const members = memberRows.map((m) => ({
    userId: m.userId,
    name: m.user.profile?.stageName?.trim() || m.user.email.split("@")[0],
    email: m.user.email,
  }));
  const mentioned = new Set(parseMentions(body.data.body, members).filter((uid) => uid !== session.id));

  const link = `/boards/${card.boardId}?card=${id}`;
  for (const uid of mentioned) {
    await notify(uid, { type: "mention", title: "You were mentioned", body: card.title, link });
  }
  // Notify other participants (watchers/assignees) who weren't already mentioned.
  const participants = (await cardParticipants(id, session.id)).filter((uid) => !mentioned.has(uid));
  for (const uid of participants) {
    await notify(uid, { type: "comment", title: "New comment", body: card.title, link });
  }

  return ok({ id: comment.id }, 201);
});
