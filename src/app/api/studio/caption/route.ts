import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { generateCaptions } from "@/lib/caption";

const schema = z.object({
  topic: z.string().trim().min(1).max(500),
  platform: z.enum(["instagram", "tiktok", "youtube", "x", "facebook"]).default("instagram"),
  tone: z.enum(["authentic", "hype", "playful", "professional", "moody"]).default("authentic"),
});

// POST /api/studio/caption — generate captions + hashtags (AI, rate-limited).
export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`caption:${session.id}`, LIMITS.ai.limit, LIMITS.ai.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  return ok(await generateCaptions(body.data));
});
