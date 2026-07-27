import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { listFans, addFan } from "@/lib/studio-growth";

export const GET = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const tag = new URL(req.url).searchParams.get("tag") ?? undefined;
  return ok(await listFans(session.id, tag || undefined));
});

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().or(z.literal("")).optional(),
  source: z.string().max(60).optional(),
  tags: z.array(z.string().max(30)).max(30).optional(),
});

export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`fan:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  const id = await addFan(session.id, body.data);
  return ok({ id }, 201);
});
