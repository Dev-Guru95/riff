import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { listGoals, addGoal } from "@/lib/studio-growth";

export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  return ok({ goals: await listGoals(session.id) });
});

const schema = z.object({ title: z.string().trim().min(1).max(200) });

export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`goal:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  const id = await addGoal(session.id, body.data.title);
  return ok({ id }, 201);
});
