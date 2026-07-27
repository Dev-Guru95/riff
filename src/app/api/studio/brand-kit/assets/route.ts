import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { addBrandAsset } from "@/lib/studio-tools";

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  url: z.string().min(1).max(1000),
});

// POST /api/studio/brand-kit/assets — link an uploaded logo/asset (see /api/uploads).
export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`brandasset:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  if (!/^\/uploads\/[\w.\-/]+$/.test(body.data.url) || body.data.url.includes("..")) {
    return fail("Invalid asset URL", 422);
  }
  const id = await addBrandAsset(session.id, body.data.name, body.data.url);
  return ok({ id, name: body.data.name, url: body.data.url }, 201);
});
