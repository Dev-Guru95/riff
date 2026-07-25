import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { parseBody, ok, fail, tooMany, withRoute } from "@/lib/api";

const schema = z.object({
  targetType: z.enum(["thread", "post", "user"]),
  targetId: z.string().min(1),
  reason: z.string().min(3).max(500),
});

export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`report:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  // One open report per (reporter, target).
  const existing = await prisma.report.findFirst({
    where: { reporterId: session.id, targetType: body.data.targetType, targetId: body.data.targetId, status: "open" },
  });
  if (existing) return ok({ id: existing.id, duplicate: true });

  const report = await prisma.report.create({
    data: { reporterId: session.id, ...body.data },
  });
  return ok({ id: report.id }, 201);
});
