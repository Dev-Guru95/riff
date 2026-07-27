import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { scoreDraft } from "@/lib/studio";

// POST /api/studio/drafts/[id]/score — run the AI reviewer and save the result.
// Rate-limited like other AI endpoints.
export const POST = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`score:${session.id}`, LIMITS.ai.limit, LIMITS.ai.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const { id } = await params;
  const draft = await scoreDraft(id, session.id);
  if (!draft) return fail("Draft not found", 404);
  return ok({ draft });
});
