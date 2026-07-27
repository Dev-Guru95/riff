import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute, parseBody } from "@/lib/api";
import { boardAccess, logActivity, ROLE_RANK } from "@/lib/boards";
import type { BoardRole } from "@/lib/constants";

const patchSchema = z.object({ role: z.enum(["admin", "manager", "member", "guest"]) });

// PATCH /api/boards/[id]/members/[userId] — change a member's role. manageMembers.
// The owner's role is immutable and nobody can be promoted to owner here.
export const PATCH = withRoute(
  async (req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) => {
    const session = await getSession();
    if (!session) return fail("Not authenticated", 401);
    const { id, userId } = await params;
    const access = await boardAccess(id, session.id);
    if (!access) return fail("Board not found", 404);
    if (!access.can.manageMembers) return fail("You don't have permission to manage members", 403);
    const body = await parseBody(req, patchSchema);
    if (body.error) return body.error;

    const target = await prisma.boardMember.findUnique({ where: { boardId_userId: { boardId: id, userId } }, select: { role: true } });
    if (!target) return fail("Member not found", 404);
    if (target.role === "owner") return fail("The board owner's role can't be changed", 403);
    // No touching peers/superiors, and no promoting to your own level or above.
    if (ROLE_RANK[target.role as BoardRole] >= ROLE_RANK[access.role]) return fail("You can't change a member at or above your own role", 403);
    if (ROLE_RANK[body.data.role] >= ROLE_RANK[access.role]) return fail("You can't assign a role at or above your own", 403);

    await prisma.boardMember.update({ where: { boardId_userId: { boardId: id, userId } }, data: { role: body.data.role } });
    await logActivity({ boardId: id, actorId: session.id, verb: "member_role_changed", meta: { userId, role: body.data.role } });
    return ok({ ok: true });
  },
);

// DELETE /api/boards/[id]/members/[userId] — remove a member (never the owner). manageMembers.
export const DELETE = withRoute(
  async (_req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) => {
    const session = await getSession();
    if (!session) return fail("Not authenticated", 401);
    const { id, userId } = await params;
    const access = await boardAccess(id, session.id);
    if (!access) return fail("Board not found", 404);
    if (!access.can.manageMembers) return fail("You don't have permission to manage members", 403);

    const target = await prisma.boardMember.findUnique({ where: { boardId_userId: { boardId: id, userId } }, select: { role: true } });
    if (!target) return fail("Member not found", 404);
    if (target.role === "owner") return fail("The board owner can't be removed", 403);
    if (ROLE_RANK[target.role as BoardRole] >= ROLE_RANK[access.role]) return fail("You can't remove a member at or above your own role", 403);

    await prisma.boardMember.delete({ where: { boardId_userId: { boardId: id, userId } } });
    await logActivity({ boardId: id, actorId: session.id, verb: "member_removed", meta: { userId } });
    return ok({ ok: true });
  },
);
