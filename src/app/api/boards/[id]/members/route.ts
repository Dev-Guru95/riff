import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { notify } from "@/lib/notifications";
import { boardAccess, getMembership, logActivity, nameMap, ROLE_RANK } from "@/lib/boards";

// GET /api/boards/[id]/members?q=... — search existing RiffApp users to invite
// (by email or stage name), excluding current members. manageMembers.
export const GET = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const access = await boardAccess(id, session.id);
  if (!access) return fail("Board not found", 404);
  if (!access.can.manageMembers) return fail("You don't have permission to manage members", 403);

  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (q.length < 2) return ok({ users: [] });

  const existing = await prisma.boardMember.findMany({ where: { boardId: id }, select: { userId: true } });
  const excludeIds = existing.map((m) => m.userId);

  const users = await prisma.user.findMany({
    where: {
      id: { notIn: excludeIds },
      OR: [{ email: { contains: q } }, { profile: { stageName: { contains: q } } }],
    },
    select: { id: true, email: true, profile: { select: { stageName: true } } },
    take: 8,
  });
  return ok({
    users: users.map((u) => ({ userId: u.id, email: u.email, name: u.profile?.stageName?.trim() || u.email.split("@")[0] })),
  });
});

const addSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "manager", "member", "guest"]).default("member"),
});

// POST /api/boards/[id]/members — add an existing user as a board member. manageMembers.
export const POST = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`member:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const { id } = await params;
  const access = await boardAccess(id, session.id);
  if (!access) return fail("Board not found", 404);
  if (!access.can.manageMembers) return fail("You don't have permission to manage members", 403);
  const body = await parseBody(req, addSchema);
  if (body.error) return body.error;
  // Can't grant a role at or above your own (only the owner can mint admins).
  if (ROLE_RANK[body.data.role] >= ROLE_RANK[access.role]) {
    return fail("You can't grant a role at or above your own", 403);
  }

  const user = await prisma.user.findUnique({ where: { email: body.data.email.toLowerCase() }, select: { id: true } });
  if (!user) return fail("No RiffApp user with that email", 422);
  if (await getMembership(id, user.id)) return fail("That user is already a member", 422);

  await prisma.boardMember.create({ data: { boardId: id, userId: user.id, role: body.data.role } });
  await logActivity({ boardId: id, actorId: session.id, verb: "member_added", meta: { userId: user.id, role: body.data.role } });

  const board = await prisma.board.findUnique({ where: { id }, select: { title: true } });
  await notify(user.id, {
    type: "board",
    title: "You were added to a board",
    body: board?.title ?? "A project board",
    link: `/boards/${id}`,
  });

  const names = await nameMap([user.id]);
  return ok({ userId: user.id, role: body.data.role, name: names.get(user.id)?.name ?? "", email: body.data.email }, 201);
});
