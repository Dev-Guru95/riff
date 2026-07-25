import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isSkoolMember } from "@/lib/community";
import { ok, fail } from "@/lib/api";

export async function POST() {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  // Community gate: AI Coach requires Skool membership.
  if (!(await isSkoolMember(session.id))) {
    return fail("Join the Skool community to unlock the AI Coach.", 403, { reason: "community_required" });
  }
  const thread = await prisma.coachThread.create({ data: { userId: session.id } });
  return ok({ id: thread.id }, 201);
}

export async function GET() {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const threads = await prisma.coachThread.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return ok({ threads });
}
