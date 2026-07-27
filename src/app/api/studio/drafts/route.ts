import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { listDrafts, createDraft, builderFor } from "@/lib/studio";

// GET /api/studio/drafts?kind=bio — the user's drafts for a builder.
export const GET = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const kind = new URL(req.url).searchParams.get("kind") ?? "";
  if (!builderFor(kind)) return fail("Unknown builder", 404);
  const drafts = await listDrafts(session.id, kind);
  return ok({ drafts });
});

const createSchema = z.object({
  kind: z.string().min(1),
  title: z.string().trim().max(120).default(""),
});

// POST /api/studio/drafts — start a new draft for a builder.
export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`draft:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const body = await parseBody(req, createSchema);
  if (body.error) return body.error;
  if (!builderFor(body.data.kind)) return fail("Unknown builder", 404);
  const id = await createDraft(session.id, body.data.kind, body.data.title || "Untitled");
  return ok({ id }, 201);
});
