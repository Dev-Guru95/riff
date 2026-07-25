import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseBody, ok, fail, withRoute } from "@/lib/api";

const schema = z.object({ blockedId: z.string().min(1) });

// Toggle blocking another artist. Blocked users' posts are hidden from the blocker.
export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  if (body.data.blockedId === session.id) return fail("You cannot block yourself", 400);

  const existing = await prisma.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId: session.id, blockedId: body.data.blockedId } },
  });
  if (existing) {
    await prisma.userBlock.delete({ where: { blockerId_blockedId: { blockerId: session.id, blockedId: body.data.blockedId } } });
    return ok({ blocked: false });
  }
  await prisma.userBlock.create({ data: { blockerId: session.id, blockedId: body.data.blockedId } });
  return ok({ blocked: true });
});
