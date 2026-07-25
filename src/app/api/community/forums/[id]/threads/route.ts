import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseBody, ok, fail, tooMany, withRoute } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({
  title: z.string().min(3).max(140),
  body: z.string().min(1).max(5000),
  kind: z.enum(["discussion", "showcase", "feedback"]).default("discussion"),
  link: z.string().url().optional(),
});

export const POST = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  // Spam control: 5 new threads/min/user.
  const rl = rateLimit(`thread:${session.id}`, 5, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const { id } = await params;
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const forum = await prisma.forum.findUnique({ where: { id } });
  if (!forum) return fail("Forum not found", 404);

  const thread = await prisma.thread.create({
    data: {
      forumId: id,
      userId: session.id,
      title: body.data.title,
      kind: body.data.kind,
      link: body.data.link,
      posts: { create: { userId: session.id, body: body.data.body } },
    },
  });
  return ok({ id: thread.id }, 201);
});
