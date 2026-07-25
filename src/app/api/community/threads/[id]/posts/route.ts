import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseBody, ok, fail, tooMany, withRoute } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({ body: z.string().min(1).max(5000) });

export const POST = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  // Spam control: 10 posts/min/user.
  const rl = rateLimit(`post:${session.id}`, 10, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const { id } = await params;
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const thread = await prisma.thread.findUnique({ where: { id } });
  if (!thread) return fail("Thread not found", 404);

  const post = await prisma.post.create({ data: { threadId: id, userId: session.id, body: body.data.body } });
  return ok({ id: post.id }, 201);
});
