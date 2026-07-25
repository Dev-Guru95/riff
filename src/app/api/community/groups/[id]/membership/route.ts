import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/api";

// Toggle join/leave for an accountability group.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;

  const group = await prisma.accountabilityGroup.findUnique({
    where: { id },
    include: { _count: { select: { members: true } } },
  });
  if (!group) return fail("Group not found", 404);

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: session.id } },
  });

  if (existing) {
    await prisma.groupMember.delete({ where: { groupId_userId: { groupId: id, userId: session.id } } });
    return ok({ joined: false });
  }

  if (group._count.members >= group.capacity) return fail("This group is full", 409);
  await prisma.groupMember.create({ data: { groupId: id, userId: session.id } });
  return ok({ joined: true });
}
